import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Trash2, Link as LinkIcon, RefreshCcw, FileText, AlertTriangle, Eye } from 'lucide-react';
import { getPDFFirstPageAsImage } from "@/lib/pdfUtils";
import { fetchPDFWithFreshSignedUrl, extractStoragePathFromSignedUrl } from "@/lib/pdfUrlManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";

interface AuditResult {
  document_id: string;
  file_url: string;
  current_data: {
    title: string;
    year: number | null;
    grade: number | null;
    paper_number: number | null;
    month: string | null;
    language: string | null;
    subject: string | null;
    is_memo: boolean;
    memo_for_document_id: string | null;
  };
  extracted_data: {
    subject: string | null;
    grade: number | null;
    year: number | null;
    paper_number: number | null;
    month: string | null;
    language: string | null;
    is_memo: boolean;
    is_past_paper: boolean;
    is_annexure: boolean;
    has_watermark: boolean;
    watermark_text: string | null;
    confidence_score: number;
  };
  mismatches: string[];
  duplicates: Array<{ id: string; title: string }>;
  suggested_link: { type: 'memo' | 'paper'; id: string; title: string } | null;
  is_annexure: boolean;
  subject_id_match: string | null;
  audit_reasoning?: string;
  fix_suggestion?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  applied?: boolean;
  ignored?: boolean;
}

const DocumentAuditor = () => {
  const [batchSize, setBatchSize] = useState(100);
  const [concurrency, setConcurrency] = useState(5);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<AuditResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ total: 0, unaudited: 0 });
  const [filterType, setFilterType] = useState('all');
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const { count: total } = await supabase.from('documents').select('*', { count: 'exact', head: true });
    const { count: unaudited } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .or('accurate.is.null,accurate.eq.""');
    
    setStats({ total: total || 0, unaudited: unaudited || 0 });
  };

  const processDocument = async (doc: any, index: number, total: number) => {
    setResults(prev => {
      const newResults = [...prev];
      if (newResults[index]) {
        newResults[index].status = 'processing';
        newResults[index].error = undefined;
      }
      return newResults;
    });

    try {
      if (!doc.file_url) throw new Error("No file URL");

      // Extract storage path from signed URL for potential regeneration
      const storagePath = extractStoragePathFromSignedUrl(doc.file_url);

      // Fetch file with automatic signed URL refresh on 400 errors
      const blob = await fetchPDFWithFreshSignedUrl(doc.file_url, storagePath);
      const file = new File([blob], "document.pdf", { type: "application/pdf" });

      // Extract first page as image
      const { base64, mimeType } = await getPDFFirstPageAsImage(file);

      // Call edge function
      const { data, error: auditError } = await supabase.functions.invoke('audit-document', {
        body: {
          document_id: doc.document_id || doc.id,
          image: base64,
          filename: doc.title,
          mime_type: mimeType
        }
      });

      if (auditError) throw auditError;

      setResults(prev => {
        const newResults = [...prev];
        if (newResults[index]) {
          newResults[index] = {
            ...newResults[index],
            ...data,
            status: 'completed'
          };
        }
        return newResults;
      });
    } catch (err: any) {
      console.error(`Error auditing ${doc.id || doc.document_id}:`, err);
      setResults(prev => {
        const newResults = [...prev];
        if (newResults[index]) {
          newResults[index].status = 'error';
          newResults[index].error = err.message;
        }
        return newResults;
      });
    } finally {
      setProcessedCount(prev => {
        const next = prev + 1;
        setProgress((next / total) * 100);
        return next;
      });
    }
  };

  const startAudit = async () => {
    setIsProcessing(true);
    setProgress(0);
    setProcessedCount(0);
    setResults([]);

    try {
      // 1. Fetch unaudited documents
      const { data: docs, error } = await supabase
        .from('documents')
        .select('*, subjects(name)')
        .or('accurate.is.null,accurate.eq.""')
        .order('created_at', { ascending: false })
        .limit(batchSize);

      if (error) throw error;
      if (!docs || docs.length === 0) {
        toast.info("No unaudited documents found");
        setIsProcessing(false);
        return;
      }

      setTotalToProcess(docs.length);

      // Initialize results
      const initialResults: AuditResult[] = docs.map(doc => ({
        document_id: doc.id,
        file_url: doc.file_url,
        current_data: {
          title: doc.title,
          year: doc.year,
          grade: doc.grade,
          paper_number: doc.paper_number,
          month: doc.month,
          language: doc.language,
          subject: doc.subjects?.name,
          is_memo: !!doc.is_memo,
          memo_for_document_id: doc.memo_for_document_id
        },
        extracted_data: {} as any,
        mismatches: [],
        duplicates: [],
        suggested_link: null,
        is_annexure: false,
        subject_id_match: null,
        status: 'pending'
      }));

      setResults(initialResults);

      // Process in batches with concurrency
      const queue = [...docs.entries()];
      const workers = Array(Math.min(concurrency, docs.length)).fill(null).map(async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (!item) break;
          const [index, doc] = item;
          await processDocument(doc, index, docs.length);
        }
      });

      await Promise.all(workers);

      const errorCount = results.filter(r => r.status === 'error').length;
      if (errorCount > 0) {
        toast.warning(`Audit complete with ${errorCount} errors.`, {
          action: {
            label: "View Errors",
            onClick: () => setFilterType('errors')
          }
        });
      } else {
        toast.success("Audit complete!");
      }
    } catch (err: any) {
      toast.error(`Audit failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      fetchStats();
    }
  };

  const rerunAudit = async (index: number) => {
    const res = results[index];
    if (!res) return;

    setIsProcessing(true);
    setProgress(0);
    setProcessedCount(0);
    setTotalToProcess(1);

    const doc = {
      document_id: res.document_id,
      file_url: res.file_url,
      title: res.current_data.title
    };

    await processDocument(doc, index, 1);
    setIsProcessing(false);
    toast.success("Rerun complete");
  };

  const rerunAllErrors = async () => {
    const errorResults = results.filter(r => r.status === 'error');
    if (errorResults.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setProcessedCount(0);
    setTotalToProcess(errorResults.length);

    const queue = errorResults.map(r => ({
      index: results.indexOf(r),
      doc: {
        document_id: r.document_id,
        file_url: r.file_url,
        title: r.current_data.title
      }
    }));

    const workers = Array(Math.min(concurrency, queue.length)).fill(null).map(async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        await processDocument(item.doc, item.index, errorResults.length);
      }
    });

    await Promise.all(workers);
    setIsProcessing(false);
    toast.success("Rerun of errors complete");
  };

  const applyChanges = async (index: number, silent = false) => {
    const res = results[index];
    if (res.applied) return;

    try {
      // 1. Delete if annexure or confirmed duplicate
      if (res.is_annexure) {
        const { error } = await supabase.from('documents').delete().eq('id', res.document_id);
        if (error) throw error;
        if (!silent) toast.success("Annexure deleted");
      } else {
        // 2. Update metadata
        const updates: any = {
          accurate: 'yes',
          year: res.extracted_data.year,
          grade: res.extracted_data.grade,
          paper_number: res.extracted_data.paper_number,
          month: res.extracted_data.month,
          language: res.extracted_data.language,
          subject_id: res.subject_id_match,
          is_memo: res.extracted_data.is_memo,
          is_past_paper: res.extracted_data.is_past_paper
        };

        const { error: updateError } = await supabase
          .from('documents')
          .update(updates)
          .eq('id', res.document_id);

        if (updateError) throw updateError;

        // 3. Link if suggested
        if (res.suggested_link) {
          if (res.suggested_link.type === 'memo') {
            // res.document_id is paper, res.suggested_link.id is memo
            await supabase.from('documents').update({ memo_for_document_id: res.document_id }).eq('id', res.suggested_link.id);
          } else {
            // res.document_id is memo, res.suggested_link.id is paper
            await supabase.from('documents').update({ memo_for_document_id: res.suggested_link.id }).eq('id', res.document_id);
          }
        }

        if (!silent) toast.success("Changes applied");
      }

      setResults(prev => {
        const newResults = [...prev];
        newResults[index].applied = true;
        return newResults;
      });
      fetchStats();
    } catch (err: any) {
      if (!silent) toast.error(`Failed to apply changes: ${err.message}`);
      throw err;
    }
  };

  const deleteDocument = async (id: string, index: number, silent = false) => {
    try {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      if (!silent) toast.success("Document deleted");
      setResults(prev => {
        const newResults = [...prev];
        newResults[index].applied = true; // Mark as done
        return newResults;
      });
      fetchStats();
    } catch (err: any) {
      if (!silent) toast.error(`Delete failed: ${err.message}`);
      throw err;
    }
  };

  const markAccurate = async (index: number, silent = false) => {
    try {
      const { error } = await supabase.from('documents').update({ accurate: 'yes' }).eq('id', results[index].document_id);
      if (error) throw error;
      if (!silent) toast.success("Marked as accurate");
      setResults(prev => {
        const newResults = [...prev];
        newResults[index].applied = true;
        return newResults;
      });
      fetchStats();
    } catch (err: any) {
      if (!silent) toast.error(`Failed: ${err.message}`);
      throw err;
    }
  };

  const ignoreResult = async (index: number) => {
    try {
      const { error } = await supabase.from('documents').update({ accurate: 'yes' }).eq('id', results[index].document_id);
      if (error) throw error;

      setResults(prev => {
        const newResults = [...prev];
        newResults[index].ignored = true;
        newResults[index].applied = true;
        return newResults;
      });
      toast.success("Document marked as accurate (ignored AI suggestions)");
      fetchStats();
    } catch (err: any) {
      toast.error(`Failed to ignore: ${err.message}`);
    }
  };

  const filteredResults = results.filter(res => {
    if (filterType === 'all') return true;
    if (filterType === 'errors') return res.status === 'error' || (res.status === 'processing' && isProcessing);
    if (filterType === 'mismatches') return res.mismatches.length > 0;
    if (filterType === 'grade') return res.mismatches.includes('grade');
    if (filterType === 'duplicates') return res.duplicates.length > 0;
    if (filterType === 'annexures') return res.is_annexure;
    if (filterType === 'links') return !!res.suggested_link;
    if (filterType === 'accurate') return res.status === 'completed' && res.mismatches.length === 0 && !res.is_annexure && res.duplicates.length === 0 && !res.suggested_link;
    return true;
  });

  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const paginatedResults = filteredResults.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType]);

  const getVisiblePages = () => {
    const maxVisible = 5;
    const pages: (number | string)[] = [];

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push("ellipsis-start");
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("ellipsis-end");
      }

      pages.push(totalPages);
    }

    return pages;
  };

  const massApplyEverything = async () => {
    const toProcess = filteredResults.filter(r => r.status === 'completed' && !r.applied && !r.ignored);
    if (toProcess.length === 0) {
      toast.info("No completed (non-ignored) results in current filter to apply");
      return;
    }

    setIsProcessing(true);
    let count = 0;

    try {
      for (const res of toProcess) {
        const idx = results.indexOf(res);
        if (res.applied || res.ignored) continue; // Re-check state inside loop

        try {
          // 1. Delete duplicates from DB if any
          if (res.duplicates.length > 0) {
            const duplicateIds = res.duplicates.map(d => d.id);
            const { error: delError } = await supabase
              .from('documents')
              .delete()
              .in('id', duplicateIds);

            if (delError) {
              console.error(`Error deleting duplicates for ${res.document_id}:`, delError);
            } else {
              // Update state for any documents in results that were just deleted
              setResults(prev => {
                const newResults = [...prev];
                duplicateIds.forEach(id => {
                  const dupIdx = newResults.findIndex(r => r.document_id === id);
                  if (dupIdx !== -1) {
                    newResults[dupIdx].applied = true;
                    newResults[dupIdx].audit_reasoning = "Deleted as duplicate during mass apply";
                  }
                });
                return newResults;
              });
            }
          }

          // 2. Process current document (annexure vs metadata update vs mark accurate)
          if (res.is_annexure) {
            await deleteDocument(res.document_id, idx, true);
          }
          else if (res.mismatches.length > 0 || res.suggested_link) {
            await applyChanges(idx, true);
          }
          else {
            await markAccurate(idx, true);
          }
          count++;
        } catch (err) {
          console.error(`Error in mass apply for document ${res.document_id}:`, err);
        }
      }
      toast.success(`Mass applied ${count} documents successfully! (Cleaned up duplicates)`);
    } catch (err: any) {
      toast.error(`Mass apply encountered errors: ${err.message}`);
    } finally {
      setIsProcessing(false);
      fetchStats();
    }
  };

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Document Auditor
          </CardTitle>
          <CardDescription>
            Audit and verify past papers and memos using Gemini 2.0 AI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="space-y-2">
              <Label>Batch Size</Label>
              <Input
                type="number"
                value={batchSize || ""}
                onChange={(e) => setBatchSize(parseInt(e.target.value) || 0)}
                min={1}
                max={500}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label>Concurrency (AI calls at once)</Label>
              <Input
                type="number"
                value={concurrency || ""}
                onChange={(e) => setConcurrency(parseInt(e.target.value) || 0)}
                min={1}
                max={10}
                disabled={isProcessing}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={startAudit} 
                disabled={isProcessing || stats.unaudited === 0}
                className="flex-1"
              >
                {isProcessing ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : "Start Audit"}
              </Button>
              <Button variant="outline" onClick={fetchStats} disabled={isProcessing}>
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-6 flex justify-between items-center text-sm text-muted-foreground">
            <span>{stats.unaudited} documents remaining to be audited</span>
            <span>Total: {stats.total}</span>
          </div>
          
          {isProcessing && (
            <div className="mt-4 space-y-2">
              <Progress value={progress} />
              <p className="text-center text-xs">{Math.round(progress)}% Complete</p>
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Audit Results</CardTitle>
              <CardDescription>
                Showing {filteredResults.length} of {results.length} documents
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="filter" className="whitespace-nowrap">Filter by:</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Results" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results ({results.length})</SelectItem>
                  <SelectItem value="errors">Errors ({results.filter(r => r.status === 'error').length})</SelectItem>
                  <SelectItem value="mismatches">Any Mismatches ({results.filter(r => r.mismatches.length > 0).length})</SelectItem>
                  <SelectItem value="grade">Grade Changes ({results.filter(r => r.mismatches.includes('grade')).length})</SelectItem>
                  <SelectItem value="duplicates">Duplicates Found ({results.filter(r => r.duplicates.length > 0).length})</SelectItem>
                  <SelectItem value="annexures">Annexures ({results.filter(r => r.is_annexure).length})</SelectItem>
                  <SelectItem value="links">Suggested Links ({results.filter(r => !!r.suggested_link).length})</SelectItem>
                  <SelectItem value="accurate">Matches ({results.filter(r => r.status === 'completed' && r.mismatches.length === 0 && !r.is_annexure && r.duplicates.length === 0 && !r.suggested_link).length})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Mismatches / AI Extraction</TableHead>
                    <TableHead>Issues / Suggestions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedResults.map((res) => {
                    const idx = results.indexOf(res);
                    return (
                    <TableRow key={res.document_id} className={(res.applied || res.ignored) ? "opacity-50" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="max-w-[180px] truncate" title={res.current_data.title}>
                              {res.current_data.title}
                            </span>
                            {res.file_url && (
                              <a
                                href={res.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80"
                              >
                                <Eye className="h-4 w-4" />
                              </a>
                            )}
                            {res.ignored && <Badge variant="outline" className="text-[10px] py-0">Ignored</Badge>}
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant="secondary">{res.current_data.subject || 'Unknown Subject'}</Badge>
                            <Badge variant="outline">G{res.current_data.grade}</Badge>
                            <Badge variant="outline">{res.current_data.year}</Badge>
                            {res.current_data.is_memo ? <Badge className="bg-orange-100 text-orange-800 border-orange-200">Memo</Badge> : <Badge className="bg-blue-100 text-blue-800 border-blue-200">Paper</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {res.status === 'processing' && <div className="flex items-center gap-2"><RefreshCcw className="h-4 w-4 animate-spin" /> Analyzing...</div>}
                        {res.status === 'error' && (
                          <div className="space-y-2">
                            <div className="text-destructive flex items-center gap-1 font-medium">
                              <AlertCircle className="h-4 w-4" /> {res.error}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => rerunAudit(idx)}
                              disabled={isProcessing}
                              className="h-7 text-xs"
                            >
                              <RefreshCcw className="mr-1 h-3 w-3" /> Rerun
                            </Button>
                          </div>
                        )}
                        {res.status === 'completed' && (
                          <div className="space-y-1 text-xs">
                            {res.mismatches.length > 0 ? (
                              <>
                                {res.mismatches.map(m => (
                                  <div key={m} className="flex items-center gap-2 text-orange-600 font-semibold">
                                    <AlertTriangle className="h-3 w-3" />
                                    {m.toUpperCase()}: {res.current_data[m as keyof typeof res.current_data]?.toString() || 'N/A'} → {res.extracted_data[m as keyof typeof res.extracted_data]?.toString() || 'N/A'}
                                  </div>
                                ))}
                                {res.audit_reasoning && (
                                  <div className="mt-2 text-[10px] bg-orange-50 p-1.5 rounded border border-orange-100 italic">
                                    <strong>AI Reasoning:</strong> {res.audit_reasoning}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> All metadata matches</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {res.status === 'completed' && (
                          <div className="space-y-2">
                            {res.is_annexure && (
                              <Badge variant="destructive" className="flex w-fit gap-1">
                                <Trash2 className="h-3 w-3" /> Annexure Detected
                              </Badge>
                            )}
                            {res.duplicates.length > 0 && (
                              <div className="text-destructive text-xs font-bold flex flex-col gap-1">
                                <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {res.duplicates.length} Duplicates Found:</span>
                                {res.duplicates.map(d => <div key={d.id} className="ml-4 font-normal underline">{d.title}</div>)}
                              </div>
                            )}
                            {res.suggested_link && (
                              <div className="text-blue-600 text-xs font-bold flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                  <LinkIcon className="h-3 w-3" />
                                  Suggest Link to {res.suggested_link.type}: {res.suggested_link.title}
                                </div>
                              </div>
                            )}
                            {res.fix_suggestion && (
                               <div className="mt-1 text-[10px] bg-blue-50 p-1.5 rounded border border-blue-100 text-blue-700">
                                 <strong>Fix Suggestion:</strong> {res.fix_suggestion}
                               </div>
                            )}
                            {res.extracted_data.has_watermark && (
                              <div className="text-muted-foreground text-xs italic">
                                Watermark: {res.extracted_data.watermark_text}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {res.status === 'completed' && !res.applied && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => ignoreResult(idx)}
                              disabled={res.applied || res.ignored}
                              title="Ignore AI results and mark document as accurate"
                            >
                              Ignore
                            </Button>
                            {!res.ignored && (
                              <>
                                {res.is_annexure ? (
                                  <Button variant="destructive" size="sm" onClick={() => deleteDocument(res.document_id, idx)}>
                                    Delete Annexure
                                  </Button>
                                ) : (
                                  <>
                                    {res.mismatches.length > 0 || res.suggested_link ? (
                                      <Button size="sm" onClick={() => applyChanges(idx)}>
                                        Apply Corrections
                                      </Button>
                                    ) : (
                                      <Button variant="outline" size="sm" onClick={() => markAccurate(idx)}>
                                        Mark Accurate
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => deleteDocument(res.document_id, idx)} className="text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        )}
                        {res.applied && <Badge variant="secondary" className="bg-green-100 text-green-800">Done</Badge>}
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            </ScrollArea>

            {totalPages > 1 && (
              <div className="mt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) setCurrentPage(currentPage - 1);
                        }}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>

                    {getVisiblePages().map((page, i) => {
                      if (typeof page === "string") {
                        return (
                          <PaginationItem key={`ellipsis-${i}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            isActive={currentPage === page}
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(page);
                            }}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                        }}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between items-center border-t p-4">
             <div className="text-xs text-muted-foreground">
               Use "Apply Corrections" to update metadata and link docs. "Mark Accurate" if everything is correct.
             </div>
             <div className="flex gap-2">
               {filterType === 'errors' && (
                 <Button
                   variant="outline"
                   onClick={rerunAllErrors}
                   disabled={isProcessing || filteredResults.length === 0}
                   className="text-orange-600 border-orange-200 hover:bg-orange-50"
                 >
                   <RefreshCcw className="mr-2 h-4 w-4" />
                   Rerun All Errors
                 </Button>
               )}
               <Button
                 variant="outline"
                 onClick={async () => {
                   // Bulk apply for all matches (no mismatches, not ignored) in filtered set
                   const toMark = filteredResults.filter((r, i) => r.status === 'completed' && !r.applied && !r.ignored && r.mismatches.length === 0 && !r.suggested_link && !r.is_annexure && r.duplicates.length === 0);
                   for (const res of toMark) {
                     const idx = results.indexOf(res);
                     await markAccurate(idx);
                   }
                 }}
                 disabled={filteredResults.filter(r => r.status === 'completed' && !r.applied && !r.ignored && r.mismatches.length === 0 && !r.suggested_link && !r.is_annexure && r.duplicates.length === 0).length === 0}
               >
                 Mark All Matches as Accurate
               </Button>
               <Button
                 className="bg-green-600 hover:bg-green-700 text-white"
                 onClick={massApplyEverything}
                 disabled={isProcessing || filteredResults.filter(r => r.status === 'completed' && !r.applied && !r.ignored).length === 0}
               >
                 <CheckCircle2 className="mr-2 h-4 w-4" />
                 Mass Apply Everything
               </Button>
             </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

export default DocumentAuditor;

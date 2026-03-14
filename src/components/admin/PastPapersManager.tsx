import { useState, useEffect, useMemo } from 'react';
import { runWithConcurrency, withRetry } from '@/lib/concurrency';
import {
  Upload, Loader2, FileText, CheckCircle2, Trash2, Link2,
  GraduationCap, Edit2, Save, Eye, Bot, Layers, AlertTriangle, Search,
  ChevronLeft, ChevronRight, RefreshCw, RefreshCcw, X, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { compressPDF, uploadCompressedPDF, formatFileSize } from '@/lib/pdfCompressor';
import { getSubjectsByCurriculumAndGrade, type Curriculum, type Grade } from '@/data/curricula';
import { getPDFFirstPageAsImage } from '@/lib/pdfUtils';

interface PastPaper {
  id: string;
  title: string;
  description: string | null;
  subject_id: string | null;
  grade: number | null;
  year: number | null;
  month?: string | null;
  paper_number: number | null;
  curriculum: string | null;
  file_url: string | null;
  is_memo: boolean;
  memo_for_document_id: string | null;
  is_published: boolean;
  created_at: string;
  language?: string | null;
  subjects?: { name: string } | null;
}

const CURRICULUM_OPTIONS = [
  { value: 'CAPS', label: 'CAPS (DBE)' },
  { value: 'IEB', label: 'IEB' },
  { value: 'Cambridge', label: 'Cambridge' },
];

const GRADES = [8, 9, 10, 11, 12];
const YEARS = Array.from({ length: new Date().getFullYear() - 2008 + 1 }, (_, i) => new Date().getFullYear() - i);
const MONTHS = [
  { value: 'Jan', label: 'Jan' },
  { value: 'Feb', label: 'Feb' },
  { value: 'Mar', label: 'Mar' },
  { value: 'Apr', label: 'Apr' },
  { value: 'May', label: 'May' },
  { value: 'Jun', label: 'Jun' },
  { value: 'Jul', label: 'Jul' },
  { value: 'Aug', label: 'Aug' },
  { value: 'Sep', label: 'Sep' },
  { value: 'Oct', label: 'Oct' },
  { value: 'Nov', label: 'Nov' },
  { value: 'Dec', label: 'Dec' },
];
const PAPER_NUMBERS = [1, 2, 3];

// Map curriculum DB values to curricula.ts format
const CURRICULUM_MAP: Record<string, Curriculum> = {
  'CAPS': 'caps',
  'IEB': 'ieb',
  'Cambridge': 'cambridge',
};

export const PastPapersManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [pastPapers, setPastPapers] = useState<PastPaper[]>([]);
  const [totalPapers, setTotalPapers] = useState(0);
  const [isFetchingPapers, setIsFetchingPapers] = useState(false);
  const [paperSearchQuery, setPaperSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [analyticsData, setAnalyticsData] = useState<Record<string, Record<number, number>>>({});
  const [listPage, setListPage] = useState(1);
  const LIST_ITEMS_PER_PAGE = 50;
  const [activeTab, setActiveTab] = useState<'single' | 'batch' | 'manage'>('single');

  // AI Batch state
  interface AnalyzedPaper {
    id: string;
    file: File;
    title: string | null;
    subject: string | null;
    curriculum: 'CAPS' | 'IEB' | 'Cambridge' | null;
    grade: number | null;
    year: number | null;
    paper_number: number | null;
    is_past_paper: boolean;
    is_memo: boolean;
    month: string | null;
    language: string | null;
    province: string | null;
    description: string | null;
    has_watermark: boolean;
    watermark_text: string | null;
    status: 'pending' | 'analyzing' | 'completed' | 'error';
    error?: string;
    linkedMemoId?: string | null;
    isMemoForId?: string | null;
    selected?: boolean;
  }
  const [batchFiles, setBatchFiles] = useState<AnalyzedPaper[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [batchFilter, setBatchFilter] = useState<'all' | 'error' | 'missing_subject' | 'watermark' | 'unlinked_memos'>('all');
  const ITEMS_PER_PAGE = 20;

  const isMissingSubject = (f: AnalyzedPaper) => {
    if (f.status !== 'completed') return false;
    if (f.subject) return false;
    if (f.isMemoForId) {
      const linkedPaper = batchFiles.find(p => p.id === f.isMemoForId);
      return !linkedPaper?.subject;
    }
    return true;
  };

  const filteredBatchFiles = useMemo(() => {
    switch (batchFilter) {
      case 'error':
        return batchFiles.filter(f => f.status === 'error');
      case 'missing_subject':
        return batchFiles.filter(f => isMissingSubject(f));
      case 'watermark':
        return batchFiles.filter(f => f.has_watermark);
      case 'unlinked_memos':
        return batchFiles.filter(f => f.is_memo && !f.isMemoForId);
      default:
        return batchFiles;
    }
  }, [batchFiles, batchFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBatchFiles.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (batchFiles.length === 0) {
      setHasAttemptedLinking(false);
    }
  }, [batchFiles.length]);

  // Ensure current page is valid when files are removed or filters change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (currentPage === 0 && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [filteredBatchFiles.length, totalPages, currentPage]);

  const paginatedFiles = filteredBatchFiles.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const totalListPages = Math.max(1, Math.ceil(totalPapers / LIST_ITEMS_PER_PAGE));

  useEffect(() => {
    if (listPage > totalListPages && totalListPages > 0) {
      setListPage(totalListPages);
    }
  }, [pastPapers.length, totalListPages, listPage]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [batchUploadProgress, setBatchUploadProgress] = useState(0);
  const [hasAttemptedLinking, setHasAttemptedLinking] = useState(false);

  const [bulkMetadata, setBulkMetadata] = useState<{
    subject: string | null;
    curriculum: 'CAPS' | 'IEB' | 'Cambridge' | null;
    grade: number | null;
    year: number | null;
    month: string | null;
    is_memo: boolean;
    is_past_paper: boolean;
    apply_memo: boolean;
    apply_past_paper: boolean;
  }>({
    subject: null,
    curriculum: null,
    grade: null,
    year: null,
    month: null,
    is_memo: false,
    is_past_paper: true,
    apply_memo: false,
    apply_past_paper: false,
  });

  const selectedCount = batchFiles.filter(f => f.selected).length;
  const filteredSelectedCount = filteredBatchFiles.filter(f => f.selected).length;
  const allSelected = filteredBatchFiles.length > 0 && filteredSelectedCount === filteredBatchFiles.length;

  const toggleSelectAll = (checked: boolean) => {
    const idsToToggle = new Set(filteredBatchFiles.map(f => f.id));
    setBatchFiles(prev => prev.map(f => idsToToggle.has(f.id) ? { ...f, selected: checked } : f));
  };

  const toggleSelectFile = (id: string, checked: boolean) => {
    setBatchFiles(prev => prev.map(f => f.id === id ? { ...f, selected: checked } : f));
  };

  const applyBulkEdit = () => {
    setBatchFiles(prev => prev.map(f => {
      if (!f.selected) return f;

      const updated = { ...f };
      if (bulkMetadata.subject) updated.subject = bulkMetadata.subject;
      if (bulkMetadata.curriculum) updated.curriculum = bulkMetadata.curriculum;
      if (bulkMetadata.grade) updated.grade = bulkMetadata.grade;
      if (bulkMetadata.year) updated.year = bulkMetadata.year;
      if (bulkMetadata.month) updated.month = bulkMetadata.month;

      if (bulkMetadata.apply_memo) updated.is_memo = bulkMetadata.is_memo;
      if (bulkMetadata.apply_past_paper) updated.is_past_paper = bulkMetadata.is_past_paper;

      // Update title
      updated.title = generateTitle(updated.subject, updated.paper_number, updated.month, updated.year);

      return updated;
    }));

    toast({
      title: 'Bulk Update Applied',
      description: `Updated ${selectedCount} files`,
    });
  };

  const getRowSubjects = (curriculum: string | null, grade: number | null) => {
    if (!curriculum || !grade) return [];
    const currKey = CURRICULUM_MAP[curriculum];
    if (!currKey) return [];
    return getSubjectsByCurriculumAndGrade(currKey, grade.toString() as Grade) || [];
  };

  // Helper to generate paper title
  const generateTitle = (subject: string | null, paperNumber: string | number | null, month: string | null, year: string | number | null) => {
    if (!subject) return '';

    // Construct main title part
    let mainTitle = subject;
    if (paperNumber) {
      mainTitle += ` Paper ${paperNumber}`;
    }

    // Construct suffix
    let suffix = '';
    if (month && year) {
      suffix = `${month} ${year}`;
    } else if (year) {
      suffix = `${year}`;
    } else if (month) {
      suffix = `${month}`;
    }

    if (suffix) {
      return `${mainTitle} - ${suffix}`;
    }
    return mainTitle;
  };

  const updateBatchFile = (id: string, updates: Partial<AnalyzedPaper>) => {
    setBatchFiles(prev => prev.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, ...updates };
      // Auto-update title if relevant fields change
      if ('subject' in updates || 'paper_number' in updates || 'month' in updates || 'year' in updates) {
        updated.title = generateTitle(updated.subject, updated.paper_number, updated.month, updated.year);
      }
      return updated;
    }));
  };

  const manualLink = (memoId: string, paperId: string) => {
    setBatchFiles(prev => prev.map(f => {
      // Set memo link
      if (f.id === memoId) {
        return { ...f, isMemoForId: paperId, is_memo: true };
      }
      // Set paper link
      if (f.id === paperId) {
        return { ...f, linkedMemoId: memoId, is_memo: false };
      }
      // Clear previous links if any
      if (f.isMemoForId === paperId && f.id !== memoId) {
        return { ...f, isMemoForId: null };
      }
      if (f.linkedMemoId === memoId && f.id !== paperId) {
        return { ...f, linkedMemoId: null };
      }
      return f;
    }));

    toast({
      title: 'Manual link successful',
      description: 'The memo and paper have been linked.',
    });
  };

  const manualUnlink = (fileId: string) => {
    setBatchFiles(prev => {
      const file = prev.find(f => f.id === fileId);
      if (!file) return prev;

      const otherId = file.isMemoForId || file.linkedMemoId;

      return prev.map(f => {
        if (f.id === fileId) {
          return { ...f, isMemoForId: null, linkedMemoId: null };
        }
        if (otherId && f.id === otherId) {
          return { ...f, isMemoForId: null, linkedMemoId: null };
        }
        return f;
      });
    });

    toast({
      title: 'Link removed',
      description: 'The association between the memo and paper has been removed.',
    });
  };

  // Form state
  const [paperFormData, setPaperFormData] = useState({
    title: '',
    subjectId: '',
    subjectName: '',
    grade: '',
    year: '',
    month: '',
    paperNumber: '',
    curriculum: '',
    description: '',
    language: 'Eng',
  });
  
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [memoFile, setMemoFile] = useState<File | null>(null);

  // Multiple Uploads state
  interface UploadTask {
    id: string;
    title: string;
    progress: number;
    status: 'idle' | 'compressing-paper' | 'compressing-memo' | 'uploading' | 'saving' | 'done' | 'error';
    error?: string;
  }
  const [activeUploads, setActiveUploads] = useState<UploadTask[]>([]);
  const [dragOverPaper, setDragOverPaper] = useState(false);
  const [dragOverMemo, setDragOverMemo] = useState(false);

  // Edit state
  const [editingPaper, setEditingPaper] = useState<PastPaper | null>(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    subjectId: '',
    subjectName: '',
    grade: '',
    year: '',
    month: '',
    paperNumber: '',
    curriculum: '',
    description: '',
    language: 'Eng',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  
  // Filtered subjects based on curriculum and grade selection
  const filteredSubjects = useMemo(() => {
    if (!paperFormData.curriculum || !paperFormData.grade) return [];
    
    const currKey = CURRICULUM_MAP[paperFormData.curriculum];
    if (!currKey) return [];
    
    const gradeStr = paperFormData.grade as Grade;
    const subjects = getSubjectsByCurriculumAndGrade(currKey, gradeStr);
    return subjects || [];
  }, [paperFormData.curriculum, paperFormData.grade]);
  
  // Filtered subjects for edit form
  const editFilteredSubjects = useMemo(() => {
    if (!editFormData.curriculum || !editFormData.grade) return [];
    
    const currKey = CURRICULUM_MAP[editFormData.curriculum];
    if (!currKey) return [];
    
    const gradeStr = editFormData.grade as Grade;
    const subjects = getSubjectsByCurriculumAndGrade(currKey, gradeStr);
    return subjects || [];
  }, [editFormData.curriculum, editFormData.grade]);

  // Auto-generate title for upload form
  useEffect(() => {
    if (paperFormData.subjectName) {
      const generatedTitle = generateTitle(
        paperFormData.subjectName,
        paperFormData.paperNumber,
        paperFormData.month,
        paperFormData.year
      );
      setPaperFormData(prev => ({ ...prev, title: generatedTitle }));
    }
  }, [paperFormData.subjectName, paperFormData.paperNumber, paperFormData.year, paperFormData.month]);

  // Auto-generate title for edit form
  useEffect(() => {
    if (editingPaper && editFormData.subjectName) {
      const generatedTitle = generateTitle(
        editFormData.subjectName,
        editFormData.paperNumber,
        editFormData.year,
        editFormData.month
      );
      setEditFormData(prev => ({ ...prev, title: generatedTitle }));
    }
  }, [editFormData.subjectName, editFormData.paperNumber, editFormData.year, editFormData.month, editingPaper]);

  useEffect(() => {
    fetchPastPapers();
  }, [listPage, paperSearchQuery, selectedSubject, selectedGrade]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const analytics = analyticsData;

  const fetchAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('grade, is_memo, subjects(name)')
        .eq('is_past_paper', true);

      if (error) throw error;

      const counts: Record<string, Record<number, number>> = {};
      data.forEach(paper => {
        if (paper.is_memo === true) return;
        const subject = (paper.subjects as any)?.name || 'Unknown';
        const grade = paper.grade || 0;
        if (!counts[subject]) counts[subject] = {};
        counts[subject][grade] = (counts[subject][grade] || 0) + 1;
      });
      setAnalyticsData(counts);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchPastPapers = async () => {
    setIsFetchingPapers(true);
    try {
      let query = supabase
        .from('documents')
        .select('*, subjects(name)', { count: 'exact' })
        .eq('is_past_paper', true)
        .order('created_at', { ascending: false });

      if (paperSearchQuery) {
        query = query.ilike('title', `%${paperSearchQuery}%`);
      }

      if (selectedSubject) {
        // Find subject id for name
        const { data: subjectData } = await supabase
          .from('subjects')
          .select('id')
          .eq('name', selectedSubject)
          .limit(1)
          .single();

        if (subjectData) {
          query = query.eq('subject_id', subjectData.id);
        }
      }

      if (selectedGrade) {
        query = query.eq('grade', selectedGrade);
      }

      const { data, count, error } = await query
        .range((listPage - 1) * LIST_ITEMS_PER_PAGE, listPage * LIST_ITEMS_PER_PAGE - 1);

      if (error) throw error;

      if (data) {
        setPastPapers(data as unknown as PastPaper[]);
        setTotalPapers(count || 0);
      }
    } catch (error) {
      console.error('Error fetching past papers:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch past papers',
        variant: 'destructive',
      });
    } finally {
      setIsFetchingPapers(false);
    }
  };

  // Find or create subject by name
  const findOrCreateSubject = async (subjectName: string, curriculum: string = 'CAPS'): Promise<string | null> => {
    // First, check if subject exists
    const { data: existing } = await supabase
      .from('subjects')
      .select('id')
      .eq('name', subjectName)
      .eq('curriculum', curriculum as any)
      .maybeSingle();

    if (existing) return existing.id;

    // Create new subject
    const { data: created, error } = await supabase
      .from('subjects')
      .insert({
        name: subjectName,
        curriculum: curriculum as any
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating subject:', error);
      return null;
    }

    return created.id;
  };

  const handleBatchFileSelect = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let files: File[] = [];

    if ('dataTransfer' in e) {
      e.preventDefault();
      files = Array.from(e.dataTransfer.files);
    } else {
      files = Array.from((e.target as HTMLInputElement).files || []);
    }

    const pdfFiles = files.filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      toast({
        title: 'No PDF files',
        description: 'Please select PDF files for batch processing',
        variant: 'destructive',
      });
      return;
    }

    const newAnalyzedPapers: AnalyzedPaper[] = pdfFiles.map(file => {
      // Use slice() to create a new Blob view of the file.
      // This is often more robust than just wrapping the original File object
      // and can help prevent "NotFoundError" in some browser environments.
      const clonedBlob = file.slice(0, file.size, file.type);
      const clonedFile = new File([clonedBlob], file.name, {
        type: file.type,
        lastModified: file.lastModified
      });

      return {
        id: crypto.randomUUID(),
        file: clonedFile,
        title: file.name.replace('.pdf', ''),
        subject: null,
        curriculum: null,
        grade: null,
        year: null,
        paper_number: null,
        is_past_paper: true,
        is_memo: false,
        month: null,
        language: null,
        province: null,
        description: null,
        has_watermark: false,
        watermark_text: null,
        status: 'pending',
        selected: false,
      };
    });

    setBatchFiles(prev => [...prev, ...newAnalyzedPapers]);
  };

  const analyzePapersWithAI = async () => {
    const papersToAnalyze = batchFiles.some(f => f.selected)
      ? batchFiles.filter(f => f.selected && (f.status === 'pending' || f.status === 'error'))
      : batchFiles.filter(f => f.status === 'pending' || f.status === 'error');

    if (papersToAnalyze.length === 0) return;

    setIsAnalyzing(true);

    // Limit concurrency to 5 for AI analysis
    await runWithConcurrency(papersToAnalyze, async (paper) => {
      setBatchFiles(prev => prev.map(p => p.id === paper.id ? { ...p, status: 'analyzing', error: undefined } : p));

      try {
        // Retry logic for AI analysis as it can sometimes fail due to timeouts
        const result = await withRetry(async () => {
          const { base64, mimeType } = await getPDFFirstPageAsImage(paper.file);

          console.log(`Analyzing ${paper.file.name} with AI... Payload size: ${Math.round(base64.length / 1024)} KB`);

          const { data, error } = await supabase.functions.invoke('analyze-paper-metadata', {
            body: {
              image: base64,
              mime_type: mimeType,
              filename: paper.file.name
            },
          });

          if (error) {
            console.error(`AI analysis failed for ${paper.file.name}:`, error);
            if (error.message?.includes('status 504') || error.message?.includes('timeout')) {
              throw new Error('AI analysis timed out. The file might be too complex or the service is busy.');
            }
            if (error.message?.includes('413')) {
              throw new Error('Image too large for AI analysis. Try a smaller file.');
            }
            throw error;
          }

          if (!data || !data.data) {
            console.error('AI returned empty or invalid data:', data);
            throw new Error('AI failed to extract metadata from this document.');
          }

          return data.data;
        }, 2, 2000); // 2 retries, 2s initial delay

        setBatchFiles(prev => prev.map(p => {
          if (p.id !== paper.id) return p;

          const subject = result.subject || p.subject;
          const month = result.month || p.month;
          const year = result.year || p.year;
          const paper_number = result.paper_number || p.paper_number;
          const province = result.province || p.province;
          const description = result.description || p.description;

          return {
            ...p,
            subject,
            curriculum: result.curriculum,
            grade: result.grade,
            year,
            paper_number,
            province,
            description,
            is_past_paper: result.is_past_paper,
            is_memo: result.is_memo,
            month,
            language: result.language,
            has_watermark: result.has_watermark,
            watermark_text: result.watermark_text,
            status: 'completed',
            title: generateTitle(subject, paper_number, month, year)
          };
        }));

      } catch (error: any) {
        console.error('AI analysis error after retries:', error);
        setBatchFiles(prev => prev.map(p => p.id === paper.id ? {
          ...p,
          status: 'error',
          error: error.message
        } : p));
      }
    }, 5);

    setIsAnalyzing(false);
  };

  const rerunSingle = (id: string) => {
    const paper = batchFiles.find(p => p.id === id);
    if (!paper) return;

    setBatchFiles(prev => prev.map(p => p.id === id ? { ...p, selected: true } : p));
    analyzePapersWithAI();
  };

  const rerunAllErrors = () => {
    setBatchFiles(prev => prev.map(p => p.status === 'error' ? { ...p, selected: true } : { ...p, selected: false }));
    setTimeout(() => {
      analyzePapersWithAI();
    }, 0);
  };

  const autoLinkMemos = () => {
    setHasAttemptedLinking(true);
    const papers = batchFiles.filter(f => !f.is_memo && f.status === 'completed');
    const memos = batchFiles.filter(f => f.is_memo && f.status === 'completed');

    if (papers.length === 0 || memos.length === 0) return;

    // Use a Map for O(1) lookups instead of O(N) find in a loop
    // Key: subject-grade-year-paper_number-curriculum-language-province
    const paperMap = new Map<string, string>();
    papers.forEach(p => {
      const key = `${p.subject}-${p.grade}-${p.year}-${p.paper_number}-${p.curriculum}-${p.language}-${p.province}`;
      paperMap.set(key, p.id);
    });

    const updatedFiles = [...batchFiles];
    let linksCreated = 0;

    memos.forEach(memo => {
      const key = `${memo.subject}-${memo.grade}-${memo.year}-${memo.paper_number}-${memo.curriculum}-${memo.language}-${memo.province}`;
      const matchId = paperMap.get(key);

      if (matchId) {
        const memoIndex = updatedFiles.findIndex(f => f.id === memo.id);
        const paperIndex = updatedFiles.findIndex(f => f.id === matchId);

        if (memoIndex !== -1 && paperIndex !== -1) {
          updatedFiles[memoIndex] = { ...updatedFiles[memoIndex], isMemoForId: matchId };
          updatedFiles[paperIndex] = { ...updatedFiles[paperIndex], linkedMemoId: memo.id };
          linksCreated++;
        }
      }
    });

    setBatchFiles(updatedFiles);
    toast({
      title: 'Auto-linking complete',
      description: `Successfully linked ${linksCreated} memos to their respective papers.`,
    });
  };

  const clearCompletedBatch = () => {
    setBatchFiles(prev => prev.filter(f => f.status !== 'completed'));
    toast({
      title: 'Cleared completed',
      description: 'All successfully analyzed papers have been removed from the list.',
    });
  };

  const clearAllBatch = () => {
    setBatchFiles([]);
    toast({
      title: 'Batch cleared',
      description: 'All papers have been removed from the batch list.',
    });
  };

  const handleBatchUpload = async () => {
    if (!user) return;

    const filesToUpload = batchFiles.some(f => f.selected)
      ? batchFiles.filter(f => f.selected && (f.status === 'completed' || f.status === 'error') && !f.has_watermark)
      : batchFiles.filter(f => (f.status === 'completed' || f.status === 'error') && !f.has_watermark);

    if (filesToUpload.length === 0) {
      toast({
        title: 'No documents ready',
        description: 'Please ensure documents are analyzed and selected before uploading',
        variant: 'destructive',
      });
      return;
    }

    // Validate that all files have a subject
    const missingSubject = filesToUpload.find(f => isMissingSubject(f));
    if (missingSubject) {
      toast({
        title: 'Missing subject',
        description: `Please select a subject for "${missingSubject.file.name}"`,
        variant: 'destructive',
      });
      return;
    }

    // Validate that all memos are linked to a paper
    const unlinkedMemo = filesToUpload.find(f => f.is_memo && !f.isMemoForId);
    if (unlinkedMemo && !hasAttemptedLinking) {
      toast({
        title: 'Unlinked memo',
        description: `Please link the memo "${unlinkedMemo.file.name}" to its respective paper before uploading.`,
        variant: 'destructive',
      });
      return;
    }

    setIsBatchUploading(true);
    setBatchUploadProgress(0);

    const uploadedRecords: Record<string, string> = {}; // batchId -> supabaseId
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;
    let successCount = 0;
    let failCount = 0;
    let completedCount = 0;
    const errors: string[] = [];

    // Pre-map subjects to avoid repeated database calls
    const subjectMap: Record<string, string> = {}; // subjectName -> id

    // Limit concurrency to 3 for compression and upload to avoid memory issues and timeouts
    await runWithConcurrency(filesToUpload, async (fileData) => {
      totalOriginalSize += fileData.file.size;

      try {
        // Use linked paper's metadata if this is a memo
        let targetMetadata = fileData;
        if (fileData.is_memo && fileData.isMemoForId) {
          const linkedPaper = filesToUpload.find(f => f.id === fileData.isMemoForId);
          if (linkedPaper) {
            targetMetadata = linkedPaper;
          }
        }

        // Step 1: Compress & Upload
        setBatchFiles(prev => prev.map(p => p.id === fileData.id ? { ...p, status: 'analyzing' as any } : p));

        const { compression, fileUrl } = await withRetry(async () => {
          console.log(`Compressing ${fileData.file.name}...`);
          const comp = await compressPDF(fileData.file);

          const url = await uploadCompressedPDF(
            supabase,
            comp.compressedBlob,
            fileData.file.name,
            user.id
          );

          return { compression: comp, fileUrl: url };
        }, 2, 2000);

        totalCompressedSize += compression.compressedSize;
        console.log(`Uploaded ${fileData.file.name}: ${formatFileSize(compression.originalSize)} -> ${formatFileSize(compression.compressedSize)}`);

        // Step 2: Subject ID
        const subjectName = targetMetadata.subject || targetMetadata.title?.split(' ')[0] || 'Unknown';
        let subjectId = subjectMap[subjectName];
        if (!subjectId) {
          subjectId = await withRetry(() => findOrCreateSubject(subjectName), 2, 1000) || '';
          if (subjectId) subjectMap[subjectName] = subjectId;
        }

        // Step 3: Insert Document
        const { data: docData, error: docError } = await withRetry(async () => {
          return await supabase
            .from('documents')
            .insert({
              title: fileData.is_memo ? `${targetMetadata.title} - Memo` : targetMetadata.title,
              subject_id: subjectId || null,
              grade: targetMetadata.grade,
              year: targetMetadata.year,
              month: targetMetadata.month,
              paper_number: targetMetadata.paper_number,
              curriculum: targetMetadata.curriculum as any,
              file_url: fileUrl,
              description: targetMetadata.description || null,
              is_past_paper: true,
              is_memo: fileData.is_memo,
              is_published: true,
              created_by: user.id,
              // @ts-ignore
              language: targetMetadata.language,
            } as any)
            .select()
            .single();
        }, 2, 1000);

        if (docError) throw docError;
        uploadedRecords[fileData.id] = docData.id;
        successCount++;
      } catch (error: any) {
        console.error(`Failed to upload ${fileData.file.name}:`, error);
        failCount++;
        errors.push(`${fileData.file.name}: ${error.message}`);
        // Update status to error so user can see it failed and why
        setBatchFiles(prev => prev.map(p => p.id === fileData.id ? { ...p, status: 'error' as any, error: error.message } : p));
      } finally {
        completedCount++;
        setBatchUploadProgress((completedCount / filesToUpload.length) * 100);
      }
    }, 3);

    try {
      // Step 4: Link memos
      const papersToLink = filesToUpload.filter(paper => paper.isMemoForId && uploadedRecords[paper.id] && uploadedRecords[paper.isMemoForId]);

      if (papersToLink.length > 0) {
        console.log(`Linking ${papersToLink.length} memos...`);
        await runWithConcurrency(papersToLink, async (paper) => {
          await withRetry(async () => {
            const { error: linkError } = await supabase
              .from('documents')
              .update({ memo_for_document_id: uploadedRecords[paper.isMemoForId!] })
              .eq('id', uploadedRecords[paper.id]);

            if (linkError) throw linkError;
          }, 2, 1000);
        }, 10);
      }

      if (failCount === 0) {
        toast({
          title: 'Batch upload complete',
          description: `Successfully uploaded ${successCount} documents. Saved ${formatFileSize(totalOriginalSize - totalCompressedSize)} in total.`,
        });
        setBatchFiles([]);
        setHasAttemptedLinking(false);
      } else {
        toast({
          title: 'Batch upload partial success',
          description: `Uploaded ${successCount} files, but ${failCount} failed. Check console for details.`,
          variant: 'destructive',
        });
        // Remove successful ones.
        setBatchFiles(prev => prev.filter(f => !uploadedRecords[f.id]));
      }

      fetchPastPapers();
      fetchAnalytics();
    } catch (error: any) {
      console.error('Finalizing batch upload error:', error);
      toast({
        title: 'Batch upload error',
        description: 'Completed uploads but failed to link some memos.',
        variant: 'destructive',
      });
    } finally {
      setIsBatchUploading(false);
    }
  };

  const removeFromBatch = (id: string) => {
    setBatchFiles(prev => prev.filter(f => f.id !== id));
  };

  const handlePaperFileSelect = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent, type: 'paper' | 'memo') => {
    let file: File | undefined;

    if ('dataTransfer' in e) {
      e.preventDefault();
      file = e.dataTransfer.files?.[0];
      setDragOverPaper(false);
      setDragOverMemo(false);
    } else {
      file = (e.target as HTMLInputElement).files?.[0];
    }

    if (file) {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        // Create a new file from the original using slice() to help prevent NotFoundError
        const clonedBlob = file.slice(0, file.size, file.type);
        const clonedFile = new File([clonedBlob], file.name, {
          type: file.type,
          lastModified: file.lastModified
        });

        if (type === 'paper') {
          setPaperFile(clonedFile);
        } else {
          setMemoFile(clonedFile);
        }
      } else {
        toast({
          title: 'Invalid file',
          description: 'Please upload a PDF file',
          variant: 'destructive',
        });
      }
    }
  };

  const handleUploadPastPaper = async () => {
    if (!user || !paperFile || !paperFormData.title || !paperFormData.subjectName || !paperFormData.curriculum) {
      toast({
        title: 'Missing information',
        description: 'Please select curriculum, fill in title, subject, and upload a past paper PDF',
        variant: 'destructive',
      });
      return;
    }

    // Capture current data for the background task
    const taskId = crypto.randomUUID();
    const taskTitle = paperFormData.title;
    const currentPaperFile = paperFile;
    const currentMemoFile = memoFile;
    const currentFormData = { ...paperFormData };

    // Create new task
    const newTask: UploadTask = {
      id: taskId,
      title: taskTitle,
      progress: 0,
      status: 'compressing-paper',
    };

    setActiveUploads(prev => [newTask, ...prev]);

    // Reset form immediately so user can start next upload
    setPaperFormData({
      title: '',
      subjectId: '',
      subjectName: '',
      grade: currentFormData.grade, // Keep grade and curriculum for convenience
      year: '',
      month: '',
      paperNumber: '',
      curriculum: currentFormData.curriculum,
      description: '',
      language: currentFormData.language,
    });
    setPaperFile(null);
    setMemoFile(null);

    const updateTask = (updates: Partial<UploadTask>) => {
      setActiveUploads(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    };

    try {
      // Step 1: Compress paper
      updateTask({ progress: 5, status: 'compressing-paper' });
      const paperCompression = await compressPDF(currentPaperFile, (p) => {
        updateTask({ progress: 5 + (p * 0.25) });
      });

      updateTask({ progress: 30, status: 'uploading' });

      // Step 2: Upload compressed paper
      const paperUrl = await uploadCompressedPDF(
        supabase,
        paperCompression.compressedBlob,
        currentPaperFile.name,
        user.id
      );

      updateTask({ progress: 45 });

      // Step 3: Compress and upload memo if provided
      let memoUrl: string | null = null;
      if (currentMemoFile) {
        updateTask({ status: 'compressing-memo' });
        const memoCompression = await compressPDF(currentMemoFile, (p) => {
          updateTask({ progress: 45 + (p * 0.2) });
        });

        updateTask({ progress: 65, status: 'uploading' });

        memoUrl = await uploadCompressedPDF(
          supabase,
          memoCompression.compressedBlob,
          currentMemoFile.name,
          user.id
        );
      }

      updateTask({ progress: 75, status: 'saving' });

      // Step 4: Find or create subject
      const subjectId = await findOrCreateSubject(currentFormData.subjectName);

      // Step 5: Save to documents table
      const { data: paperData, error: paperError } = await supabase
        .from('documents')
        .insert({
          title: currentFormData.title,
          subject_id: subjectId,
          grade: currentFormData.grade ? parseInt(currentFormData.grade) : null,
          year: currentFormData.year ? parseInt(currentFormData.year) : null,
          month: currentFormData.month || null,
          paper_number: currentFormData.paperNumber ? parseInt(currentFormData.paperNumber) : null,
          curriculum: currentFormData.curriculum as any,
          file_url: paperUrl,
          description: currentFormData.description || null,
          is_past_paper: true,
          is_memo: false,
          is_published: true,
          created_by: user.id,
          // @ts-ignore
          language: currentFormData.language,
        } as any)
        .select()
        .single();

      if (paperError) throw paperError;

      updateTask({ progress: 90 });

      // Insert the memo if provided, linked to the paper
      if (memoUrl && paperData) {
        const memoTitle = `${currentFormData.title} - Memo`;
        const { error: memoError } = await supabase
          .from('documents')
          .insert({
            title: memoTitle,
            subject_id: subjectId,
            grade: currentFormData.grade ? parseInt(currentFormData.grade) : null,
            year: currentFormData.year ? parseInt(currentFormData.year) : null,
            month: currentFormData.month || null,
            paper_number: currentFormData.paperNumber ? parseInt(currentFormData.paperNumber) : null,
            curriculum: currentFormData.curriculum as any,
            file_url: memoUrl,
            is_past_paper: true,
            is_memo: true,
            memo_for_document_id: paperData.id,
            is_published: true,
            created_by: user.id,
          });

        if (memoError) throw memoError;
      }

      updateTask({ progress: 100, status: 'done' });

      toast({
        title: 'Upload Complete!',
        description: `"${taskTitle}" uploaded successfully.`,
      });

      fetchPastPapers();

      // Remove completed task after 5 seconds
      setTimeout(() => {
        setActiveUploads(prev => prev.filter(t => t.id !== taskId));
      }, 5000);

    } catch (error: any) {
      console.error('Upload error:', error);
      updateTask({ status: 'error', error: error.message });
      toast({
        title: 'Upload Failed',
        description: `"${taskTitle}": ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handlePublishPaper = async (paperId: string) => {
    try {
      // Publish the paper
      await supabase
        .from('documents')
        .update({ is_published: true })
        .eq('id', paperId);

      // Also publish its memo if exists
      await supabase
        .from('documents')
        .update({ is_published: true })
        .eq('memo_for_document_id', paperId);

      toast({ title: 'Published', description: 'Past paper is now live!' });
      fetchPastPapers();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to publish', variant: 'destructive' });
    }
  };

  const handleUnpublishPaper = async (paperId: string) => {
    try {
      await supabase
        .from('documents')
        .update({ is_published: false })
        .eq('id', paperId);

      await supabase
        .from('documents')
        .update({ is_published: false })
        .eq('memo_for_document_id', paperId);

      toast({ title: 'Unpublished', description: 'Past paper is now hidden' });
      fetchPastPapers();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to unpublish', variant: 'destructive' });
    }
  };

  const handleDeletePaper = async (paperId: string) => {
    if (!confirm('Are you sure you want to delete this past paper and its memo?')) return;
    
    try {
      // Delete memo first
      await supabase
        .from('documents')
        .delete()
        .eq('memo_for_document_id', paperId);

      // Delete the paper
      await supabase
        .from('documents')
        .delete()
        .eq('id', paperId);

      toast({ title: 'Deleted', description: 'Past paper removed' });
      fetchPastPapers();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  const handleEditPaper = (paper: PastPaper) => {
    setEditingPaper(paper);
    setEditFormData({
      title: paper.title,
      subjectId: paper.subject_id || '',
      subjectName: paper.subjects?.name || '',
      grade: paper.grade?.toString() || '',
      year: paper.year?.toString() || '',
      month: paper.month || '',
      paperNumber: paper.paper_number?.toString() || '',
      curriculum: paper.curriculum || '',
      description: paper.description || '',
      language: (paper as any).language || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingPaper) return;

    setSavingEdit(true);
    try {
      console.log('Saving edit for paper:', editingPaper.id);

      // Find or create subject if changed or if name is provided
      let subjectId = editFormData.subjectId;

      const currentSubjectName = editingPaper.subjects?.name || '';
      const currentGrade = editingPaper.grade?.toString() || '';
      const currentCurriculum = editingPaper.curriculum || '';

      const gradeChanged = editFormData.grade !== currentGrade;
      const curriculumChanged = editFormData.curriculum !== currentCurriculum;
      const subjectNameChanged = editFormData.subjectName !== currentSubjectName;

      if (editFormData.subjectName && (subjectNameChanged || gradeChanged || curriculumChanged)) {
        console.log(`Subject context changed. Re-finding subject for "${editFormData.subjectName}"`);
        const foundId = await findOrCreateSubject(editFormData.subjectName, editFormData.curriculum);
        if (foundId) {
          subjectId = foundId;
        } else {
          throw new Error(`Could not find or create subject: ${editFormData.subjectName}`);
        }
      } else if (!editFormData.subjectName) {
        subjectId = null;
      }

      const updateData: any = {
        title: editFormData.title,
        subject_id: subjectId,
        grade: editFormData.grade ? parseInt(editFormData.grade) : null,
        year: editFormData.year ? parseInt(editFormData.year) : null,
        month: editFormData.month || null,
        paper_number: editFormData.paperNumber ? parseInt(editFormData.paperNumber) : null,
        curriculum: editFormData.curriculum as any,
        description: editFormData.description || null,
        language: editFormData.language || null,
      };

      console.log('Update data:', updateData);

      const { error: updateError } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', editingPaper.id);

      if (updateError) throw updateError;

      // Also update linked memo metadata
      const { error: memoError } = await supabase
        .from('documents')
        .update({
          title: `${editFormData.title} - Memo`,
          subject_id: subjectId,
          grade: updateData.grade,
          year: updateData.year,
          month: updateData.month,
          paper_number: updateData.paper_number,
          curriculum: updateData.curriculum,
          language: updateData.language,
        })
        .eq('memo_for_document_id', editingPaper.id);

      if (memoError) {
        console.warn('Could not update linked memo:', memoError);
        // We don't throw here to avoid blocking the main update if there's no memo
      }

      toast({ title: 'Saved', description: 'Past paper updated successfully' });
      setEditingPaper(null);
      fetchPastPapers();
    } catch (error: any) {
      console.error('Save edit error:', error);
      toast({ title: 'Error', description: error.message || 'Failed to save changes', variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const getUploadStatusText = (status: string) => {
    switch (status) {
      case 'compressing-paper':
        return 'Compressing past paper...';
      case 'compressing-memo':
        return 'Compressing memo...';
      case 'uploading':
        return 'Uploading files...';
      case 'saving':
        return 'Saving to database...';
      case 'done':
        return 'Upload complete!';
      case 'error':
        return 'Upload failed';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="single" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Single Upload
          </TabsTrigger>
          <TabsTrigger value="batch" className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            AI Batch Upload
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Manage & Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <GraduationCap className="w-5 h-5" />
                Upload Past Paper
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Upload past papers with memos manually.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              {/* Step 1: Curriculum Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Step 1: Select Curriculum *</Label>
                <Select
                  value={paperFormData.curriculum}
                  onValueChange={(value) => {
                    setPaperFormData({ 
                      ...paperFormData, 
                      curriculum: value, 
                      subjectId: '', 
                      subjectName: '' 
                    });
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Choose curriculum first" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRICULUM_OPTIONS.map((curr) => (
                      <SelectItem key={curr.value} value={curr.value}>
                        {curr.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Step 2: Grade Selection */}
              {paperFormData.curriculum && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Step 2: Select Grade *</Label>
                  <Select
                    value={paperFormData.grade}
                    onValueChange={(value) => {
                      setPaperFormData({ 
                        ...paperFormData, 
                        grade: value,
                        subjectId: '',
                        subjectName: ''
                      });
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Choose grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {GRADES.map((grade) => (
                        <SelectItem key={grade} value={grade.toString()}>
                          Grade {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Step 3: Subject Selection (Dynamic based on curriculum + grade) */}
              {paperFormData.curriculum && paperFormData.grade && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Step 3: Select Subject *</Label>
                  <Select
                    value={paperFormData.subjectName}
                    onValueChange={(value) => setPaperFormData({ ...paperFormData, subjectName: value })}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Choose subject" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {filteredSubjects.map((subject) => (
                        <SelectItem key={subject} value={subject}>
                          {subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Additional Details */}
              {paperFormData.subjectName && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                    <Label>Title (Auto-generated)</Label>
                    <Input
                      value={paperFormData.title}
                      onChange={(e) => setPaperFormData({ ...paperFormData, title: e.target.value })}
                      placeholder="e.g., Mathematics Paper 1 - Nov 2024"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Year *</Label>
                    <Select
                      value={paperFormData.year}
                      onValueChange={(value) => setPaperFormData({ ...paperFormData, year: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {YEARS.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Month *</Label>
                    <Select
                      value={paperFormData.month}
                      onValueChange={(value) => setPaperFormData({ ...paperFormData, month: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Paper Number *</Label>
                    <Select
                      value={paperFormData.paperNumber}
                      onValueChange={(value) => setPaperFormData({ ...paperFormData, paperNumber: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Paper" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAPER_NUMBERS.map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            Paper {num}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select
                      value={paperFormData.language}
                      onValueChange={(value) => setPaperFormData({ ...paperFormData, language: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Eng">English (Eng)</SelectItem>
                        <SelectItem value="Afri">Afrikaans (Afri)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                    <Label>Description (optional)</Label>
                    <Textarea
                      value={paperFormData.description}
                      onChange={(e) => setPaperFormData({ ...paperFormData, description: e.target.value })}
                      placeholder="Additional notes..."
                      className="h-10 min-h-[40px]"
                    />
                  </div>
                </div>
              )}

              {/* File Uploads */}
              {paperFormData.subjectName && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Past Paper PDF *</Label>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOverPaper(true); }}
                      onDragLeave={() => setDragOverPaper(false)}
                      onDrop={(e) => handlePaperFileSelect(e, 'paper')}
                      className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                      paperFile ? 'border-green-500 bg-green-50 dark:bg-green-950' :
                      dragOverPaper ? 'border-primary bg-primary/10' : 'border-border'
                    }`}>
                      {paperFile ? (
                        <div className="flex items-center justify-center gap-2">
                          <FileText className="w-6 h-6 text-green-600" />
                          <div className="text-left">
                            <p className="font-medium text-sm truncate max-w-[150px]">{paperFile.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(paperFile.size)}</p>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => setPaperFile(null)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <input type="file" accept=".pdf" onChange={(e) => handlePaperFileSelect(e, 'paper')} className="hidden" id="paper-upload" />
                          <Button variant="outline" size="sm" asChild>
                            <label htmlFor="paper-upload" className="cursor-pointer">Select Past Paper</label>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Memo PDF (Optional)</Label>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOverMemo(true); }}
                      onDragLeave={() => setDragOverMemo(false)}
                      onDrop={(e) => handlePaperFileSelect(e, 'memo')}
                      className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                      memoFile ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' :
                      dragOverMemo ? 'border-primary bg-primary/10' : 'border-border'
                    }`}>
                      {memoFile ? (
                        <div className="flex items-center justify-center gap-2">
                          <FileText className="w-6 h-6 text-blue-600" />
                          <div className="text-left">
                            <p className="font-medium text-sm truncate max-w-[150px]">{memoFile.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(memoFile.size)}</p>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => setMemoFile(null)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <input type="file" accept=".pdf" onChange={(e) => handlePaperFileSelect(e, 'memo')} className="hidden" id="memo-upload" />
                          <Button variant="outline" size="sm" asChild>
                            <label htmlFor="memo-upload" className="cursor-pointer">Select Memo</label>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Button */}
              <Button
                onClick={handleUploadPastPaper}
                disabled={!paperFile || !paperFormData.title || !paperFormData.subjectName || !paperFormData.curriculum || !paperFormData.year || !paperFormData.month || !paperFormData.paperNumber}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload & Compress
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                AI Batch Upload
              </CardTitle>
              <CardDescription>
                Upload multiple PDFs. Gemini AI will analyze the first page to extract metadata and detect watermarks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOverPaper(true); }}
                onDragLeave={() => setDragOverPaper(false)}
                onDrop={(e) => { e.preventDefault(); handleBatchFileSelect(e); }}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  dragOverPaper ? 'border-primary bg-primary/5 scale-[0.99]' : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Select multiple PDFs</h3>
                <p className="text-sm text-muted-foreground mb-4">Drag and drop or click to browse</p>
                <input
                  type="file"
                  multiple
                  accept=".pdf"
                  onChange={handleBatchFileSelect}
                  className="hidden"
                  id="batch-upload"
                />
                <Button variant="outline" asChild>
                  <label htmlFor="batch-upload" className="cursor-pointer">
                    Browse Files
                  </label>
                </Button>
              </div>

              {/* Batch List */}
              {batchFiles.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2 mr-2">
                        <Layers className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{batchFiles.length} files total</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant={batchFilter === 'all' ? "secondary" : "ghost"}
                          size="sm"
                          className="h-8 text-[11px] px-2"
                          onClick={() => { setBatchFilter('all'); setCurrentPage(1); }}
                        >
                          All ({batchFiles.length})
                        </Button>
                        <Button
                          variant={batchFilter === 'error' ? "destructive" : "ghost"}
                          size="sm"
                          className="h-8 text-[11px] px-2"
                          onClick={() => { setBatchFilter('error'); setCurrentPage(1); }}
                        >
                          Errors ({batchFiles.filter(f => f.status === 'error').length})
                        </Button>
                        <Button
                          variant={batchFilter === 'missing_subject' ? "destructive" : "ghost"}
                          size="sm"
                          className="h-8 text-[11px] px-2"
                          onClick={() => { setBatchFilter('missing_subject'); setCurrentPage(1); }}
                        >
                          Missing Subject ({batchFiles.filter(f => isMissingSubject(f)).length})
                        </Button>
                        <Button
                          variant={batchFilter === 'watermark' ? "destructive" : "ghost"}
                          size="sm"
                          className="h-8 text-[11px] px-2"
                          onClick={() => { setBatchFilter('watermark'); setCurrentPage(1); }}
                        >
                          Watermark ({batchFiles.filter(f => f.has_watermark).length})
                        </Button>
                        <Button
                          variant={batchFilter === 'unlinked_memos' ? "destructive" : "ghost"}
                          size="sm"
                          className="h-8 text-[11px] px-2"
                          onClick={() => { setBatchFilter('unlinked_memos'); setCurrentPage(1); }}
                        >
                          Unlinked Memos ({batchFiles.filter(f => f.is_memo && !f.isMemoForId).length})
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={analyzePapersWithAI}
                        disabled={isAnalyzing || batchFiles.filter(f => f.selected || batchFiles.every(ff => !ff.selected)).every(f => f.status !== 'pending' && f.status !== 'error')}
                      >
                        {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                        {batchFiles.some(f => f.status === 'error') ? 'Rerun / Run AI Analysis' : 'Run AI Analysis'}
                      </Button>
                      {batchFiles.some(f => f.status === 'error') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={rerunAllErrors}
                          disabled={isAnalyzing}
                          className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                        >
                          <RefreshCcw className="w-4 h-4 mr-2" />
                          Rerun All Errors
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={autoLinkMemos}
                        disabled={isAnalyzing || batchFiles.filter(f => f.status === 'completed').length < 2}
                      >
                        <Link2 className="w-4 h-4 mr-2" />
                        Link Papers & Memos
                      </Button>
                      <div className="flex gap-2 ml-auto">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={clearCompletedBatch}
                          disabled={isAnalyzing || isBatchUploading || !batchFiles.some(f => f.status === 'completed')}
                          className="text-xs h-8"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Clear Completed
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={clearAllBatch}
                          disabled={isAnalyzing || isBatchUploading || batchFiles.length === 0}
                          className="text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Clear All
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Bulk Edit Toolbar */}
                  {selectedCount > 0 && (
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          <h4 className="text-sm font-semibold">Bulk Edit: {selectedCount} items selected</h4>
                        </div>
                        <Button size="sm" onClick={applyBulkEdit}>Apply to Selected</Button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Curriculum</Label>
                          <Select
                            value={bulkMetadata.curriculum || ''}
                            onValueChange={(v) => setBulkMetadata(prev => ({ ...prev, curriculum: v as any, subject: null }))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                              {CURRICULUM_OPTIONS.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Grade</Label>
                          <Select
                            value={bulkMetadata.grade?.toString() || ''}
                            onValueChange={(v) => setBulkMetadata(prev => ({ ...prev, grade: parseInt(v), subject: null }))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                              {GRADES.map(g => <SelectItem key={g} value={g.toString()} className="text-xs">Gr {g}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Subject</Label>
                          <Select
                            value={bulkMetadata.subject || ''}
                            onValueChange={(v) => setBulkMetadata(prev => ({ ...prev, subject: v }))}
                            disabled={!bulkMetadata.curriculum || !bulkMetadata.grade}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {getRowSubjects(bulkMetadata.curriculum, bulkMetadata.grade).map((subject) => (
                                <SelectItem key={subject} value={subject} className="text-xs">
                                  {subject}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Year</Label>
                          <Select
                            value={bulkMetadata.year?.toString() || ''}
                            onValueChange={(v) => setBulkMetadata(prev => ({ ...prev, year: parseInt(v) }))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                              {YEARS.map(y => <SelectItem key={y} value={y.toString()} className="text-xs">{y}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Month</Label>
                          <Select
                            value={bulkMetadata.month || ''}
                            onValueChange={(v) => setBulkMetadata(prev => ({ ...prev, month: v }))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                              {MONTHS.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1 pt-4 flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="bulk-apply-memo"
                              checked={bulkMetadata.apply_memo}
                              onCheckedChange={(checked) => setBulkMetadata(prev => ({ ...prev, apply_memo: !!checked }))}
                            />
                            <Label htmlFor="bulk-apply-memo" className="text-xs font-bold text-primary">Apply Memo?</Label>
                            <Checkbox
                              id="bulk-is-memo"
                              checked={bulkMetadata.is_memo}
                              disabled={!bulkMetadata.apply_memo}
                              onCheckedChange={(checked) => setBulkMetadata(prev => ({ ...prev, is_memo: !!checked }))}
                            />
                            <Label htmlFor="bulk-is-memo" className="text-xs">Memo</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="bulk-apply-past-paper"
                              checked={bulkMetadata.apply_past_paper}
                              onCheckedChange={(checked) => setBulkMetadata(prev => ({ ...prev, apply_past_paper: !!checked }))}
                            />
                            <Label htmlFor="bulk-apply-past-paper" className="text-xs font-bold text-primary">Apply Type?</Label>
                            <Checkbox
                              id="bulk-is-past-paper"
                              checked={bulkMetadata.is_past_paper}
                              disabled={!bulkMetadata.apply_past_paper}
                              onCheckedChange={(checked) => setBulkMetadata(prev => ({ ...prev, is_past_paper: !!checked }))}
                            />
                            <Label htmlFor="bulk-is-past-paper" className="text-xs">Past Paper</Label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="border rounded-lg overflow-hidden overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[40px] px-2">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={(v) => toggleSelectAll(!!v)}
                            />
                          </TableHead>
                          <TableHead className="w-[200px]">File Name</TableHead>
                          <TableHead>Metadata</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedFiles.map((paper) => (
                          <TableRow
                            key={paper.id}
                            className={`
                              ${(paper.has_watermark || paper.status === 'error' || (paper.status === 'completed' && !paper.subject && !(paper.is_memo && paper.isMemoForId))) ? 'bg-destructive/5 border-l-2 border-l-destructive' : ''}
                              ${paper.selected ? 'bg-primary/5' : ''}
                            `}
                          >
                            <TableCell className="px-2">
                              <Checkbox
                                checked={paper.selected}
                                onCheckedChange={(v) => toggleSelectFile(paper.id, !!v)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex flex-col gap-1">
                                <span className="truncate max-w-[180px]" title={paper.file.name}>{paper.file.name}</span>
                                <span className="text-[10px] text-muted-foreground">{formatFileSize(paper.file.size)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {paper.status === 'completed' ? (
                                <div className="space-y-2 min-w-[250px] p-1">
                                  {paper.is_memo && paper.isMemoForId ? (
                                    <div className="p-3 bg-primary/5 rounded-lg border border-dashed border-primary/30 flex items-center gap-3">
                                      <div className="bg-primary/10 p-2 rounded-full">
                                        <Link2 className="w-4 h-4 text-primary" />
                                      </div>
                                      <div className="flex-1">
                                        <p className="text-[11px] font-bold text-primary uppercase tracking-wider">Linked to Paper</p>
                                        <p className="text-[10px] text-muted-foreground leading-tight">
                                          {batchFiles.find(f => f.id === paper.isMemoForId)?.file.name || 'Unknown Paper'}
                                        </p>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-[10px] px-2 hover:bg-destructive/10 hover:text-destructive"
                                        onClick={() => manualUnlink(paper.id)}
                                      >
                                        Unlink
                                      </Button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex gap-2">
                                        <div className="w-24">
                                          <Label className="text-[10px] text-muted-foreground">Curriculum</Label>
                                          <Select
                                            value={paper.curriculum || ''}
                                            onValueChange={(v) => updateBatchFile(paper.id, { curriculum: v as any })}
                                          >
                                            <SelectTrigger className="h-7 text-xs px-2">
                                              <SelectValue placeholder="Curr" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {CURRICULUM_OPTIONS.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="flex-1">
                                          <Label className="text-[10px] text-muted-foreground">Subject</Label>
                                          <Select
                                            value={paper.subject || ''}
                                            onValueChange={(v) => updateBatchFile(paper.id, { subject: v })}
                                          >
                                            <SelectTrigger className="h-7 text-xs px-2">
                                              <SelectValue placeholder="Choose subject" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-60">
                                              {getRowSubjects(paper.curriculum, paper.grade).map((subject) => (
                                                <SelectItem key={subject} value={subject} className="text-xs">
                                                  {subject}
                                                </SelectItem>
                                              ))}
                                              {paper.subject && !getRowSubjects(paper.curriculum, paper.grade).includes(paper.subject) && (
                                                <SelectItem value={paper.subject} className="text-xs">
                                                  {paper.subject}
                                                </SelectItem>
                                              )}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="w-20">
                                          <Label className="text-[10px] text-muted-foreground">Grade</Label>
                                          <Select
                                            value={paper.grade?.toString() || ''}
                                            onValueChange={(v) => updateBatchFile(paper.id, { grade: parseInt(v) })}
                                          >
                                            <SelectTrigger className="h-7 text-xs px-2">
                                              <SelectValue placeholder="Gr" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {GRADES.map(g => <SelectItem key={g} value={g.toString()} className="text-xs">Gr {g}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-3 gap-2">
                                        <div>
                                          <Label className="text-[10px] text-muted-foreground">Year</Label>
                                          <Select
                                            value={paper.year?.toString() || ''}
                                            onValueChange={(v) => updateBatchFile(paper.id, { year: parseInt(v) })}
                                          >
                                            <SelectTrigger className="h-7 text-xs px-1">
                                              <SelectValue placeholder="Yr" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {YEARS.map(y => <SelectItem key={y} value={y.toString()} className="text-xs">{y}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div>
                                          <Label className="text-[10px] text-muted-foreground">Month</Label>
                                          <Select
                                            value={paper.month || ''}
                                            onValueChange={(v) => updateBatchFile(paper.id, { month: v })}
                                          >
                                            <SelectTrigger className="h-7 text-xs px-1">
                                              <SelectValue placeholder="Mo" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {MONTHS.map(m => <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div>
                                          <Label className="text-[10px] text-muted-foreground">Paper #</Label>
                                          <Select
                                            value={paper.paper_number?.toString() || ''}
                                            onValueChange={(v) => updateBatchFile(paper.id, { paper_number: parseInt(v) })}
                                          >
                                            <SelectTrigger className="h-7 text-xs px-1">
                                              <SelectValue placeholder="P#" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {PAPER_NUMBERS.map(n => <SelectItem key={n} value={n.toString()} className="text-xs">P {n}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>

                                      {paper.is_memo && (
                                        <div className="pt-2 border-t border-dashed border-muted-foreground/20 mt-2">
                                          <Label className="text-[10px] text-muted-foreground">Link to Paper (Manual)</Label>
                                          <Select
                                            value={paper.isMemoForId || ""}
                                            onValueChange={(v) => manualLink(paper.id, v)}
                                          >
                                            <SelectTrigger className="h-7 text-xs px-2">
                                              <SelectValue placeholder="Select paper..." />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-48 overflow-y-auto">
                                              {batchFiles
                                                .filter(f =>
                                                  !f.is_memo &&
                                                  f.id !== paper.id &&
                                                  f.status === 'completed' &&
                                                  !f.linkedMemoId &&
                                                  (paper.subject ? f.subject === paper.subject : true) &&
                                                  (paper.grade ? f.grade === paper.grade : true) &&
                                                  (paper.curriculum ? f.curriculum === paper.curriculum : true)
                                                )
                                                .map(p => (
                                                  <SelectItem key={p.id} value={p.id} className="text-xs">
                                                    {p.file.name}
                                                  </SelectItem>
                                                ))
                                              }
                                              {batchFiles.filter(f =>
                                                !f.is_memo &&
                                                f.id !== paper.id &&
                                                f.status === 'completed' &&
                                                !f.linkedMemoId &&
                                                (paper.subject ? f.subject === paper.subject : true) &&
                                                (paper.grade ? f.grade === paper.grade : true) &&
                                                (paper.curriculum ? f.curriculum === paper.curriculum : true)
                                              ).length === 0 && (
                                                <div className="p-2 text-[10px] text-muted-foreground italic">No matching unlinked papers found</div>
                                              )}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      )}
                                    </>
                                  )}
                                  <p className="text-[10px] text-muted-foreground font-medium truncate pt-1" title={paper.title || ''}>
                                    Generated Title: <span className="text-primary">{paper.title || (paper.is_memo && paper.isMemoForId ? 'Synced with Paper' : 'Pending')}</span>
                                  </p>
                                </div>
                              ) : paper.status === 'analyzing' ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Analyzing...
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Pending analysis</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {paper.status === 'completed' && (
                                <div className="flex flex-col gap-1">
                                  <Select
                                    value={paper.is_memo ? 'memo' : 'paper'}
                                    onValueChange={(v) => updateBatchFile(paper.id, { is_memo: v === 'memo' })}
                                  >
                                    <SelectTrigger className="h-6 text-[10px] w-16 px-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="paper" className="text-[10px]">Paper</SelectItem>
                                      <SelectItem value="memo" className="text-[10px]">Memo</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {paper.linkedMemoId && (
                                    <div className="flex flex-col gap-1 mt-1">
                                      <div className="flex items-center gap-1 text-[10px] text-primary" title={batchFiles.find(f => f.id === paper.linkedMemoId)?.file.name}>
                                        <Link2 className="w-2 h-2" />
                                        Linked Memo
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 text-[9px] px-1 w-fit hover:bg-destructive/10 hover:text-destructive"
                                        onClick={() => manualUnlink(paper.id)}
                                      >
                                        Unlink
                                      </Button>
                                    </div>
                                  )}
                                  {paper.isMemoForId && !paper.is_memo && (
                                    <div className="flex items-center gap-1 text-[10px] text-primary">
                                      <Link2 className="w-2 h-2" />
                                      Linked
                                    </div>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {paper.has_watermark ? (
                                <div className="flex items-center gap-1 text-destructive font-medium text-xs">
                                  <AlertTriangle className="w-3 h-3" />
                                  Watermark: {paper.watermark_text}
                                </div>
                              ) : isMissingSubject(paper) ? (
                                <div className="flex items-center gap-1 text-destructive font-medium text-xs">
                                  <AlertTriangle className="w-3 h-3" />
                                  Missing Subject
                                </div>
                              ) : paper.status === 'completed' ? (
                                <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 text-[10px]">Ready</Badge>
                              ) : paper.status === 'error' ? (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1 text-destructive font-medium text-xs" title={paper.error}>
                                    <AlertTriangle className="w-3 h-3" />
                                    Analysis Error
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => rerunSingle(paper.id)}
                                    disabled={isAnalyzing}
                                    className="h-6 text-[9px] px-2 w-fit"
                                  >
                                    <RefreshCcw className="w-3 h-3 mr-1" /> Rerun
                                  </Button>
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">{paper.status}</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeFromBatch(paper.id)}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Controls */}
                  {batchFiles.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between px-2 py-4 border-t border-muted-foreground/10 bg-muted/20 rounded-b-lg">
                      <div className="text-xs text-muted-foreground">
                        Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, batchFiles.length)}</span> of <span className="font-medium">{batchFiles.length}</span> documents
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          Prev
                        </Button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                            .map((p, i, arr) => (
                              <div key={p} className="flex items-center gap-1">
                                {i > 0 && arr[i-1] !== p - 1 && <span className="text-muted-foreground px-1">...</span>}
                                <Button
                                  variant={currentPage === p ? "default" : "outline"}
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => setCurrentPage(p)}
                                >
                                  {p}
                                </Button>
                              </div>
                            ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {isBatchUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Compressing & Uploading batch...
                        </span>
                        <span>{Math.round(batchUploadProgress)}%</span>
                      </div>
                      <Progress value={batchUploadProgress} className="h-2" />
                    </div>
                  )}

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleBatchUpload}
                    disabled={isBatchUploading || isAnalyzing || (batchFiles.some(f => f.selected) ? !batchFiles.some(f => f.selected && (f.status === 'completed' || f.status === 'error') && !f.has_watermark) : !batchFiles.some(f => (f.status === 'completed' || f.status === 'error') && !f.has_watermark))}
                  >
                    {isBatchUploading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Upload {batchFiles.some(f => f.selected) ? batchFiles.filter(f => f.selected && (f.status === 'completed' || f.status === 'error') && !f.has_watermark).length : batchFiles.filter(f => (f.status === 'completed' || f.status === 'error') && !f.has_watermark).length} Verified Documents
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Bot className="w-5 h-5 text-primary" />
                  Past Paper Analytics
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Overview of uploaded papers per subject and grade
                </CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(analytics).length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground text-sm">No data available</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-secondary/30">
                          <TableHead className="text-xs font-bold uppercase py-2">Subject</TableHead>
                          {GRADES.map(g => (
                            <TableHead key={g} className="text-xs font-bold uppercase py-2 text-center">Grade {g}</TableHead>
                          ))}
                          <TableHead className="text-xs font-bold uppercase py-2 text-center">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(analytics).sort((a, b) => a[0].localeCompare(b[0])).map(([subject, grades]) => {
                          const subjectTotal = Object.values(grades).reduce((a, b) => a + b, 0);
                          return (
                            <TableRow key={subject}>
                              <TableCell
                                className={`font-medium text-xs py-2 cursor-pointer hover:text-primary transition-colors ${selectedSubject === subject ? 'text-primary' : ''}`}
                                onClick={() => {
                                  setSelectedSubject(selectedSubject === subject ? null : subject);
                                  setSelectedGrade(null);
                                  setListPage(1);
                                }}
                              >
                                {subject}
                              </TableCell>
                              {GRADES.map(g => (
                                <TableCell
                                  key={g}
                                  className={`text-center text-xs py-2 cursor-pointer hover:bg-secondary/20 transition-colors ${selectedSubject === subject && selectedGrade === g ? 'bg-secondary/40' : ''}`}
                                  onClick={() => {
                                    setSelectedSubject(subject);
                                    setSelectedGrade(g);
                                    setListPage(1);
                                  }}
                                >
                                  {grades[g] ? (
                                    <Badge variant={selectedSubject === subject && selectedGrade === g ? "default" : "secondary"} className="font-normal text-[10px]">
                                      {grades[g]}
                                    </Badge>
                                  ) : '-'}
                                </TableCell>
                              ))}
                              <TableCell className="text-center py-2">
                                <Badge className="bg-primary/10 text-primary font-bold text-[10px]">
                                  {subjectTotal}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="bg-primary/5 font-bold">
                          <TableCell className="py-2 text-xs">Total per Grade</TableCell>
                          {GRADES.map(g => {
                            const gradeTotal = Object.values(analytics).reduce((acc, grades) => acc + (grades[g] || 0), 0);
                            return (
                              <TableCell key={g} className="text-center py-2 text-xs">
                                {gradeTotal > 0 ? (
                                  <Badge variant="default" className="font-bold text-[10px]">
                                    {gradeTotal}
                                  </Badge>
                                ) : '-'}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center py-2">
                            <Badge className="bg-primary text-primary-foreground font-bold text-[10px]">
                              {Object.values(analytics).reduce((acc, grades) => acc + Object.values(grades).reduce((a, b) => a + b, 0), 0)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Uploaded Past Papers</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Manage and publish past papers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex flex-col sm:flex-row gap-4 items-end">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by title..."
                      className="pl-9 h-9"
                      value={paperSearchQuery}
                      onChange={(e) => {
                        setPaperSearchQuery(e.target.value);
                        setListPage(1);
                      }}
                    />
                  </div>
                  {(selectedSubject || selectedGrade) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedSubject(null);
                        setSelectedGrade(null);
                        setListPage(1);
                      }}
                      className="text-xs h-9"
                    >
                      Clear Filters <X className="ml-1 w-3 h-3" />
                    </Button>
                  )}
                </div>
                {isFetchingPapers ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">Loading papers...</p>
                  </div>
                ) : pastPapers.length === 0 ? (
                  <div className="text-center py-8 sm:py-12">
                    <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm">No past papers found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      {pastPapers.map((paper) => (
                        <div
                          key={paper.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-secondary/50 rounded-lg gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-medium text-foreground text-sm sm:text-base truncate">{paper.title}</h4>
                            {paper.is_memo && (
                              <Badge className="bg-amber-500/20 text-amber-700 text-xs">Memo</Badge>
                            )}
                            {paper.is_published ? (
                              <Badge className="bg-green-500/20 text-green-700 text-xs">Published</Badge>
                            ) : (
                              <Badge className="bg-gray-500/20 text-gray-700 text-xs">Draft</Badge>
                            )}
                            {paper.description && (
                              <Badge variant="outline" className="text-[10px] text-primary border-primary/20">
                                {paper.description}
                              </Badge>
                            )}
                          </div>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              {paper.subjects?.name || 'No subject'} • Grade {paper.grade || '?'} • {paper.year || '?'} • {paper.month || ''} • Paper {paper.paper_number || '?'} • {paper.curriculum || 'CAPS'} {paper.language && `• ${paper.language}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditPaper(paper)}
                              className="h-8"
                            >
                              <Edit2 className="w-4 h-4" />
                              <span className="sr-only sm:not-sr-only sm:ml-1">Edit</span>
                            </Button>
                            {paper.file_url && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(paper.file_url!, '_blank')}
                                className="h-8"
                              >
                                <Eye className="w-4 h-4" />
                                <span className="sr-only sm:not-sr-only sm:ml-1">View</span>
                              </Button>
                            )}
                            {paper.is_published ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUnpublishPaper(paper.id)}
                                className="h-8"
                              >
                                Unpublish
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handlePublishPaper(paper.id)}
                                className="h-8"
                              >
                                Publish
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeletePaper(paper.id)}
                              className="h-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPapers > LIST_ITEMS_PER_PAGE && (
                      <div className="flex items-center justify-between px-2 py-4 border-t border-muted-foreground/10">
                        <div className="text-xs text-muted-foreground">
                          Showing <span className="font-medium">{(listPage - 1) * LIST_ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(listPage * LIST_ITEMS_PER_PAGE, totalPapers)}</span> of <span className="font-medium">{totalPapers}</span> papers
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => setListPage(prev => Math.max(1, prev - 1))}
                            disabled={listPage === 1}
                          >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Prev
                          </Button>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: totalListPages }, (_, i) => i + 1)
                              .filter(p => p === 1 || p === totalListPages || Math.abs(p - listPage) <= 1)
                              .map((p, i, arr) => (
                                <div key={p} className="flex items-center gap-1">
                                  {i > 0 && arr[i-1] !== p - 1 && <span className="text-muted-foreground px-1">...</span>}
                                  <Button
                                    variant={listPage === p ? "default" : "outline"}
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setListPage(p)}
                                  >
                                    {p}
                                  </Button>
                                </div>
                              ))}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => setListPage(prev => Math.min(totalListPages, prev + 1))}
                            disabled={listPage === totalListPages}
                          >
                            Next
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingPaper} onOpenChange={() => setEditingPaper(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Past Paper</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Curriculum *</Label>
              <Select
                value={editFormData.curriculum}
                onValueChange={(value) => setEditFormData({ ...editFormData, curriculum: value, subjectName: '' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRICULUM_OPTIONS.map((curr) => (
                    <SelectItem key={curr.value} value={curr.value}>
                      {curr.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Grade</Label>
              <Select
                value={editFormData.grade}
                onValueChange={(value) => setEditFormData({ ...editFormData, grade: value, subjectName: '' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((grade) => (
                    <SelectItem key={grade} value={grade.toString()}>
                      Grade {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Subject *</Label>
              <Select
                value={editFormData.subjectName}
                onValueChange={(value) => setEditFormData({ ...editFormData, subjectName: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {editFilteredSubjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Title (Auto-generated)</Label>
              <Input
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Year</Label>
                <Select
                  value={editFormData.year}
                  onValueChange={(value) => setEditFormData({ ...editFormData, year: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Month</Label>
                <Select
                  value={editFormData.month}
                  onValueChange={(value) => setEditFormData({ ...editFormData, month: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Paper #</Label>
                <Select
                  value={editFormData.paperNumber}
                  onValueChange={(value) => setEditFormData({ ...editFormData, paperNumber: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPER_NUMBERS.map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        Paper {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Language</Label>
                <Select
                  value={editFormData.language}
                  onValueChange={(value) => setEditFormData({ ...editFormData, language: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Eng">English (Eng)</SelectItem>
                    <SelectItem value="Afri">Afrikaans (Afri)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingPaper(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PastPapersManager;

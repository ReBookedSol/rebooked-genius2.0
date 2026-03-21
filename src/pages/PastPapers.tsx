import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { motion } from 'framer-motion';
import { FileText, Search, Download, Eye, CheckCircle2, BookOpen, ChevronLeft, ArrowLeft, Calculator, Atom, Leaf, Globe, History, Briefcase, PenTool, Music, Drama, Languages, Beaker, Cpu, Palette, FileCheck, ClipboardEdit, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useAIContext } from '@/contexts/AIContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { getSubjectsByCurriculumAndGrade, type Curriculum } from '@/data/curricula';
import { PdfViewer } from '@/components/PdfViewer';
import { useToast } from '@/hooks/use-toast';
import { usePageAnimation } from '@/hooks/use-page-animation';
import { recordStudyActivity } from '@/utils/streak';
import { addWatermarkToPdf } from '@/lib/pdfWatermark';
import { useSubjectAnalytics } from '@/hooks/useSubjectAnalytics';
import { fetchPDFWithFreshSignedUrl, extractStoragePathFromSignedUrl } from '@/lib/pdfUrlManager';

interface Document {
  id: string;
  title: string;
  description: string;
  subject_id: string;
  curriculum: string;
  grade: number;
  year: number;
  paper_number: number;
  file_url: string;
  language?: string | null;
  is_memo?: boolean;
  memo_for_document_id?: string;
  subjects?: {
    name: string;
    code: string;
    color: string;
    icon_name: string;
  };
}

interface PaperAttempt {
  id: string;
  document_id: string;
  score: number;
  max_score: number;
  completed_at: string;
  user_entered_score?: boolean;
}

interface UserProfile {
  curriculum: 'CAPS' | 'IEB' | 'Cambridge' | null;
  grade: number | null;
  subjects: string[] | null;
}

interface SubjectCard {
  name: string;
  color: string;
  icon: React.ElementType;
  category: string;
}

// Mapping of curriculum names for conversion
const CURRICULUM_MAP: Record<string, Curriculum> = {
  'CAPS': 'caps',
  'IEB': 'ieb',
  'Cambridge': 'cambridge'
};

// Core/Compulsory subjects for each curriculum (for visual categorization)
const CORE_SUBJECT_KEYWORDS: Record<Curriculum, string[]> = {
  'caps': ['english', 'afrikaans', 'mathematics', 'life orientation'],
  'ieb': ['english', 'afrikaans', 'mathematics', 'life orientation'],
  'cambridge': ['english', 'mathematics']
};

// Determine if a subject is core/compulsory based on keywords
const isCoreSubject = (subjectName: string, curriculum: Curriculum): boolean => {
  const coreKeywords = CORE_SUBJECT_KEYWORDS[curriculum];
  return coreKeywords.some(keyword =>
    subjectName.toLowerCase().includes(keyword)
  );
};

// Subject icon and color mapping - supports all curricula subjects
const getSubjectMeta = (name: string): { icon: React.ElementType; color: string } => {
  const lowerName = name.toLowerCase();

  // Languages - includes all language variants
  if (lowerName.includes('english') || lowerName.includes('afrikaans') || lowerName.includes('french') ||
      lowerName.includes('spanish') || lowerName.includes('german') || lowerName.includes('portuguese') ||
      lowerName.includes('latin') || lowerName.includes('hebrew') || lowerName.includes('chinese') ||
      lowerName.includes('mandarin') || lowerName.includes('italian') || lowerName.includes('arabic') ||
      lowerName.includes('language') || lowerName.includes('xitsonga') || lowerName.includes('tshivenda') ||
      lowerName.includes('sesotho') || lowerName.includes('setswana') || lowerName.includes('sepedi') ||
      lowerName.includes('isizulu') || lowerName.includes('isixhosa') || lowerName.includes('isindbele') ||
      lowerName.includes('siswati')) {
    return { icon: Languages, color: '#F59E0B' };
  }

  // Mathematics - all variants
  if (lowerName.includes('math') || lowerName.includes('further')) {
    return { icon: Calculator, color: '#3B82F6' };
  }

  // Physical Sciences/Physics
  if (lowerName.includes('physics') || lowerName.includes('physical science')) {
    return { icon: Atom, color: '#8B5CF6' };
  }

  // Chemistry
  if (lowerName.includes('chemistry')) {
    return { icon: Beaker, color: '#EC4899' };
  }

  // Life Sciences/Biology
  if (lowerName.includes('biology') || lowerName.includes('life science') ||
      lowerName.includes('marine') || lowerName.includes('environmental')) {
    return { icon: Leaf, color: '#10B981' };
  }

  // Geography
  if (lowerName.includes('geography') || lowerName.includes('global perspective')) {
    return { icon: Globe, color: '#06B6D4' };
  }

  // History
  if (lowerName.includes('history')) {
    return { icon: History, color: '#F97316' };
  }

  // Business, Economics, Accounting
  if (lowerName.includes('business') || lowerName.includes('economics') ||
      lowerName.includes('accounting') || lowerName.includes('commerce') ||
      lowerName.includes('tourism') || lowerName.includes('hospitality')) {
    return { icon: Briefcase, color: '#6366F1' };
  }

  // Arts & Design
  if (lowerName.includes('art') || lowerName.includes('visual') || lowerName.includes('design') ||
      lowerName.includes('media studies') || lowerName.includes('craft')) {
    return { icon: Palette, color: '#EC4899' };
  }

  // Music
  if (lowerName.includes('music')) {
    return { icon: Music, color: '#A855F7' };
  }

  // Drama & Performing Arts
  if (lowerName.includes('drama') || lowerName.includes('dramatic') || lowerName.includes('theatre') ||
      lowerName.includes('performing')) {
    return { icon: Drama, color: '#EF4444' };
  }

  // Technology & Computer Science
  if (lowerName.includes('computer') || lowerName.includes('ict') || lowerName.includes('information') ||
      lowerName.includes('technology') || lowerName.includes('robotics') || lowerName.includes('applied')) {
    return { icon: Cpu, color: '#14B8A6' };
  }

  // Engineering
  if (lowerName.includes('engineering') || lowerName.includes('mechanical') ||
      lowerName.includes('electrical') || lowerName.includes('technical')) {
    return { icon: PenTool, color: '#64748B' };
  }

  // Default
  return { icon: BookOpen, color: '#6B7280' };
};

const PREDEFINED_ISSUES = [
  "Wrong memo linked",
  "Incorrect year or paper number",
  "Poor scan quality / Unreadable",
  "Wrong subject or curriculum",
  "Other"
];

const PastPapers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setAiContext } = useAIContext();
  const { shouldAnimate } = usePageAnimation('PastPapers');
  const { updateSubjectAnalytics } = useSubjectAnalytics();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [attempts, setAttempts] = useState<Record<string, PaperAttempt>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [subjectCards, setSubjectCards] = useState<SubjectCard[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [docCache, setDocCache] = useState<Record<string, Document[]>>({});
  const [showAllSubjects, setShowAllSubjects] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isNSCOverride, setIsNSCOverride] = useState(false);

  // Bug report dialog state
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<string>('');
  const [customReportMessage, setCustomReportMessage] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Result dialog state
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [resultScore, setResultScore] = useState('');
  const [resultMaxScore, setResultMaxScore] = useState('100');
  const [resultPaperId, setResultPaperId] = useState<string | null>(null);
  const [savingResult, setSavingResult] = useState(false);

  const handleReportBug = async () => {
    if (!user || !selectedDocument) return;

    const memo = getMemoForPaper(selectedDocument.id);
    let autoGeneratedMessage = `ISSUE: ${selectedIssue}\n\n`;

    if (selectedIssue === 'Other') {
      autoGeneratedMessage += `USER MESSAGE: ${customReportMessage}\n\n`;
    }

    autoGeneratedMessage += `DOCUMENT INFO:\n`;
    autoGeneratedMessage += `- Name: ${selectedDocument.title}\n`;
    autoGeneratedMessage += `- ID: ${selectedDocument.id}\n`;
    autoGeneratedMessage += `- Curriculum: ${selectedDocument.curriculum}\n`;
    autoGeneratedMessage += `- Grade: ${selectedDocument.grade}\n`;
    autoGeneratedMessage += `- Year: ${selectedDocument.year}\n`;

    if (memo) {
      autoGeneratedMessage += `\nLINKED MEMO INFO:\n`;
      autoGeneratedMessage += `- Name: ${memo.title}\n`;
      autoGeneratedMessage += `- ID: ${memo.id}\n`;
    }

    setIsSubmittingReport(true);
    try {
      const { error } = await supabase.from('support_tickets').insert({
        user_id: user.id,
        type: 'report',
        message: autoGeneratedMessage,
        status: 'open'
      });

      if (error) throw error;

      toast({
        title: "Report Submitted",
        description: "Thank you for helping us improve our database!",
      });
      setShowReportDialog(false);
      setSelectedIssue('');
      setCustomReportMessage('');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit report",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const renderReportDialog = () => (
    <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
      <DialogContent className="sm:max-w-[425px] overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            Report an Issue
          </DialogTitle>
          <DialogDescription>
            Help us fix issues with this past paper or memo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select the issue</Label>
            <Select value={selectedIssue} onValueChange={setSelectedIssue}>
              <SelectTrigger>
                <SelectValue placeholder="What's the problem?" />
              </SelectTrigger>
              <SelectContent>
                {PREDEFINED_ISSUES.map((issue) => (
                  <SelectItem key={issue} value={issue}>
                    {issue}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedIssue === 'Other' && (
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={customReportMessage}
                onChange={(e) => setCustomReportMessage(e.target.value)}
                placeholder="Describe the issue in more detail..."
              />
            </div>
          )}

          <div className="p-3 bg-muted/50 rounded-lg space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Information included in report:</p>
            <p className="text-xs text-foreground truncate">• Paper: {selectedDocument?.title}</p>
            {getMemoForPaper(selectedDocument?.id || '') && (
              <p className="text-xs text-foreground truncate">• Memo: {getMemoForPaper(selectedDocument?.id || '')?.title}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowReportDialog(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleReportBug}
            disabled={isSubmittingReport || !selectedIssue || (selectedIssue === 'Other' && !customReportMessage.trim())}
          >
            {isSubmittingReport ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertCircle className="w-4 h-4 mr-2" />}
            Submit Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const { isContentExpanded, setIsContentExpanded, isChatExpanded } = useSidebar();

  useEffect(() => {
    if (selectedDocument && selectedSubject) {
      setAiContext({
        currentPage: 'papers',
        location: `Viewing ${selectedDocument.is_memo ? 'memo' : 'paper'}: ${selectedDocument.title}`,
        activePaper: {
          subject: selectedSubject,
          year: selectedDocument.year?.toString() || 'unknown',
          paper: selectedDocument.paper_number?.toString() || 'unknown'
        },
        activeDocument: null,
        activeAnalytics: null
      });
    } else if (selectedSubject) {
       setAiContext({
        currentPage: 'papers',
        location: `Browsing papers for subject: ${selectedSubject}`,
        activePaper: {
          subject: selectedSubject,
          year: 'all',
          paper: 'all'
        },
        activeDocument: null,
        activeAnalytics: null
      });
    } else {
      setAiContext({
        currentPage: 'papers',
        location: 'Past Papers Subject Selection',
        activePaper: null,
        activeDocument: null,
        activeAnalytics: null
      });
    }
  }, [selectedDocument, selectedSubject, setAiContext]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // No cleanup needed currently
    };
  }, []);

  useEffect(() => {
    fetchUserProfile();
  }, [user]);

  useEffect(() => {
    if (userProfile) {
      loadSubjectsData();
      fetchUserAttempts();
    }
  }, [userProfile, showAllSubjects, isNSCOverride]);

  useEffect(() => {
    if (userProfile && selectedSubject) {
      fetchDocuments();
    } else if (!selectedSubject) {
      setDocuments([]);
    }
  }, [userProfile, selectedSubject]);

  const fetchUserProfile = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('curriculum, grade, subjects')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setUserProfile(data);
    } else {
      // Default to CAPS Grade 12 if no profile
      setUserProfile({ curriculum: 'CAPS', grade: 12, subjects: null });
    }
  };

  const fetchUserAttempts = async () => {
    if (!user) return;
    try {
      const { data: userAttempts, error: attemptError } = await supabase
        .from('past_paper_attempts')
        .select('document_id, score, max_score, completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });

      if (attemptError) throw attemptError;

      if (userAttempts) {
        const attemptsMap: Record<string, PaperAttempt> = {};
        userAttempts.forEach((attempt: any) => {
          if (!attemptsMap[attempt.document_id]) {
            attemptsMap[attempt.document_id] = attempt;
          }
        });
        setAttempts(attemptsMap);
      }
    } catch (error) {
      console.error('Error fetching user attempts:', error);
    }
  };

  const loadSubjectsData = async () => {
    if (!userProfile?.curriculum || userProfile.grade === null) return;

    setLoading(true);
    try {
      // 1. Determine which subjects should be shown
      const currentCurriculum = isNSCOverride ? 'CAPS' : userProfile.curriculum;
      const curriculumKey = CURRICULUM_MAP[currentCurriculum];
      if (!curriculumKey) return;

      const allSubjectsInCurriculum = getSubjectsByCurriculumAndGrade(
        curriculumKey,
        userProfile.grade.toString() as any
      );

      if (!allSubjectsInCurriculum || allSubjectsInCurriculum.length === 0) {
        setSubjectCards([]);
        return;
      }

      const enrolledSubjects = userProfile.subjects && userProfile.subjects.length > 0 && !isNSCOverride
        ? new Set(userProfile.subjects.map(s => s.trim()))
        : null;

      // Filter and prepare basic card data
      const baseCards: SubjectCard[] = [];
      allSubjectsInCurriculum.forEach(name => {
        if (showAllSubjects || isNSCOverride || !enrolledSubjects || enrolledSubjects.has(name)) {
          const meta = getSubjectMeta(name);
          const category = isCoreSubject(name, curriculumKey) ? 'compulsory' : 'elective';
          baseCards.push({
            name,
            color: meta.color,
            icon: meta.icon,
            category
          });
        }
      });

      setSubjectCards(baseCards);

    } catch (error) {
      console.error('Error loading subjects data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    if (!userProfile || !selectedSubject) return;

    try {
      const currentCurriculum = isNSCOverride ? 'CAPS' : userProfile.curriculum;
      const currentGrade = userProfile.grade;
      const cacheKey = `${currentCurriculum}-${currentGrade}-${selectedSubject}`;

      if (docCache[cacheKey]) {
        setDocuments(docCache[cacheKey]);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Step 1: Look up the subject_id by name
      const { data: subjectData, error: subjectError } = await supabase
        .from('subjects')
        .select('id')
        .eq('name', selectedSubject)
        .maybeSingle();

      if (subjectError) {
        console.error('[PastPapers] Error looking up subject:', subjectError);
      } else if (subjectData?.id) {
        console.log('[PastPapers] Found subject_id:', subjectData.id, 'for subject:', selectedSubject);
      } else {
        console.warn('[PastPapers] No subject_id found for:', selectedSubject);
      }

      // Step 2: Build base query with subject_id filter
      let query = supabase
        .from('documents')
        .select(`
          *,
          subjects (id, name, code, color, icon_name)
        `)
        .eq('is_past_paper', true)
        .eq('is_published', true)
        .eq('curriculum', currentCurriculum)
        .eq('grade', currentGrade);

      // Add subject_id filter if found
      if (subjectData?.id) {
        query = query.eq('subject_id', subjectData.id);
      }

      let { data: allDocs, error: fetchError } = await query
        .order('year', { ascending: false });

      // Fallback 1: if no papers found with subject_id filter, try without is_published
      // to catch papers with missing metadata
      if (!fetchError && (!allDocs || allDocs.length === 0) && subjectData?.id) {
        console.log('[PastPapers] Fallback 1 - No published papers with subject_id, trying without is_published...');
        let fallbackQuery1 = supabase
          .from('documents')
          .select(`
            *,
            subjects (id, name, code, color, icon_name)
          `)
          .eq('is_past_paper', true)
          .eq('curriculum', currentCurriculum)
          .eq('grade', currentGrade)
          .eq('subject_id', subjectData.id);

        const { data: allDocsFallback } = await fallbackQuery1
          .order('year', { ascending: false });

        if (allDocsFallback && allDocsFallback.length > 0) {
          allDocs = allDocsFallback;
          console.log('[PastPapers] Fallback 1 - Found', allDocs.length, 'unpublished papers with subject_id');
        }
      }

      // Fallback 2: if still no papers, search by subject_id regardless of curriculum/grade
      // This catches papers that may have mismatched metadata
      if (!fetchError && (!allDocs || allDocs.length === 0) && subjectData?.id) {
        console.log('[PastPapers] Fallback 2 - No papers found, trying subject_id across all curricula...');
        const { data: allDocsFallback2 } = await supabase
          .from('documents')
          .select(`
            *,
            subjects (id, name, code, color, icon_name)
          `)
          .eq('is_past_paper', true)
          .eq('subject_id', subjectData.id)
          .order('year', { ascending: false });

        if (allDocsFallback2 && allDocsFallback2.length > 0) {
          allDocs = allDocsFallback2;
          console.log('[PastPapers] Fallback 2 - Found', allDocs.length, 'papers across all curricula with subject_id');
        }
      }

      // Fallback 3: if subject_id lookup failed, fall back to title/description matching
      // This ensures we catch papers that don't have subject_id properly set
      if (!fetchError && (!allDocs || allDocs.length === 0) && !subjectData?.id) {
        console.log('[PastPapers] Fallback 3 - No subject_id found, using client-side title/description matching...');
        const { data: allDocsFallback3 } = await supabase
          .from('documents')
          .select(`
            *,
            subjects (id, name, code, color, icon_name)
          `)
          .eq('is_past_paper', true)
          .eq('is_published', true)
          .eq('curriculum', currentCurriculum)
          .eq('grade', currentGrade)
          .order('year', { ascending: false });

        if (allDocsFallback3 && allDocsFallback3.length > 0) {
          allDocs = allDocsFallback3;
          console.log('[PastPapers] Fallback 3 - Will filter client-side, found', allDocs.length, 'papers for curriculum/grade');
        }
      }

      if (fetchError) throw fetchError;

      // Log detailed information about what we fetched
      console.log('[PastPapers] Fetch complete:', {
        subjectId: subjectData?.id || 'not found',
        subject: selectedSubject,
        curriculum: currentCurriculum,
        grade: currentGrade,
        docsCount: allDocs?.length || 0,
      });

      if (!allDocs || allDocs.length === 0) {
        console.warn('[PastPapers] No papers found for:', { subject: selectedSubject, curriculum: currentCurriculum, grade: currentGrade, subjectId: subjectData?.id });
      }

      const subjectLower = selectedSubject.toLowerCase();

      // If we used subject_id filtering and got results, use them as-is
      // Otherwise, apply client-side filtering as fallback
      let filtered = allDocs || [];

      if (!subjectData?.id) {
        // Client-side filtering when subject_id is not available
        // Filter documents that belong to this subject using robust matching logic
        filtered = (allDocs || []).filter(doc => {
          const docSubjectName = doc.subjects?.name?.toLowerCase();
          const docTitle = doc.title.toLowerCase();
          const docDescription = doc.description?.toLowerCase() || '';

          // 1. Direct match by subject name linked in DB
          if (docSubjectName === subjectLower) return true;

          // 2. Check if DB subject name is a partial match
          if (docSubjectName && (subjectLower.includes(docSubjectName) || docSubjectName.includes(subjectLower))) {
            // Be careful with overlapping names like "Mathematics" and "Mathematical Literacy"
            const isMathOverlap = (docSubjectName === 'mathematics' && subjectLower === 'mathematical literacy') ||
                                 (docSubjectName === 'mathematical literacy' && subjectLower === 'mathematics');
            if (!isMathOverlap) return true;
          }

          // 3. Keyword match in title
          if (docTitle.includes(subjectLower)) return true;

          // 4. Match by common abbreviations in title
          if (subjectLower === 'mathematics' && (docTitle.includes('maths') || docTitle.includes('math '))) {
            // Ensure it's not Mathematical Literacy
            if (!docTitle.includes('lit')) return true;
          }
          if (subjectLower === 'mathematical literacy' &&
              (docTitle.includes('maths lit') || docTitle.includes('math lit') ||
               docTitle.includes('maths literacy') || docTitle.includes('math literacy'))) {
            return true;
          }

          if (subjectLower.includes('english home language') && (docTitle.includes('english hl') || docTitle.includes('eng hl'))) return true;
          if (subjectLower.includes('english first additional language') && (docTitle.includes('english fal') || docTitle.includes('eng fal'))) return true;

          if (subjectLower.includes('afrikaans home language') && (docTitle.includes('afrikaans hl') || docTitle.includes('afr hl'))) return true;
          if (subjectLower.includes('afrikaans first additional language') && (docTitle.includes('afrikaans fal') || docTitle.includes('afr fal'))) return true;

          // 5. Match by subject code if available
          if (doc.subjects?.code && docTitle.includes(doc.subjects.code.toLowerCase())) return true;

          // 6. Description match
          if (docDescription.includes(subjectLower)) return true;

          return false;
        });

        console.log('[PastPapers] Client-side filtering applied:', {
          before: allDocs?.length || 0,
          after: filtered.length,
        });
      } else {
        console.log('[PastPapers] Using server-side subject_id filtering:', {
          filteredCount: filtered.length,
        });
      }

      // Ensure uniqueness and sort
      const uniqueDocs = Array.from(new Map(filtered.map(doc => [doc.id, doc])).values());
      uniqueDocs.sort((a, b) => (b.year || 0) - (a.year || 0));

      setDocuments(uniqueDocs);
      setDocCache(prev => ({ ...prev, [cacheKey]: uniqueDocs }));
    } catch (error) {
      const errorMessage = (error as any)?.message || (error as any)?.error_description || String(error);
      console.error('Error fetching documents:', errorMessage, error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.subjects?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesYear = selectedYear === 'all' || doc.year?.toString() === selectedYear;
    // Match by subject name (case-insensitive) OR by subject_id
    const matchesSubject = !selectedSubject ||
      (doc.subjects?.name?.toLowerCase() === selectedSubject.toLowerCase() ||
      doc.title.toLowerCase().includes(selectedSubject.toLowerCase()) ||
      (selectedSubject.toLowerCase() === 'mathematics' && (doc.title.toLowerCase().includes('maths') || doc.title.toLowerCase().includes('math '))) ||
      (selectedSubject.toLowerCase() === 'mathematical literacy' && (doc.title.toLowerCase().includes('maths lit') || doc.title.toLowerCase().includes('math lit'))) ||
      (selectedSubject.toLowerCase().includes('english home language') && (doc.title.toLowerCase().includes('english hl') || doc.title.toLowerCase().includes('eng hl'))) ||
      (selectedSubject.toLowerCase().includes('english first additional language') && (doc.title.toLowerCase().includes('english fal') || doc.title.toLowerCase().includes('eng fal'))) ||
      (selectedSubject.toLowerCase().includes('afrikaans home language') && (doc.title.toLowerCase().includes('afrikaans hl') || doc.title.toLowerCase().includes('afr hl'))) ||
      (selectedSubject.toLowerCase().includes('afrikaans first additional language') && (doc.title.toLowerCase().includes('afrikaans fal') || doc.title.toLowerCase().includes('afr fal'))));

    // Only show main papers in the list, memos are shown alongside papers
    return !doc.is_memo && matchesSearch && matchesYear && matchesSubject;
  });

  const years = [...new Set(documents.map((d) => d.year).filter(Boolean))].sort((a, b) => b - a);

  const getScoreColor = (score: number, max: number) => {
    const percentage = (score / max) * 100;
    if (percentage >= 80) return 'text-green-600 bg-green-100 dark:bg-green-900/30';
    if (percentage >= 60) return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30';
    return 'text-red-600 bg-red-100 dark:bg-red-900/30';
  };

  const getCurriculumLabel = () => {
    if (!userProfile) return '';
    const curriculum = isNSCOverride ? 'CAPS (NSC)' : userProfile.curriculum;
    return `Grade ${userProfile.grade} ${curriculum}`;
  };

  const selectedMeta = selectedSubject ? getSubjectMeta(selectedSubject) : null;

  const renderPaperSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="h-48 overflow-hidden">
          <CardContent className="p-4 lg:p-6 flex flex-col h-full space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-muted animate-pulse" />
              <div className="flex gap-2">
                <div className="w-12 h-5 rounded-full bg-muted animate-pulse" />
                <div className="w-8 h-5 rounded-full bg-muted animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
            </div>
            <div className="flex gap-2 mt-auto">
              <div className="h-8 bg-muted rounded flex-1 animate-pulse" />
              <div className="h-8 bg-muted rounded flex-1 animate-pulse" />
              <div className="h-8 bg-muted rounded w-8 animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderSubjectSkeleton = () => (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i} className="h-32 flex flex-col items-center justify-center p-4 space-y-3">
          <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-xl bg-muted animate-pulse" />
          <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
          <div className="h-2 bg-muted rounded w-1/3 animate-pulse" />
        </Card>
      ))}
    </div>
  );

  // Components that are shared between views
  const renderResultDialog = () => (
    <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter Your Result</DialogTitle>
          <DialogDescription>
            Record your score after completing this past paper with the memo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Your Score</Label>
              <Input
                type="number"
                value={resultScore}
                onChange={(e) => setResultScore(e.target.value)}
                placeholder="e.g., 75"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Total Marks (paper is out of)</Label>
              <Input
                type="number"
                value={resultMaxScore}
                onChange={(e) => setResultMaxScore(e.target.value)}
                placeholder="e.g., 150"
                min="1"
              />
            </div>
          </div>
          {resultScore && resultMaxScore && (
            <div className="p-3 bg-primary/5 rounded-lg text-center">
              <p className="text-lg font-bold text-primary">
                {Math.round((parseInt(resultScore) / parseInt(resultMaxScore)) * 100)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {parseInt(resultScore)} out of {parseInt(resultMaxScore)}
              </p>
            </div>
          )}
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <span className="text-lg">🤥</span>
            <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
              Remember — lying never helps. Be honest with your marks!
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowResultDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveResult} disabled={savingResult || resultScore === ''}>
            {savingResult ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ClipboardEdit className="w-4 h-4 mr-2" />}
            Save Result
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Save result entry
  const handleSaveResult = async () => {
    if (!user || !resultPaperId || resultScore === '') return;

    const scoreNum = parseFloat(resultScore);
    const maxScoreNum = parseFloat(resultMaxScore) || 100;

    if (isNaN(scoreNum) || isNaN(maxScoreNum) || maxScoreNum <= 0) {
      toast({
        title: 'Invalid input',
        description: 'Please enter valid numbers for scores.',
        variant: 'destructive'
      });
      return;
    }

    const percentage = (scoreNum / maxScoreNum) * 100;

    setSavingResult(true);
    try {
      // 1. Save the attempt
      const { data: savedData, error } = await supabase.from('past_paper_attempts').insert({
        user_id: user.id,
        document_id: resultPaperId,
        score: scoreNum,
        max_score: maxScoreNum,
        completed_at: new Date().toISOString(),
        user_entered_score: true,
      }).select().single();

      if (error) throw error;

      // Update local state
      if (savedData) {
        setAttempts(prev => ({ ...prev, [resultPaperId]: savedData }));
      }

      // 2. Update overall study analytics
      const todayStr = new Date().toISOString().split('T')[0];
      const doc = documents.find(d => d.id === resultPaperId);
      let analyticsQuery = supabase
        .from('study_analytics')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', todayStr);
      
      if (doc?.subject_id) {
        analyticsQuery = analyticsQuery.eq('subject_id', doc.subject_id);
      } else {
        analyticsQuery = analyticsQuery.is('subject_id', null);
      }
      
      const { data: existing } = await analyticsQuery.maybeSingle();

      if (existing) {
        await supabase.from('study_analytics').update({
          tests_attempted: (existing.tests_attempted || 0) + 1,
          average_score: existing.tests_attempted
            ? ((existing.average_score || 0) * existing.tests_attempted + percentage) / (existing.tests_attempted + 1)
            : percentage,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
      } else {
        await supabase.from('study_analytics').insert({
          user_id: user.id,
          date: todayStr,
          subject_id: doc?.subject_id || null,
          tests_attempted: 1,
          average_score: percentage,
        });
      }

      // 3. Update subject-based analytics if document has a subject
      if (doc?.subject_id) {
        updateSubjectAnalytics(doc.subject_id, true).catch(err =>
          console.error('Error updating subject analytics:', err)
        );
      }

      setShowResultDialog(false);
      setResultScore('');
      setResultMaxScore('100');
      setResultPaperId(null);

      toast({ title: 'Success', description: 'Your result has been saved!' });

      // Track in activity streak
      recordStudyActivity(user.id, 'past_paper_complete').catch(console.error);
    } catch (error: any) {
      console.error('Error saving result:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSavingResult(false);
    }
  };

  // Get memo for a paper
  const getMemoForPaper = (paperId: string) => {
    return documents.find(d => d.memo_for_document_id === paperId);
  };

  // Get paper for a memo
  const getPaperForMemo = (memoForDocId: string) => {
    return documents.find(d => d.id === memoForDocId);
  };

  const handleDownload = async (doc: Document, type: 'paper' | 'memo' | 'both') => {
    const download = async (url: string, filename: string) => {
      try {
        // Extract storage path for potential signed URL refresh on 400 errors
        const storagePath = extractStoragePathFromSignedUrl(url);

        // Fetch PDF with automatic signed URL regeneration if expired
        const fetchedBlob = await fetchPDFWithFreshSignedUrl(url, storagePath);
        const arrayBuffer = await fetchedBlob.arrayBuffer();
        
        // Add watermark to PDF
        let finalBytes: Uint8Array;
        try {
          finalBytes = await addWatermarkToPdf(arrayBuffer);
        } catch {
          // If watermarking fails, download original
          finalBytes = new Uint8Array(arrayBuffer);
        }
        
        const blob = new Blob([finalBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        const blobUrl = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = blobUrl;
        const finalFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
        a.download = finalFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
      } catch (error) {
        console.error('Download failed:', error);
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    };

    const memo = getMemoForPaper(doc.id);

    toast({
      title: "Download Started",
      description: `Preparing your ${type === 'both' ? 'files' : type}...`,
    });

    if (type === 'paper' || type === 'both') {
      if (doc.file_url) await download(doc.file_url, doc.title);
    }

    if (type === 'memo' || type === 'both') {
      if (memo?.file_url) {
        // Add a delay for the second download if "both"
        if (type === 'both') {
          setTimeout(() => download(memo.file_url, memo.title), 500);
        } else {
          await download(memo.file_url, memo.title);
        }
      }
    }
  };

  if (userProfile?.curriculum && userProfile.curriculum !== 'CAPS' && !isNSCOverride) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6 max-w-lg"
          >
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8">
              <BookOpen className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              {userProfile.curriculum} Past Papers Coming Soon
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              We currently do not have {userProfile.curriculum} past papers yet. We are working on it.
            </p>
            <div className="flex flex-col items-center gap-4 pt-4">
              <Button
                onClick={() => setIsNSCOverride(true)}
                className="gap-2 px-8"
              >
                Visit NSC past papers
              </Button>
              <Badge variant="outline" className="px-6 py-2 border-primary/30 text-primary bg-primary/5 font-semibold text-sm animate-pulse">
                Coming Soon 🚀
              </Badge>
            </div>
          </motion.div>
        </div>
      </AppLayout>
    );
  }

  if (selectedDocument && selectedSubject) {
    const memo = getMemoForPaper(selectedDocument.id);
    const existingAttempt = attempts[selectedDocument.id];

    return (
      <AppLayout noPadding>
        <div className="h-full flex flex-col min-h-0 pb-16 lg:pb-0">
          {/* Header - compact on mobile */}
          <div className="border-b px-3 sm:px-6 py-2 sm:py-4 flex items-center justify-between bg-background">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  setSelectedDocument(null);
                }}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-semibold text-foreground flex items-center gap-2 truncate">
                  {selectedMeta && (
                    <div
                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${selectedMeta.color}20` }}
                    >
                      <selectedMeta.icon className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: selectedMeta.color }} />
                    </div>
                  )}
                  <span className="truncate">{selectedDocument.title}</span>
                </h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{getCurriculumLabel()}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {existingAttempt && (
                <Badge className={cn("text-[10px] sm:text-xs px-1.5 sm:px-2", getScoreColor(Number(existingAttempt.score), Number(existingAttempt.max_score)))}>
                  {existingAttempt.score}/{existingAttempt.max_score} ({Math.round((Number(existingAttempt.score) / Number(existingAttempt.max_score)) * 100)}%)
                </Badge>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReportDialog(true);
                }}
                className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs"
              >
                <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Report Bug</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  const paperId = selectedDocument.is_memo
                    ? (selectedDocument.memo_for_document_id || selectedDocument.id)
                    : selectedDocument.id;
                  setResultPaperId(paperId);
                  setResultMaxScore(existingAttempt?.max_score?.toString() || '100');
                  setShowResultDialog(true);
                }}
                className="gap-1 h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs"
              >
                <ClipboardEdit className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{existingAttempt ? 'Update Mark' : 'Add Mark'}</span>
                <span className="sm:hidden">{existingAttempt ? 'Mark' : 'Mark'}</span>
              </Button>
            </div>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 min-h-0 overflow-y-auto transition-none w-full">
            {selectedDocument.is_memo && (
              <div className="bg-primary/5 border-b px-6 py-2 flex items-center justify-center gap-4">
                <span className="text-xs font-medium text-muted-foreground italic">You are viewing the MEMORANDUM</span>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    const paper = getPaperForMemo(selectedDocument.memo_for_document_id!);
                    if (paper) setSelectedDocument(paper);
                  }}
                  className="h-auto p-0 text-primary font-bold hover:no-underline"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to past paper
                </Button>
              </div>
            )}
            <PdfViewer fileUrl={selectedDocument.file_url} />
          </div>

          {/* Memo Available Button */}
          {memo && (
            <div className="flex justify-center p-4 bg-background border-t">
              <Button
                variant="secondary"
                onClick={() => setSelectedDocument(memo)}
                className="gap-2"
              >
                <FileCheck className="w-4 h-4" />
                Memo Available
              </Button>
            </div>
          )}

          {renderResultDialog()}
          {renderReportDialog()}
        </div>
      </AppLayout>
    );
  }

  // Subject Cards View
  if (!selectedSubject) {
    return (
      <AppLayout>
        <div className="space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"
          >
            <div>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Past Papers</h1>
              <p className="text-muted-foreground mt-1 text-sm lg:text-base">
                {getCurriculumLabel()} {showAllSubjects ? '• Showing all subjects' : userProfile?.subjects && userProfile.subjects.length > 0 ? '• Filtered by enrolled subjects' : ''} • Select a subject to view papers
              </p>
            </div>
            {userProfile?.subjects && userProfile.subjects.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant={!showAllSubjects ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowAllSubjects(false)}
                  className="whitespace-nowrap"
                >
                  My Subjects
                </Button>
                <Button
                  variant={showAllSubjects ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowAllSubjects(true)}
                  className="whitespace-nowrap"
                >
                  All Subjects
                </Button>
              </div>
            )}
          </motion.div>

          {/* Compulsory Subjects */}
          {loading && subjectCards.length === 0 ? (
            renderSubjectSkeleton()
          ) : subjectCards.filter(s => s.category === 'compulsory').length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                Core Subjects
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
                {subjectCards.filter(s => s.category === 'compulsory').map((subject, index) => {
                  const Icon = subject.icon;
                  return (
                    <motion.div
                      key={subject.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <Card 
                        className="cursor-pointer hover:shadow-hover transition-all hover:scale-[1.02] h-full"
                        onClick={() => setSelectedSubject(subject.name)}
                      >
                        <CardContent className="p-3 lg:p-4 flex flex-col items-center text-center">
                          <div 
                            className="w-12 h-12 lg:w-14 lg:h-14 rounded-xl flex items-center justify-center mb-2 lg:mb-3"
                            style={{ backgroundColor: `${subject.color}20` }}
                          >
                            <Icon className="w-6 h-6 lg:w-7 lg:h-7" style={{ color: subject.color }} />
                          </div>
                          <h3 className="font-semibold text-xs lg:text-sm text-foreground line-clamp-2">
                            {subject.name}
                          </h3>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Elective Subjects */}
          {subjectCards.filter(s => s.category === 'elective').length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                Elective Subjects
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
                {subjectCards.filter(s => s.category === 'elective').map((subject, index) => {
                  const Icon = subject.icon;
                  return (
                    <motion.div
                      key={subject.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + index * 0.02 }}
                    >
                      <Card 
                        className="cursor-pointer hover:shadow-hover transition-all hover:scale-[1.02] h-full"
                        onClick={() => setSelectedSubject(subject.name)}
                      >
                        <CardContent className="p-3 lg:p-4 flex flex-col items-center text-center">
                          <div 
                            className="w-12 h-12 lg:w-14 lg:h-14 rounded-xl flex items-center justify-center mb-2 lg:mb-3"
                            style={{ backgroundColor: `${subject.color}20` }}
                          >
                            <Icon className="w-6 h-6 lg:w-7 lg:h-7" style={{ color: subject.color }} />
                          </div>
                          <h3 className="font-semibold text-xs lg:text-sm text-foreground line-clamp-2">
                            {subject.name}
                          </h3>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Empty State */}
          {subjectCards.length === 0 && !loading && (
            <div className="text-center py-12 bg-muted/30 rounded-3xl border-2 border-dashed border-muted p-8">
              <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <BookOpen className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">
                {isNSCOverride
                  ? 'No NSC subjects found for your grade'
                  : (userProfile?.curriculum === 'IEB' || userProfile?.curriculum === 'Cambridge')
                    ? `${userProfile.curriculum} Support Coming Soon`
                    : 'No subjects found'}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto text-sm lg:text-base leading-relaxed">
                {isNSCOverride
                  ? 'Try selecting "All Subjects" or check your grade in settings.'
                  : (userProfile?.curriculum === 'IEB' || userProfile?.curriculum === 'Cambridge')
                    ? `At this moment we don't have ${userProfile.curriculum} past papers available, but we are on the move to get them for you very soon!`
                    : userProfile?.subjects && userProfile.subjects.length > 0
                      ? 'No papers available for your enrolled subjects yet.'
                      : 'Please set your curriculum and grade in settings to see available papers.'}
              </p>
              {!isNSCOverride && (userProfile?.curriculum === 'IEB' || userProfile?.curriculum === 'Cambridge') && (
                <div className="mt-8 flex flex-col items-center gap-4 justify-center">
                  <Button
                    onClick={() => setIsNSCOverride(true)}
                    className="gap-2"
                  >
                    Visit NSC past papers
                  </Button>
                  <Badge variant="outline" className="px-4 py-1.5 border-primary/30 text-primary bg-primary/5 font-semibold text-xs animate-pulse">
                    Coming Soon 🚀
                  </Badge>
                </div>
              )}
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // Papers Grid Grouped by Year
  const groupedByYear = filteredDocuments.reduce((acc, doc) => {
    const year = doc.year || 0;
    if (!acc[year]) acc[year] = [];
    acc[year].push(doc);
    return acc;
  }, {} as Record<number, Document[]>);

  const sortedYears = Object.keys(groupedByYear).map(Number).sort((a, b) => b - a);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedSubject(null)}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl lg:text-2xl font-display font-bold text-foreground flex items-center gap-2">
                {selectedMeta && (
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${selectedMeta.color}20` }}
                  >
                    <selectedMeta.icon className="w-4 h-4" style={{ color: selectedMeta.color }} />
                  </div>
                )}
                {selectedSubject}
              </h1>
              <p className="text-muted-foreground text-sm">{getCurriculumLabel()}</p>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-3"
        >
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search papers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {/* Papers Grid */}
        {loading ? (
          renderPaperSkeleton()
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-8"
          >
          {sortedYears.map((year) => (
            <div key={year} className="space-y-4">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold text-foreground min-w-[60px]">{year === 0 ? 'Other' : year}</h2>
                <div className="h-px bg-border flex-1" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {groupedByYear[year].map((doc, index) => {
                  const attempt = attempts[doc.id];
                  const hasAttempt = !!attempt;

                  return (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <Card className="hover:shadow-hover transition-shadow h-full">
                        <CardContent className="p-4 lg:p-6 flex flex-col h-full">
                          <div className="flex items-start justify-between mb-4">
                            <div
                              className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center"
                              style={{ backgroundColor: selectedMeta ? `${selectedMeta.color}20` : undefined }}
                            >
                              <FileText className="w-5 h-5 lg:w-6 lg:h-6" style={{ color: selectedMeta?.color }} />
                            </div>
                            <div className="flex gap-2">
                              {doc.language && (
                                <Badge variant="secondary" className="font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                  {doc.language === 'Eng' ? 'Eng' : doc.language === 'Afri' ? 'Afri' : doc.language}
                                </Badge>
                              )}
                              {doc.paper_number && (
                                <Badge variant="outline" className="font-bold">P{doc.paper_number}</Badge>
                              )}
                              {hasAttempt && (
                                <Badge className={getScoreColor(Number(attempt.score), Number(attempt.max_score))}>
                                  {Math.round((Number(attempt.score) / Number(attempt.max_score)) * 100)}%
                                </Badge>
                              )}
                            </div>
                          </div>

                          <h3 className="font-semibold text-foreground mb-2 text-sm lg:text-base">{doc.title}</h3>
                          <p className="text-xs lg:text-sm text-muted-foreground mb-4 flex-1">
                            {doc.description || `Past Paper ${doc.paper_number || ''}`}
                          </p>

                          {hasAttempt && (
                            <div className="flex items-center gap-2 text-xs lg:text-sm text-muted-foreground mb-4">
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                              <span>
                                Last: {Number(attempt.score)}/{Number(attempt.max_score)}
                              </span>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              className="flex-1 min-w-[80px]"
                              onClick={() => {
                                if (doc.file_url) {
                                  setSelectedDocument(doc);
                                }
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Paper
                            </Button>

                            {getMemoForPaper(doc.id) && (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="flex-1 min-w-[80px]"
                                onClick={() => {
                                  const memo = getMemoForPaper(doc.id);
                                  if (memo) setSelectedDocument(memo);
                                }}
                              >
                                <FileCheck className="w-4 h-4 mr-2" />
                                Memo
                              </Button>
                            )}

                            {doc.file_url && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-2" align="end">
                                  <div className="flex flex-col gap-1">
                                    <p className="text-xs font-medium px-2 py-1.5 text-muted-foreground">Download options</p>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="justify-start font-normal"
                                      onClick={() => handleDownload(doc, 'paper')}
                                    >
                                      <FileText className="w-4 h-4 mr-2" />
                                      Past Paper
                                    </Button>
                                    {getMemoForPaper(doc.id) && (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="justify-start font-normal"
                                          onClick={() => handleDownload(doc, 'memo')}
                                        >
                                          <FileCheck className="w-4 h-4 mr-2" />
                                          Memo Only
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="justify-start font-normal"
                                          onClick={() => handleDownload(doc, 'both')}
                                        >
                                          <Download className="w-4 h-4 mr-2" />
                                          Both
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </motion.div>
        )}

        {/* Empty State */}
        {filteredDocuments.length === 0 && !loading && (
          <div className="text-center py-16 bg-muted/30 rounded-3xl border-2 border-dashed border-muted p-8">
            <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <FileText className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">
              {userProfile?.curriculum === 'IEB' || userProfile?.curriculum === 'Cambridge'
                ? `${userProfile.curriculum} Papers Coming Soon`
                : 'No papers found'}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto text-sm lg:text-base leading-relaxed">
              {userProfile?.curriculum === 'IEB' || userProfile?.curriculum === 'Cambridge'
                ? `At this moment we don't have ${userProfile.curriculum} past papers for ${selectedSubject}, but we are on the move to get them for you very soon!`
                : `Papers for ${selectedSubject} will appear here once added.`}
            </p>
            {(userProfile?.curriculum === 'IEB' || userProfile?.curriculum === 'Cambridge') && (
              <div className="mt-8 flex flex-col items-center gap-4 justify-center">
                <Button
                  onClick={() => setIsNSCOverride(true)}
                  className="gap-2"
                >
                  Visit NSC past papers
                </Button>
                <Badge variant="outline" className="px-4 py-1.5 border-primary/30 text-primary bg-primary/5 font-semibold text-xs animate-pulse">
                  Working on it ⚡
                </Badge>
              </div>
            )}
          </div>
         )}

        {renderResultDialog()}
      </div>
    </AppLayout>
  );
};

export default PastPapers;

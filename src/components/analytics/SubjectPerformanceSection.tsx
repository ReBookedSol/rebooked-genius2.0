import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ChevronDown, ChevronUp, BarChart, BookOpen, FileText, Award, MoreHorizontal, Brain, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSubjectAnalytics } from '@/hooks/useSubjectAnalytics';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface AssessmentEntry {
  id: string;
  name: string;
  score: number;
  max_score: number;
  percentage: number;
  type: 'quiz' | 'exam' | 'paper' | 'flashcards' | 'lesson';
  date: string;
  documentId?: string;
  quizId?: string;
  deckId?: string;
}

interface SubjectPerformanceData {
  subjectId: string;
  subjectName: string;
  combinedPercentage: number;
  assessments: AssessmentEntry[];
  hasNoData?: boolean;
}

interface SubjectPerformanceSectionProps {
  monthOffset?: number;
}

export const SubjectPerformanceSection = ({ monthOffset = 0 }: SubjectPerformanceSectionProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { getAllSubjectAnalytics } = useSubjectAnalytics();
  const [subjectData, setSubjectData] = useState<SubjectPerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [showMoreCount, setShowMoreCount] = useState<Record<string, number>>({});

  const INITIAL_SHOW_COUNT = 3;

  useEffect(() => {
    if (user) {
      fetchSubjectData();
    }
  }, [user, monthOffset]);

  useEffect(() => {
    if (subjectData.length > 0) {
      const params = new URLSearchParams(location.search);
      const subjectId = params.get('subjectId');
      if (subjectId) {
        setExpandedSubjects(new Set([subjectId]));
        // Scroll to the subject
        setTimeout(() => {
          const element = document.getElementById(`subject-${subjectId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 500);
      }
    }
  }, [subjectData, location.search]);

  const fetchSubjectData = async () => {
    setLoading(true);
    const selectedDate = subMonths(new Date(), monthOffset);
    const monthStartDate = startOfMonth(selectedDate).toISOString();
    const monthEndDate = endOfMonth(selectedDate).toISOString();
    try {
      // Fetch all subjects the user is enrolled in
      const { data: userSubjects } = await supabase
        .from('user_subjects')
        .select('subjects(id, name)')
        .eq('user_id', user!.id);

      const enrolledSubjectIds = (userSubjects || []).map((us: any) => us.subjects?.id).filter(Boolean);
      const enrolledSubjectNames = new Map((userSubjects || []).map((us: any) => [us.subjects?.id, us.subjects?.name]));

      // Get existing summaries
      const summaries = await getAllSubjectAnalytics();
      const existingSummaryIds = new Set(summaries.map(s => s.subject_id));

      // Combine enrolled subjects with those that have summaries (just in case they differ)
      const allSubjectIds = Array.from(new Set([...enrolledSubjectIds, ...Array.from(existingSummaryIds)]));

      const fullData: SubjectPerformanceData[] = await Promise.all(allSubjectIds.map(async (subjectId) => {
        const summary = summaries.find(s => s.subject_id === subjectId);
        const subjectName = enrolledSubjectNames.get(subjectId) || (await supabase.from('subjects').select('name').eq('id', subjectId).single()).data?.name || 'Unknown Subject';

        if (!summary) {
          return {
            subjectId,
            subjectName,
            combinedPercentage: 0,
            assessments: [],
            hasNoData: true
          };
        }

        // Fetch all assessments for this subject
        // 1. Quizzes and Exams
        const { data: quizAnalytics } = await supabase
          .from('quiz_performance_analytics')
          .select('id, score, max_score, percentage, knowledge_id, quiz_id, completed_at, quizzes(title, source_knowledge_id), knowledge_base(title)')
          .eq('user_id', user!.id)
          .eq('subject_id', summary.subject_id)
          .gte('completed_at', monthStartDate)
          .lte('completed_at', monthEndDate)
          .order('completed_at', { ascending: false });

        // Fetch study documents to link knowledge_id to document_id
        const { data: documents } = await supabase
          .from('study_documents')
          .select('id, knowledge_id')
          .eq('user_id', user!.id);

        const knowledgeToDocMap = new Map(documents?.map(d => [d.knowledge_id, d.id]));

        const quizExams: AssessmentEntry[] = (quizAnalytics || []).map(q => {
          const knowledgeId = q.knowledge_id || (q.quizzes as any)?.source_knowledge_id;
          const docId = knowledgeId ? knowledgeToDocMap.get(knowledgeId) : undefined;

          return {
            id: q.id,
            name: q.knowledge_id ? (q.knowledge_base as any)?.title || 'Exam' : (q.quizzes as any)?.title || 'Quiz',
            score: q.score || 0,
            max_score: q.max_score || 0,
            percentage: q.percentage || 0,
            type: q.knowledge_id ? 'exam' : 'quiz',
            date: q.completed_at,
            documentId: docId,
            quizId: q.quiz_id
          };
        });

        // 2. Past Papers
        const { data: paperAttempts } = await supabase
          .from('past_paper_attempts')
          .select('id, score, max_score, completed_at, document_id, documents(title, subject_id)')
          .eq('user_id', user!.id)
          .gte('completed_at', monthStartDate)
          .lte('completed_at', monthEndDate);

        const papers: AssessmentEntry[] = (paperAttempts || [])
          .filter((p: any) => p.documents?.subject_id === summary.subject_id)
          .map(p => ({
            id: p.id,
            name: (p.documents as any)?.title || 'Past Paper',
            score: p.score || 0,
            max_score: p.max_score || 0,
            percentage: (p.score / p.max_score) * 100,
            type: 'paper',
            date: p.completed_at,
            documentId: p.document_id
          }));

        // 3. Flashcards (filter by month using mastery history or deck updated_at)
        const { data: decks } = await supabase
          .from('flashcard_decks')
          .select('id, title, total_cards, mastered_cards, updated_at, source_knowledge_id, nbt_lesson_id')
          .eq('user_id', user!.id)
          .eq('subject_id', summary.subject_id)
          .gte('updated_at', monthStartDate)
          .lte('updated_at', monthEndDate);

        // Filter out NBT decks
        const nonNBTDecks = (decks || []).filter(deck =>
          !deck.title?.toUpperCase().includes('NBT') && !deck.nbt_lesson_id
        );

        const flashcards: AssessmentEntry[] = nonNBTDecks.map(deck => {
          const docId = deck.source_knowledge_id ? knowledgeToDocMap.get(deck.source_knowledge_id) : undefined;
          return {
            id: deck.id,
            name: deck.title || 'Flashcard Deck',
            score: deck.mastered_cards || 0,
            max_score: deck.total_cards || 0,
            percentage: deck.total_cards > 0 ? (deck.mastered_cards / deck.total_cards) * 100 : 0,
            type: 'flashcards',
            date: deck.updated_at,
            documentId: docId,
            deckId: deck.id
          };
        });

        // 4. Lessons (Completed within the selected month)
        const { data: lessonData } = await supabase
          .from('generated_lessons')
          .select('id, document_id, updated_at, status, study_documents(title, subject_id)')
          .eq('user_id', user!.id)
          .eq('status', 'completed')
          .gte('updated_at', monthStartDate)
          .lte('updated_at', monthEndDate);

        const lessons: AssessmentEntry[] = (lessonData || [])
          .filter((l: any) => l.study_documents?.subject_id === summary.subject_id)
          .map(l => ({
            id: l.id,
            name: (l.study_documents as any)?.title || 'Lesson',
            score: 1,
            max_score: 1,
            percentage: 100,
            type: 'lesson',
            date: l.updated_at,
            documentId: l.document_id
          }));

        const allAssessments = [...quizExams, ...papers, ...flashcards, ...lessons].sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        // Calculate month-specific combined percentage from actual assessment data
        let totalWeightUsed = 0;
        let weightedSum = 0;

        // Quizzes average for this month
        const monthQuizzes = quizExams.filter(a => a.type === 'quiz');
        if (monthQuizzes.length > 0) {
          const avgQuiz = monthQuizzes.reduce((s, q) => s + q.percentage, 0) / monthQuizzes.length;
          weightedSum += avgQuiz * 0.20;
          totalWeightUsed += 0.20;
        }

        // Exams average for this month
        const monthExams = quizExams.filter(a => a.type === 'exam');
        if (monthExams.length > 0) {
          const avgExam = monthExams.reduce((s, e) => s + e.percentage, 0) / monthExams.length;
          weightedSum += avgExam * 0.20;
          totalWeightUsed += 0.20;
        }

        // Papers average for this month
        if (papers.length > 0) {
          const avgPaper = papers.reduce((s, p) => s + p.percentage, 0) / papers.length;
          weightedSum += avgPaper * 0.20;
          totalWeightUsed += 0.20;
        }

        // Flashcards mastery (current state, not month-specific)
        if (flashcards.length > 0) {
          const avgFlashcard = flashcards.reduce((s, f) => s + f.percentage, 0) / flashcards.length;
          weightedSum += avgFlashcard * 0.20;
          totalWeightUsed += 0.20;
        }

        // Lessons completed this month
        if (lessons.length > 0) {
          weightedSum += 100 * 0.20;
          totalWeightUsed += 0.20;
        }

        const combinedPercentage = totalWeightUsed > 0 ? (weightedSum / totalWeightUsed) : 0;

        return {
          subjectId,
          subjectName,
          combinedPercentage: Math.round(combinedPercentage * 100) / 100,
          assessments: allAssessments,
          hasNoData: allAssessments.length === 0
        };
      }));

      setSubjectData(fullData.sort((a, b) => b.combinedPercentage - a.combinedPercentage));
    } catch (error) {
      console.error('Error fetching subject performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSubject = (id: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    
    if (!showMoreCount[id]) {
      setShowMoreCount(prev => ({ ...prev, [id]: INITIAL_SHOW_COUNT }));
    }
  };

  const handleShowMore = (id: string) => {
    setShowMoreCount(prev => ({ ...prev, [id]: (prev[id] || INITIAL_SHOW_COUNT) + 5 }));
  };

  const handleAssessmentClick = (assessment: AssessmentEntry) => {
    if (!assessment.documentId && assessment.type !== 'paper') return;

    if (assessment.type === 'quiz') {
      navigate(`/study/${assessment.documentId}?tab=quizzes&quizId=${assessment.quizId}`);
    } else if (assessment.type === 'exam') {
      navigate(`/study/${assessment.documentId}?tab=exams`);
    } else if (assessment.type === 'paper') {
      navigate(`/papers?id=${assessment.documentId}`);
    } else if (assessment.type === 'flashcards') {
      navigate(`/study/${assessment.documentId}?tab=flashcards&deckId=${assessment.deckId}`);
    } else if (assessment.type === 'lesson') {
      navigate(`/study/${assessment.documentId}?tab=lessons`);
    }
  };

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 75) return 'text-green-600 bg-green-100 dark:bg-green-900/30';
    if (percentage >= 50) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
    return 'text-red-600 bg-red-100 dark:bg-red-900/30';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 75) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader><div className="h-6 bg-muted rounded w-1/4" /></CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl" />)}
        </CardContent>
      </Card>
    );
  }

  if (subjectData.length === 0) return null;

  return (
    <Card className="border-none shadow-md overflow-hidden bg-card">
      <CardHeader className="bg-primary/5 border-b">
        <CardTitle className="flex items-center gap-2 text-xl font-bold">
          <BarChart className="w-5 h-5 text-primary" />
          Subject Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {subjectData.map((data) => {
            const isExpanded = expandedSubjects.has(data.subjectId);
            const visibleCount = showMoreCount[data.subjectId] || INITIAL_SHOW_COUNT;
            const visibleAssessments = data.assessments.slice(0, visibleCount);
            const hasMore = data.assessments.length > visibleCount;

            return (
              <div key={data.subjectId} id={`subject-${data.subjectId}`} className="flex flex-col">
                {/* Subject Summary Row */}
                <div 
                  className="p-4 sm:p-6 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleSubject(data.subjectId)}
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <h3 className="font-bold text-lg text-foreground truncate">{data.subjectName}</h3>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex-1 max-w-[200px]">
                        <Progress 
                          value={data.combinedPercentage} 
                          className="h-2" 
                          indicatorClassName={getProgressColor(data.combinedPercentage)}
                        />
                      </div>
                      <span className={cn("text-sm font-bold px-2 py-0.5 rounded-full", getPerformanceColor(data.combinedPercentage))}>
                        {Math.round(data.combinedPercentage)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="hidden sm:flex flex-col items-end text-xs text-muted-foreground">
                      <span>{data.assessments.length} Assessments</span>
                      <span>Avg Weighted Score</span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>

                {/* Expandable Breakdown */}
                {isExpanded && (
                  <div className="px-4 pb-6 sm:px-8 space-y-3 animate-in slide-in-from-top-2 duration-300">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground pb-2 border-b">Assessment Breakdown</h4>
                    {data.assessments.length > 0 ? (
                      <>
                        <div className="space-y-2">
                          {visibleAssessments.map((assessment) => (
                            <div
                              key={assessment.id}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50",
                                (assessment.documentId || assessment.type === 'paper') && "cursor-pointer hover:bg-secondary/50 transition-colors"
                              )}
                              onClick={() => handleAssessmentClick(assessment)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-md bg-background shadow-sm">
                                  {assessment.type === 'quiz' && <BookOpen className="w-4 h-4 text-blue-500" />}
                                  {assessment.type === 'exam' && <Award className="w-4 h-4 text-purple-500" />}
                                  {assessment.type === 'paper' && <FileText className="w-4 h-4 text-amber-500" />}
                                  {assessment.type === 'flashcards' && <Brain className="w-4 h-4 text-green-500" />}
                                  {assessment.type === 'lesson' && <Sparkles className="w-4 h-4 text-pink-500" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate max-w-[200px] sm:max-w-[400px]">
                                    {assessment.name}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground uppercase font-medium">
                                    {assessment.type === 'flashcards' ? 'Practice' : assessment.type} • {new Date(assessment.date).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-foreground">
                                  {assessment.type === 'flashcards' ? `${assessment.score}/${assessment.max_score} Mastered` : `${assessment.score}/${assessment.max_score}`}
                                </p>
                                <p className={cn("text-[10px] font-bold", assessment.percentage >= 50 ? "text-green-600" : "text-red-600")}>
                                  {Math.round(assessment.percentage)}%
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {hasMore && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full gap-2 text-primary hover:bg-primary/5"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowMore(data.subjectId);
                            }}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                            Show More ({data.assessments.length - visibleCount} remaining)
                          </Button>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground italic text-center py-4">No assessment data found for this subject.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

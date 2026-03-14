import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Upload, Loader2, FileText, BookOpen, CheckCircle2, Plus, Trash2, Settings, BarChart3, GraduationCap, Brain, Zap, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import PastPapersManager from '@/components/admin/PastPapersManager';
import DocumentAuditor from '@/components/admin/DocumentAuditor';
import { compressPDF, uploadCompressedPDF } from '@/lib/pdfCompressor';

interface AdminContent {
  id: string;
  content_type: string;
  target_section: string;
  title: string;
  status: string;
  is_published: boolean;
  created_at: string;
}

const SECTIONS = [
  { value: 'NBT', label: 'NBT (National Benchmark Test)' },
  { value: 'AQL', label: 'AQL (Academic & Quantitative Literacy)' },
  { value: 'MAT', label: 'MAT (Mathematics)' },
  { value: 'QL', label: 'QL (Quantitative Literacy)' },
  { value: 'GENERAL', label: 'General Content' },
];

const CONTENT_TYPES = [
  { value: 'lesson', label: 'Lesson' },
  { value: 'practice_test', label: 'Practice Test' },
  { value: 'practice_question', label: 'Practice Questions' },
];

const Admin = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contents, setContents] = useState<AdminContent[]>([]);
  const [pastPaperCount, setPastPaperCount] = useState<{
    total: number;
    papers: number;
    memos: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState('papers');
  
  // Form state for content generation
  const [formData, setFormData] = useState({
    contentType: 'lesson',
    targetSection: 'NBT',
    title: '',
    description: '',
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  // NBT Generator State
  const [nbtSection, setNbtSection] = useState<'AQL' | 'MAT' | 'QL'>('AQL');
  const [nbtFile, setNbtFile] = useState<File | null>(null);
  const [nbtGenerating, setNbtGenerating] = useState(false);
  const [nbtMaterials, setNbtMaterials] = useState<any[]>([]);
  const [nbtGenType, setNbtGenType] = useState<'flashcards' | 'quiz' | 'exam' | null>(null);
  const [nbtGenLoading, setNbtGenLoading] = useState(false);

  // Fetch existing NBT study materials for content generation
  useEffect(() => {
    if (isAdmin) {
      supabase
        .from('nbt_study_materials')
        .select('id, title, section, content')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data }) => { if (data) setNbtMaterials(data); });
    }
  }, [isAdmin]);

  const handleNBTGenerateFromMaterial = async (materialId: string, materialContent: string, materialSection: string, genType: 'flashcards' | 'quiz' | 'exam') => {
    if (!user) return;
    setNbtGenType(genType);
    setNbtGenLoading(true);

    try {
      const functionName = genType === 'flashcards' ? 'generate-flashcards-nbt' : genType === 'quiz' ? 'generate-quiz-nbt' : 'generate-exam-nbt';
      
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          lessonContent: materialContent,
          section: materialSection,
          materialId,
        }
      });

      if (error) throw error;

      toast({
        title: `${genType.charAt(0).toUpperCase() + genType.slice(1)} Generated!`,
        description: data.message || `Successfully generated ${genType} for ${materialSection}`,
      });
    } catch (error: any) {
      console.error(`Error generating NBT ${genType}:`, error);
      toast({
        title: 'Error',
        description: error.message || `Failed to generate ${genType}`,
        variant: 'destructive',
      });
    } finally {
      setNbtGenLoading(false);
      setNbtGenType(null);
    }
  };

  const handleNBTAnalyzeAndLearn = async () => {
    if (!user || !nbtFile) {
      toast({
        title: 'Missing information',
        description: 'Please upload an NBT document',
        variant: 'destructive',
      });
      return;
    }

    setNbtGenerating(true);

    try {
      toast({
        title: 'Analyzing NBT Document',
        description: 'AI is learning from the document and generating elite study material...',
      });

      const fileName = `${Date.now()}_NBT_${nbtSection}_${nbtFile.name}`;
      const customPath = `admin/nbt/${user.id}/${fileName}`;

      const publicUrl = await uploadCompressedPDF(
        supabase,
        nbtFile,
        nbtFile.name,
        user.id,
        'documents',
        3,
        customPath
      );

      const { data, error } = await supabase.functions.invoke('generate-lesson-nbt', {
        body: {
          documentText: "Sample NBT Document Content for " + nbtSection,
          section: nbtSection,
          documentUrl: publicUrl
        }
      });

      if (error) throw error;

      toast({
        title: 'Success!',
        description: data.message,
      });

      setNbtFile(null);
      fetchContents();
    } catch (error: any) {
      console.error('NBT Generator error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate NBT material',
        variant: 'destructive',
      });
    } finally {
      setNbtGenerating(false);
    }
  };

  const checkAdminStatus = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (data) {
        setIsAdmin(true);
        fetchContents();
        fetchPastPaperCount();
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContents = async () => {
    const { data } = await supabase
      .from('admin_content' as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setContents(data as any);
    }
  };

  const fetchPastPaperCount = async () => {
    try {
      // Get all records where is_past_paper is true
      const { count: totalCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('is_past_paper', true);

      // Get records specifically marked as papers (is_memo is false or NULL)
      const { count: paperCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('is_past_paper', true)
        .or('is_memo.eq.false,is_memo.is.null');

      // Get records specifically marked as memos
      const { count: memoCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('is_past_paper', true)
        .eq('is_memo', true);

      if (totalCount !== null) {
        setPastPaperCount({
          total: totalCount || 0,
          papers: paperCount || 0,
          memos: memoCount || 0
        });
      }
    } catch (error) {
      console.error('Error fetching past paper count:', error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | undefined;

    if ('dataTransfer' in e) {
      e.preventDefault();
      file = e.dataTransfer.files?.[0];
      setDragOver(false);
    } else {
      file = (e.target as HTMLInputElement).files?.[0];
    }

    if (file) {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        // Create a new File object using slice() for more robust referencing
        const clonedBlob = file.slice(0, file.size, file.type);
        const clonedFile = new File([clonedBlob], file.name, {
          type: file.type,
          lastModified: file.lastModified
        });
        setUploadedFile(clonedFile);
      } else {
        toast({
          title: 'Invalid file',
          description: 'Please upload a PDF file',
          variant: 'destructive',
        });
      }
    }
  };

  const handleGenerate = async () => {
    if (!user || !formData.title || !uploadedFile) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields and upload a document',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);

    try {
      // Compress the document before upload
      toast({
        title: 'Processing Document',
        description: 'Optimizing PDF for storage...',
      });

      const compressionResult = await compressPDF(uploadedFile);
      const blobToUpload = compressionResult.compressedBlob;

      // Upload file to storage using the robust utility
      const fileName = `${Date.now()}_${uploadedFile.name}`;
      const customPath = `admin/${user.id}/${fileName}`;

      const publicUrl = await uploadCompressedPDF(
        supabase,
        blobToUpload,
        uploadedFile.name,
        user.id,
        'documents',
        3,
        customPath
      );

      // Create admin_content record
      const { error: contentError } = await supabase
        .from('admin_content' as any)
        .insert({
          created_by: user.id,
          content_type: formData.contentType,
          target_section: formData.targetSection,
          title: formData.title,
          source_document_url: publicUrl,
          status: 'processing',
          metadata: {
            description: formData.description,
            original_filename: uploadedFile.name,
          },
        })
        .select()
        .single();

      if (contentError) throw contentError;

      toast({
        title: 'Content queued for generation',
        description: 'AI is processing your document. This may take a few minutes.',
      });

      // Reset form
      setFormData({
        contentType: 'lesson',
        targetSection: 'NBT',
        title: '',
        description: '',
      });
      setUploadedFile(null);
      
      // Refresh list
      fetchContents();
      setActiveTab('manage');
    } catch (error: any) {
      console.error('Error generating content:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate content',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async (contentId: string) => {
    try {
      const { data: contentData, error: fetchError } = await supabase
        .from('admin_content' as any)
        .select('*')
        .eq('id', contentId)
        .single() as any;

      if (fetchError) throw fetchError;

      const { error: updateError } = await supabase
        .from('admin_content' as any)
        .update({ is_published: true, status: 'published' })
        .eq('id', contentId);

      if (updateError) throw updateError;

      if (contentData.target_section === 'NBT' || ['AQL', 'MAT', 'QL'].includes(contentData.target_section)) {
        const section = contentData.target_section === 'NBT' ? 'AQL' : contentData.target_section;
        const metadata = contentData.metadata as Record<string, any> || {};

        if (contentData.content_type === 'practice_test') {
          await supabase.from('nbt_practice_tests').insert({
            user_id: contentData.created_by,
            title: contentData.title,
            description: metadata.description || '',
            section: section,
            is_published: true,
            is_official: true,
            total_questions: 0,
            time_limit_minutes: 60,
          });
        } else if (contentData.content_type === 'lesson') {
          await supabase.from('nbt_study_materials').insert({
            user_id: contentData.created_by,
            title: contentData.title,
            description: metadata.description || '',
            section: section,
            topic: 'General',
            material_type: 'lesson',
            content: contentData.content ? JSON.stringify(contentData.content) : '',
            content_url: contentData.source_document_url,
            is_published: true,
            is_official: true,
          });
        }
      }

      toast({ title: 'Published', description: 'Content is now live' });
      fetchContents();
    } catch (error) {
      console.error('Publish error:', error);
      toast({ title: 'Error', description: 'Failed to publish', variant: 'destructive' });
    }
  };

  const handleDelete = async (contentId: string) => {
    const { error } = await supabase
      .from('admin_content' as any)
      .delete()
      .eq('id', contentId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Content removed' });
      fetchContents();
    }
  };

  const getStatusBadge = (status: string, isPublished: boolean) => {
    if (isPublished) {
      return <Badge className="bg-green-500/20 text-green-700 dark:text-green-400">Published</Badge>;
    }
    switch (status) {
      case 'processing':
        return <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400">Processing</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-700 dark:text-red-400">Failed</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground">Draft</Badge>;
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
          <Shield className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mb-4" />
          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4 text-sm sm:text-base">You don't have permission to access this page.</p>
          <Button onClick={() => navigate('/')}>Go to Dashboard</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">Admin Panel</h1>
              <p className="text-muted-foreground text-xs sm:text-sm">Manage content, past papers, and AI generation</p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6 h-auto">
            <TabsTrigger value="papers" className="gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <GraduationCap className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Past Papers</span>
              <span className="sm:hidden">Papers</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Audit</span>
            </TabsTrigger>
            <TabsTrigger value="nbt" className="gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Brain className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>NBT Tools</span>
            </TabsTrigger>
            <TabsTrigger value="create" className="gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Create Content</span>
              <span className="sm:hidden">Create</span>
            </TabsTrigger>
            <TabsTrigger value="manage" className="gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Manage</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Stats</span>
            </TabsTrigger>
          </TabsList>

          {/* Past Papers Tab - Uses new component */}
          <TabsContent value="papers" className="mt-4 sm:mt-6">
            <PastPapersManager />
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit" className="mt-4 sm:mt-6">
            <DocumentAuditor />
          </TabsContent>

          {/* NBT Tools Tab */}
          <TabsContent value="nbt" className="mt-4 sm:mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  NBT Analyze & Learn
                </CardTitle>
                <CardDescription>
                  Upload an official NBT document and the AI will learn the style, patterns, and topics to generate elite study materials and practice questions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>NBT Section</Label>
                  <Select
                    value={nbtSection}
                    onValueChange={(value: any) => setNbtSection(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AQL">AQL (Academic & Quantitative Literacy)</SelectItem>
                      <SelectItem value="MAT">MAT (Mathematics)</SelectItem>
                      <SelectItem value="QL">QL (Quantitative Literacy)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>NBT Document (PDF)</Label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type === 'application/pdf') setNbtFile(file);
                      setDragOver(false);
                    }}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                      nbtFile ? 'border-primary bg-primary/5' :
                      dragOver ? 'border-primary bg-primary/10' : 'border-border'
                    }`}>
                    {nbtFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="w-12 h-12 text-primary mb-2" />
                        <p className="font-bold text-foreground">{nbtFile.name}</p>
                        <p className="text-xs text-muted-foreground mb-4">
                          {(nbtFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <Button variant="ghost" size="sm" onClick={() => setNbtFile(null)} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground mb-4">
                          Drag and drop an NBT document, or click to browse
                        </p>
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setNbtFile(file);
                          }}
                          className="hidden"
                          id="nbt-upload"
                        />
                        <Button variant="outline" asChild className="rounded-full px-8">
                          <label htmlFor="nbt-upload" className="cursor-pointer">
                            Choose File
                          </label>
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleNBTAnalyzeAndLearn}
                  disabled={nbtGenerating || !nbtFile}
                  className="w-full rounded-full py-6 font-bold text-lg shadow-lg shadow-primary/20"
                >
                  {nbtGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                      Analyzing & Learning...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 mr-3" />
                      Start Analyze & Learn
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <Card className="border-none shadow-sm bg-secondary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Generated Materials</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-black">
                    {contents.filter(c => c.target_section === 'NBT' || ['AQL', 'MAT', 'QL'].includes(c.target_section)).length}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-secondary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Official Questions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-black">
                    120
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Generate from Existing Materials */}
            {nbtMaterials.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-base">Generate Quizzes, Flashcards & Exams from Materials</CardTitle>
                  <CardDescription className="text-xs">Select a published NBT material to generate study content using the same AI as the Study section</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {nbtMaterials.slice(0, 10).map((material) => (
                    <div key={material.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border/50">
                      <div className="min-w-0 flex-1 mr-3">
                        <p className="font-medium text-sm text-foreground truncate">{material.title}</p>
                        <p className="text-xs text-muted-foreground">{material.section}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={nbtGenLoading}
                          onClick={() => handleNBTGenerateFromMaterial(material.id, material.content || '', material.section, 'flashcards')}
                        >
                          {nbtGenLoading && nbtGenType === 'flashcards' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                          <span className="ml-1 text-xs">Flashcards</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={nbtGenLoading}
                          onClick={() => handleNBTGenerateFromMaterial(material.id, material.content || '', material.section, 'quiz')}
                        >
                          {nbtGenLoading && nbtGenType === 'quiz' ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookOpen className="w-3 h-3" />}
                          <span className="ml-1 text-xs">Quiz</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={nbtGenLoading}
                          onClick={() => handleNBTGenerateFromMaterial(material.id, material.content || '', material.section, 'exam')}
                        >
                          {nbtGenLoading && nbtGenType === 'exam' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Award className="w-3 h-3" />}
                          <span className="ml-1 text-xs">Exam</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Create Content Tab */}
          <TabsContent value="create" className="mt-4 sm:mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Generate AI Content</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Upload a document and let AI generate lessons, practice tests, or questions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Content Type *</Label>
                    <Select
                      value={formData.contentType}
                      onValueChange={(value) => setFormData({ ...formData, contentType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Target Section *</Label>
                    <Select
                      value={formData.targetSection}
                      onValueChange={(value) => setFormData({ ...formData, targetSection: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SECTIONS.map((section) => (
                          <SelectItem key={section.value} value={section.value}>
                            {section.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Quantitative Literacy Practice Set 1"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the content..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Source Document *</Label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileUpload}
                    className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center transition-colors ${
                      uploadedFile ? 'border-primary bg-primary/5' :
                      dragOver ? 'border-primary bg-primary/10' : 'border-border'
                    }`}>
                    {uploadedFile ? (
                      <div className="flex items-center justify-center gap-3 flex-wrap">
                        <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                        <div className="text-left min-w-0">
                          <p className="font-medium text-foreground text-sm truncate max-w-[200px]">{uploadedFile.name}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setUploadedFile(null)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground mx-auto mb-2 sm:mb-3" />
                        <p className="text-muted-foreground mb-2 text-xs sm:text-sm">
                          Drag and drop a PDF, or click to browse
                        </p>
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="file-upload"
                        />
                        <Button variant="outline" asChild>
                          <label htmlFor="file-upload" className="cursor-pointer">
                            Choose File
                          </label>
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={generating || !formData.title || !uploadedFile}
                  className="w-full"
                  size="lg"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-4 h-4 mr-2" />
                      Generate Content with AI
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Manage Tab */}
          <TabsContent value="manage" className="mt-4 sm:mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Manage Content</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Review, publish, or delete generated content
                </CardDescription>
              </CardHeader>
              <CardContent>
                {contents.length === 0 ? (
                  <div className="text-center py-8 sm:py-12">
                    <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm">No content created yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contents.map((content) => (
                      <div
                        key={content.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-secondary/50 rounded-lg gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-medium text-foreground text-sm sm:text-base truncate">{content.title}</h4>
                            {getStatusBadge(content.status, content.is_published)}
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {content.content_type} • {content.target_section} •{' '}
                            {new Date(content.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          {!content.is_published && content.status !== 'processing' && (
                            <Button
                              size="sm"
                              onClick={() => handlePublish(content.id)}
                              className="h-8"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Publish
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(content.id)}
                            className="h-8"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="mt-4 sm:mt-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex flex-col">
                        <p className="text-xl sm:text-2xl font-bold">
                          {pastPaperCount !== null ? pastPaperCount.total.toLocaleString() : '-'}
                        </p>
                        {pastPaperCount !== null && (
                          <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {pastPaperCount.papers} Papers • {pastPaperCount.memos} Memos
                          </p>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Past Papers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xl sm:text-2xl font-bold">{contents.length}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">AI Content</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xl sm:text-2xl font-bold">
                        {contents.filter((c) => c.is_published).length}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Published</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xl sm:text-2xl font-bold">
                        {contents.filter((c) => c.status === 'processing').length}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Processing</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Admin;

import { motion } from 'framer-motion';
import { BookOpen, Video, Lightbulb, Clock, CheckCircle2, AlertCircle, Sparkles, FileText, Youtube, Upload, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNBTStudyMaterials } from '@/hooks/use-nbt-study-materials';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import NBTMaterialView from './NBTMaterialView';
import CombinedUploadSection from '@/components/study/CombinedUploadSection';


const NBTStudyMaterials = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { materials: officialMaterials, loading: officialLoading, error, refresh: refreshOfficial } = useNBTStudyMaterials();
  const [userUploads, setUserUploads] = useState<any[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [viewingMaterial, setViewingMaterial] = useState<any>(null);

  const fetchUserUploads = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingUploads(true);

      // Fetch from new nbt_user_documents table
      const { data: nbtDocs, error: nbtError } = await supabase
        .from('nbt_user_documents')
        .select('*')
        .eq('user_id', user.id);

      // Fetch from legacy study_documents (for backward compatibility)
      const { data: legacyDocs, error: legacyError } = await supabase
        .from('study_documents')
        .select(`
          *,
          knowledge_base (*)
        `)
        .eq('user_id', user.id);

      if (nbtError) throw nbtError;
      if (legacyError) {
        console.warn('Legacy study_documents fetch skipped:', legacyError.message);
      }

      const normalizedNbtDocs = (nbtDocs || []).map((doc: any) => ({
        ...doc,
        isNbtDocument: true
      }));

      setUserUploads([...normalizedNbtDocs, ...((legacyDocs || []).filter((doc: any) => doc?.knowledge_base))]);
    } catch (err) {
      console.error('Error fetching user NBT uploads:', err);
    } finally {
      setLoadingUploads(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserUploads();
  }, [fetchUserUploads]);


  const allMaterials = useMemo(() => {
    const mappedUploads = userUploads.map(upload => {
      return {
        id: upload.id,
        title: upload.title || upload.file_name || upload.knowledge_base?.title,
        content: upload.processed_content || upload.content,
        section: upload.section,
        material_type: (upload.file_type?.includes('youtube') || upload.content_type?.includes('youtube')) ? 'video' : 'notes',
        topic: 'My Upload',
        isUserUpload: true,
        extraction_status: upload.extraction_status,
        knowledge_id: upload.knowledge_id,
        document: upload
      };
    });

    const sortedUploads = [...mappedUploads].sort((a, b) => {
      const aDate = new Date(a.document?.created_at || 0).getTime();
      const bDate = new Date(b.document?.created_at || 0).getTime();
      return bDate - aDate;
    });

    return [...sortedUploads, ...officialMaterials];
  }, [officialMaterials, userUploads]);

  const loading = officialLoading || loadingUploads;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  // Group materials by section
  const aqlMaterials = useMemo(() => {
    return allMaterials.filter(m => m.section === 'AQL');
  }, [allMaterials]);

  const matMaterials = useMemo(() => {
    return allMaterials.filter(m => m.section === 'MAT');
  }, [allMaterials]);


  const strategies = [
    {
      title: 'Time Management',
      tips: [
        'Allocate time per question type during practice',
        'Use a timer to simulate exam conditions',
        'Skip difficult questions and return to them',
        'Reserve time for final review',
      ],
    },
    {
      title: 'Common Mistakes to Avoid',
      tips: [
        'Not reading questions fully - read carefully',
        'Rushing through multiple choice options',
        'Not showing work for math problems',
        'Ignoring context in comprehension passages',
        'Panicking when unsure - use elimination',
      ],
    },
    {
      title: 'Effective Study Techniques',
      tips: [
        'Study in focused 45-minute sessions',
        'Teach the concept to someone else',
        'Create flashcards for formulas and concepts',
        'Review incorrect answers immediately',
        'Practice with past papers and mock tests',
      ],
    },
  ];

  const TopicCard = ({ material }: { material: any }) => (
    <button
      onClick={() => setViewingMaterial(material)}
      className="w-full p-4 bg-card border border-border/50 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group shadow-sm hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{material.title}</p>
          <div className="flex items-center gap-2 mt-2">
            {material.material_type && (
              <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] uppercase font-bold tracking-wider whitespace-nowrap">
                {material.material_type}
              </span>
            )}
            {material.isUserUpload && (
              <span className="flex items-center gap-1 text-[10px] text-accent-mint font-bold uppercase tracking-wider whitespace-nowrap">
                <Sparkles className="w-3 h-3" />
                MY UPLOAD
              </span>
            )}
          </div>
        </div>
        <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors flex-shrink-0">
          {material.material_type === 'video' ? (
            <Youtube className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          ) : material.isUserUpload ? (
            <FileText className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          ) : (
            <BookOpen className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
        </div>
      </div>
    </button>
  );

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
        <div>
          <p className="font-medium text-destructive">Error loading study materials</p>
          <p className="text-sm text-destructive/80">{error}</p>
        </div>
      </div>
    );
  }

  if (viewingMaterial) {
    return (
      <NBTMaterialView
        material={viewingMaterial}
        onClose={() => setViewingMaterial(null)}
        onRefresh={() => {
          fetchUserUploads();
          refreshOfficial();
        }}
      />
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 w-full"
    >
      {/* Header with AI Generate integrated */}
      <motion.div variants={itemVariants}>
        <Card className="border-none shadow-md bg-card overflow-hidden">
          <CardContent className="p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-3xl font-black mb-2 text-foreground flex items-center gap-2">
                  <Zap className="w-8 h-8 text-primary" />
                  Structured Study Materials
                </h2>
                <p className="text-muted-foreground text-lg">
                  Comprehensive notes, video lessons, and study strategies for each NBT section.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Upload Section - Center integrated */}
      <motion.div variants={itemVariants}>
        <Card className="border-none shadow-md overflow-hidden bg-card">
          <CardHeader className="bg-primary/5 border-b py-4">
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <Upload className="w-5 h-5 text-primary" />
              Upload NBT Content
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
              <p className="text-sm text-muted-foreground mb-6 text-center">
                Upload your own practice papers, notes, or YouTube videos to generate personalized NBT study guides.
              </p>
              <CombinedUploadSection
                mode="nbt"
                onUploadSuccess={() => {
                  fetchUserUploads();
                  toast({
                    title: 'Success',
                    description: 'NBT document uploaded successfully!',
                  });
                }}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Study Materials Tabs */}
      <Tabs defaultValue="aql" className="w-full">
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Study Materials
          </h2>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="aql">AQL {aqlMaterials.length > 0 && `(${aqlMaterials.length})`}</TabsTrigger>
            <TabsTrigger value="mat">MAT {matMaterials.length > 0 && `(${matMaterials.length})`}</TabsTrigger>
          </TabsList>
        </div>

        {/* AQL Materials */}
        <TabsContent value="aql" className="space-y-3">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading materials...</p>
            </div>
          ) : aqlMaterials.length === 0 ? (
            <Card className="bg-secondary/50">
              <CardContent className="p-6 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No AQL materials available yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {aqlMaterials.map((material) => (
                <div key={material.id}>
                  <TopicCard material={material} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* MAT Materials */}
        <TabsContent value="mat" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading materials...</p>
            </div>
          ) : matMaterials.length === 0 ? (
            <Card className="bg-secondary/50">
              <CardContent className="p-6 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No MAT materials available yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {matMaterials.map((material) => (
                <div key={material.id}>
                  <TopicCard material={material} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Strategies */}
      <motion.div variants={itemVariants}>
        <h3 className="text-xl font-bold mb-4 text-foreground">Study Strategies & Tips</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {strategies.map((strategy) => (
            <Card key={strategy.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {strategy.title === 'Time Management' ? (
                    <Clock className="w-5 h-5 text-primary" />
                  ) : strategy.title === 'Common Mistakes to Avoid' ? (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  ) : (
                    <Lightbulb className="w-5 h-5 text-primary" />
                  )}
                  {strategy.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {strategy.tips.map((tip, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-primary text-sm">→</span>
                      <span className="text-sm text-foreground/80">{tip}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Video Resources */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Video Lessons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground/80 mb-4">
              Coming soon! Video lessons covering tricky topics in each section.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['Critical Reasoning', 'Calculus Basics', 'Data Interpretation'].map((topic) => (
                <div key={topic} className="bg-secondary/50 p-4 rounded-lg text-center">
                  <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Video className="w-6 h-6 text-primary" />
                  </div>
                  <p className="font-medium text-sm text-foreground">{topic}</p>
                  <p className="text-xs text-muted-foreground mt-1">15-20 min</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default NBTStudyMaterials;

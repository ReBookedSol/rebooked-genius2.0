import { useState, useEffect } from 'react';
import { Loader2, Upload, AlertCircle, FileText, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import { useStudyMaterialSubjects } from '@/hooks/useStudyMaterialSubjects';
import { CONTENT_TYPES, extractYoutubeVideoId, isValidYoutubeUrl } from '@/lib/constants';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';

interface DocumentUploadProps {
  onUploadSuccess: (document: any) => void;
  onAutoNavigate?: (documentId: string) => void;
  mode?: 'study' | 'nbt';
  onExpandedChange?: (expanded: boolean) => void;
  droppedFile?: File | null;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

interface Subject {
  id: string;
  name: string;
}

const CombinedUploadSection: React.FC<DocumentUploadProps> = ({
  onUploadSuccess,
  onAutoNavigate,
  mode = 'study',
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { limits, usage, remainingDocuments, tier, incrementDocumentUsage, storage, updateStorageOnDocumentUpload, isStorageFull } =
    useSubscription();
  const { tagMaterialWithSubject } = useStudyMaterialSubjects();

  // Subjects state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  // Collapsible sections state
  const [isDocumentSectionExpanded, setIsDocumentSectionExpanded] = useState(true);
  const [isVideoSectionExpanded, setIsVideoSectionExpanded] = useState(true);

  // Document upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedDocumentSubject, setSelectedDocumentSubject] = useState<string>('');

  // YouTube upload state
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadStage, setVideoUploadStage] = useState<string>('');
  const [selectedVideoSubject, setSelectedVideoSubject] = useState<string>('');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Fetch subjects on mount
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!user) return;

      if (mode === 'nbt') {
        setSubjects([
          { id: 'AQL', name: 'AQL (Academic & Quantitative Literacy)' },
          { id: 'MAT', name: 'MAT (Mathematics)' },
        ]);
        setLoadingSubjects(false);
        return;
      }

      try {
        // Fetch subjects from user_subjects, profile subjects, and subjects already used in study_documents
        const [enrolledResponse, usedResponse, profileResponse] = await Promise.all([
          supabase
            .from('user_subjects')
            .select('subjects(id, name)')
            .eq('user_id', user.id),
          supabase
            .from('study_documents')
            .select('subjects(id, name)')
            .eq('user_id', user.id)
            .not('subject_id', 'is', null),
          supabase
            .from('profiles')
            .select('subjects, exam_board, grade')
            .eq('user_id', user.id)
            .single()
        ]);

        if (enrolledResponse.error) throw enrolledResponse.error;
        if (usedResponse.error) throw usedResponse.error;

        // Combine enrolled and used subjects
        const enrolledSubjects = enrolledResponse.data?.map((d: any) => d.subjects).filter(Boolean) || [];
        const usedSubjects = usedResponse.data?.map((d: any) => d.subjects).filter(Boolean) || [];

        let combined = [...enrolledSubjects, ...usedSubjects];

        // If user_subjects is empty, fall back to profile subjects by looking them up in the subjects table
        if (enrolledSubjects.length === 0 && profileResponse.data?.subjects) {
          const profileSubjectNames = Array.isArray(profileResponse.data.subjects)
            ? profileResponse.data.subjects
            : [];
          
          if (profileSubjectNames.length > 0) {
            // Look up these subject names in the subjects table
            const { data: subjectRows } = await supabase
              .from('subjects')
              .select('id, name')
              .in('name', profileSubjectNames);
            
            if (subjectRows && subjectRows.length > 0) {
              combined = [...combined, ...subjectRows];
            }
          }
        }

        const uniqueSubjects = Array.from(new Map(combined.map(s => [s.id, s])).values());

        setSubjects(uniqueSubjects as Subject[]);
      } catch (error: any) {
        console.error('Error fetching subjects:', error?.message || error);
        setSubjects([]);
      } finally {
        setLoadingSubjects(false);
      }
    };

    fetchSubjects();
  }, [user]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 20MB',
        variant: 'destructive',
      });
      return;
    }

    // Block NBT/MBT-related uploads if not in NBT mode
    const fileName = file.name.toLowerCase();
    const nbtMbtPatterns = ['nbt', 'mbt', 'national benchmark', 'benchmark test'];
    const isNbtMbt = nbtMbtPatterns.some(pattern => fileName.includes(pattern));
    if (isNbtMbt && mode !== 'nbt') {
      toast({
        title: 'Upload restricted',
        description: 'NBT/MBT test documents cannot be uploaded to study materials. These are protected assessment materials.',
        variant: 'destructive',
      });
      return;
    }

    const allowedTypes = ['application/pdf', 'text/plain', 'application/msword'];
    const allowedExtensions = ['.pdf', '.txt', '.doc', '.docx'];
    const hasValidExtension = allowedExtensions.some(ext =>
      fileName.endsWith(ext)
    );

    if (!allowedTypes.includes(file.type) && !hasValidExtension) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF, TXT, or Word document',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedFile || !user) return;

    if (!selectedDocumentSubject) {
      toast({
        title: 'Subject required',
        description: 'Please select a subject for your document.',
        variant: 'destructive',
      });
      return;
    }

    if (usage.documentCount >= limits.maxDocuments) {
      if (tier === 'free') {
        setIsUpgradeModalOpen(true);
      } else {
        toast({
          title: 'Document limit reached',
          description: `You have reached your limit of ${limits.maxDocuments} documents.`,
          variant: 'destructive',
        });
      }
      return;
    }

    if (storage && !storage.canUploadBySize(selectedFile.size)) {
      const remaining = storage.limitBytes - storage.totalBytesUsed;
      if (tier === 'free') {
        setIsUpgradeModalOpen(true);
      } else {
        toast({
          title: 'Storage limit exceeded',
          description: `You have ${formatBytes(remaining)} of storage remaining. Consider clearing some data.`,
          variant: 'destructive',
        });
      }
      return;
    }

    setIsUploadingDocument(true);
    setUploadProgress(0);
    setUploadStage('Initializing...');

    try {
      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      setUploadStage('Uploading to storage...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(fileName, selectedFile, {
          upsert: true
        });

      if (uploadError) throw uploadError;

      setUploadStage('Preparing document...');
      setUploadProgress(100);

      // Get signed URL
      const { data: signedData, error: signedError } = await supabase.storage
        .from('user-uploads')
        .createSignedUrl(fileName, 60 * 60 * 24 * 7);

      if (signedError) throw signedError;

      const fileUrl = signedData.signedUrl;

      setUploadStage('Saving to database...');

      // Create entry in the appropriate table
      let studyDocument: any;
      let knowledgeId: string | null = null;

      if (mode === 'nbt') {
        const { data: nbtData, error: nbtError } = await supabase
          .from('nbt_user_documents')
          .insert({
            user_id: user.id,
            title: selectedFile.name,
            section: selectedDocumentSubject,
            file_name: selectedFile.name,
            file_size: selectedFile.size,
            file_type: selectedFile.type,
            source_file_url: fileUrl,
            extraction_status: 'pending',
          })
          .select();

        if (nbtError) throw nbtError;
        studyDocument = nbtData?.[0];
      } else {
        // Create knowledge base entry
        const { data: knowledgeData, error: knowledgeError } = await supabase
          .from('knowledge_base')
          .insert({
            user_id: user.id,
            title: selectedFile.name,
            content: '',
            content_type: CONTENT_TYPES.DOCUMENT,
            source_file_url: fileUrl,
            subject_id: selectedDocumentSubject === 'general-studies' ? null : selectedDocumentSubject,
          })
          .select();

        if (knowledgeError) throw knowledgeError;

        knowledgeId = knowledgeData?.[0]?.id;

        // Create study document entry
        const { data: studyDocData, error: studyDocError } = await supabase
          .from('study_documents')
          .insert({
            user_id: user.id,
            knowledge_id: knowledgeId,
            file_name: selectedFile.name,
            file_size: selectedFile.size,
            file_type: selectedFile.type,
            subject_id: selectedDocumentSubject === 'general-studies' ? null : selectedDocumentSubject,
            extraction_status: 'pending',
          })
          .select();

        if (studyDocError) throw studyDocError;
        studyDocument = studyDocData?.[0];
      }

      setUploadStage('Finalizing...');

      // Track usage
      await incrementDocumentUsage(0);
      await updateStorageOnDocumentUpload(selectedFile.size);

      toast({
        title: 'Document uploaded successfully!',
        description: 'Your document is ready. You can now generate lessons manually.',
      });

      if (mode === 'nbt') {
        onUploadSuccess({
          ...studyDocument,
          isNbtDocument: true
        });
      } else {
        onUploadSuccess({
          ...studyDocument,
          knowledge_base: {
            id: knowledgeId,
            title: selectedFile.name,
            source_file_url: fileUrl,
            content: '',
            content_type: CONTENT_TYPES.DOCUMENT,
          },
        });
      }

      setSelectedFile(null);
      setSelectedDocumentSubject('');
      setUploadProgress(0);
      setUploadStage('');
      if (studyDocument?.id) {
        setTimeout(() => {
          onAutoNavigate?.(studyDocument.id);
        }, 1500);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploadingDocument(false);
      setUploadStage('');
    }
  };

  const handleAddYoutubeVideo = async () => {
    if (!youtubeUrl.trim() || !user) return;

    if (isStorageFull) {
      if (tier === 'free') {
        setIsUpgradeModalOpen(true);
      } else {
        toast({
          title: 'Storage limit reached',
          description: 'You have reached your storage limit. Please delete some documents to add more videos.',
          variant: 'destructive',
        });
      }
      return;
    }

    if (tier === 'free') {
      setIsUpgradeModalOpen(true);
      return;
    }

    if (!isValidYoutubeUrl(youtubeUrl)) {
      toast({
        title: 'Invalid YouTube URL',
        description: 'Please enter a valid YouTube URL',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedVideoSubject) {
      toast({
        title: 'Subject required',
        description: 'Please select a subject for your video.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingVideo(true);
    setVideoUploadStage('Initializing...');

    try {
      const videoId = extractYoutubeVideoId(youtubeUrl);
      const title = videoTitle || `YouTube Lesson - ${videoId}`;

      setVideoUploadStage('Saving video details...');

      // Create entry in the appropriate table
      let studyDocument: any;
      let knowledgeId: string | null = null;

      if (mode === 'nbt') {
        const { data: nbtData, error: nbtError } = await supabase
          .from('nbt_user_documents')
          .insert({
            user_id: user.id,
            title,
            section: selectedVideoSubject,
            file_name: title,
            file_type: 'video/youtube',
            source_file_url: youtubeUrl,
            extraction_status: 'processing',
          })
          .select();

        if (nbtError) throw nbtError;
        studyDocument = nbtData?.[0];
      } else {
        // Create knowledge base entry for video
        const { data: videoData, error: videoError } = await supabase
          .from('knowledge_base')
          .insert({
            user_id: user.id,
            title,
            content: JSON.stringify({ status: 'processing' }),
            content_type: CONTENT_TYPES.YOUTUBE_LESSON,
            source_file_url: youtubeUrl,
            subject_id: selectedVideoSubject === 'general-studies' ? null : selectedVideoSubject,
            tags: ['processing'],
          })
          .select();

        if (videoError) throw videoError;

        knowledgeId = videoData?.[0]?.id;

        // Create study document entry for video to allow navigation in Study Hub
        const { data: studyDocData, error: studyDocError } = await supabase
          .from('study_documents')
          .insert({
            user_id: user.id,
            knowledge_id: knowledgeId,
            file_name: title,
            file_type: 'video/youtube',
            subject_id: selectedVideoSubject === 'general-studies' ? null : selectedVideoSubject,
            extraction_status: 'processing',
          })
          .select();

        if (studyDocError) throw studyDocError;
        studyDocument = studyDocData?.[0];

        // Tag with subject if selected
        if (selectedVideoSubject && studyDocument?.id) {
          await tagMaterialWithSubject(studyDocument.id, selectedVideoSubject);
        }
      }

      setVideoUploadStage('Extracting transcript (this takes a moment)...');

      // Trigger video processing sequentially
      try {
        // Step 1: Get Transcript
const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke(
          'youtube-transcript',
          {
            body: { videoUrl: youtubeUrl },
          }
        );

        if (transcriptError || !transcriptData?.text) {
          throw new Error(transcriptError?.message || 'Failed to get transcript');
        }

        setVideoUploadStage('Finalizing video processing...');

        const transcriptLength = transcriptData.text.length;
        // Use transcript length as an estimated file size for storage accounting (1 char ≈ 1 byte)
        const estimatedSize = Math.max(1024 * 100, transcriptLength); // Min 100KB

        if (mode === 'nbt') {
          // Update nbt_user_documents with transcript
          await supabase
            .from('nbt_user_documents')
            .update({
              processed_content: transcriptData.text,
              content: transcriptData.text,
              extraction_status: 'completed',
              file_size: estimatedSize,
            })
            .eq('id', studyDocument.id);
        } else {
          // Step 3: Update knowledge_base with transcript
          await supabase
            .from('knowledge_base')
            .update({
              content: JSON.stringify({
                videoId,
                lesson: '', // Empty initially
                transcript: {
                  raw: transcriptData.text,
                  cleaned: transcriptData.text,
                },
                processedAt: new Date().toISOString(),
                status: 'completed',
              }),
              tags: ['completed', 'youtube'],
            })
            .eq('id', knowledgeId);

          // Step 4: Update corresponding study_documents record with transcript and estimated size
          await supabase
            .from('study_documents')
            .update({
              processed_content: transcriptData.text,
              extraction_status: 'completed',
              file_size: estimatedSize,
            })
            .eq('knowledge_id', knowledgeId);
        }

        // Account for YouTube video in storage
        await updateStorageOnDocumentUpload(estimatedSize);
        await incrementDocumentUsage(0);

        // Auto-navigate to the document after successful transcript extraction
        if (studyDocument?.id) {
          setTimeout(() => {
            onAutoNavigate?.(studyDocument.id);
          }, 1500);
        }

        toast({
          title: 'YouTube video added!',
          description: 'Transcript extracted! Click on the video in Study Hub to generate your lesson.',
        });
      } catch (flowError: any) {
        console.error('Error in YouTube processing flow:', flowError);

        if (mode === 'nbt') {
          await supabase
            .from('nbt_user_documents')
            .update({
              extraction_status: 'failed',
            })
            .eq('id', studyDocument.id);
        } else {
          await supabase
            .from('knowledge_base')
            .update({
              tags: ['failed', 'youtube'],
            })
            .eq('id', knowledgeId);
        }

        toast({
          title: 'Processing Failed',
          description: flowError.message || 'Failed to generate lesson from video.',
          variant: 'destructive',
        });
      }

      if (mode === 'nbt') {
        onUploadSuccess({
          ...studyDocument,
          isNbtDocument: true
        });
      } else {
        onUploadSuccess({
          ...studyDocument,
          knowledge_base: {
            id: knowledgeId,
            title,
            source_file_url: youtubeUrl,
            content: JSON.stringify({ status: 'processing' }),
            content_type: CONTENT_TYPES.YOUTUBE_LESSON,
          },
        });
      }

      setYoutubeUrl('');
      setVideoTitle('');
      setSelectedVideoSubject('');
    } catch (error: any) {
      console.error('Error adding YouTube video:', error);
      toast({
        title: 'Failed to add video',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploadingVideo(false);
      setVideoUploadStage('');
    }
  };

  return (
    <div className="space-y-3">
      {/* Document Upload */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setIsDocumentSectionExpanded(!isDocumentSectionExpanded)}
          className="w-full flex items-center justify-between gap-3 p-5 hover:bg-secondary/30 transition-colors"
        >
          <div className="flex items-center gap-3 flex-1">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-foreground">Upload Document</h3>
              <p className="text-xs text-muted-foreground mt-0.5">PDF, Word, or text files (max 20MB)</p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-muted-foreground transition-transform flex-shrink-0 ${
              isDocumentSectionExpanded ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </button>

        {isDocumentSectionExpanded && (
          <div className="px-5 pb-5 pt-0 border-t border-border/50 space-y-3">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30 hover:bg-secondary/30'
              }`}
            >
              <Upload className="w-7 h-7 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium text-foreground">
                Drag and drop your file
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                or
                <Input
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.txt,.doc,.docx"
                  className="hidden"
                  id="document-input"
                />
                <label htmlFor="document-input" className="text-primary hover:underline cursor-pointer ml-1">
                  click to select
                </label>
              </p>
            </div>

            {selectedFile && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-3">
                <FileText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(selectedFile.size)}
                  </p>
                </div>
              </div>
            )}

            {/* Subject Selection */}
            {selectedFile && (
              <div>
                <Label htmlFor="doc-subject" className="text-xs font-medium text-muted-foreground mb-1.5">
                  {mode === 'nbt' ? 'NBT Section' : 'Subject'} <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedDocumentSubject} onValueChange={setSelectedDocumentSubject}>
                  <SelectTrigger id="doc-subject" className={`h-9 text-sm ${!selectedDocumentSubject && 'border-destructive/50'}`}>
                    <SelectValue placeholder={loadingSubjects ? (mode === 'nbt' ? 'Loading sections...' : 'Loading subjects...') : (mode === 'nbt' ? 'Select a section' : 'Select a subject')} />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!selectedDocumentSubject && (
                  <p className="text-[10px] text-destructive mt-1">Please select a {mode === 'nbt' ? 'section' : 'subject'} to continue</p>
                )}
              </div>
            )}

            <Button
              onClick={handleUploadDocument}
              disabled={!selectedFile || isUploadingDocument}
              className="w-full relative overflow-hidden"
              size="sm"
            >
              {isUploadingDocument ? (
                <div className="flex flex-col items-center gap-1 py-1 w-full">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-xs font-semibold">{uploadStage}</span>
                  </div>
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="w-full px-4">
                      <Progress value={uploadProgress} className="h-1 bg-primary-foreground/20" />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </>
              )}
            </Button>

            {isUploadingDocument && (
              <p className="text-[10px] text-center text-muted-foreground animate-pulse">
                Please don't close this tab while we process your file
              </p>
            )}
          </div>
        )}
      </div>

      {/* YouTube Upload */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setIsVideoSectionExpanded(!isVideoSectionExpanded)}
          className="w-full flex items-center justify-between gap-3 p-5 hover:bg-secondary/30 transition-colors"
        >
          <div className="flex items-center gap-3 flex-1">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-foreground">Add YouTube Video</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Extract lessons and transcripts automatically</p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-muted-foreground transition-transform flex-shrink-0 ${
              isVideoSectionExpanded ? 'rotate-0' : '-rotate-90'
            }`}
          />
        </button>

        {isVideoSectionExpanded && (
          <div className="px-5 pb-5 pt-0 border-t border-border/50 space-y-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-1.5" htmlFor="youtube-url">
                YouTube URL
              </Label>
              <Input
                id="youtube-url"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                disabled={isUploadingVideo}
                className="h-9 text-sm"
              />
            </div>

            {isValidYoutubeUrl(youtubeUrl) && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-1.5" htmlFor="video-title">
                    Video Title (Optional)
                  </Label>
                  <Input
                    id="video-title"
                    type="text"
                    placeholder="Custom title for this video"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    disabled={isUploadingVideo}
                    className="h-9 text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="video-subject" className="text-xs font-medium text-muted-foreground mb-1.5">
                    {mode === 'nbt' ? 'NBT Section' : 'Subject'} <span className="text-destructive">*</span>
                  </Label>
                  <Select value={selectedVideoSubject} onValueChange={setSelectedVideoSubject}>
                    <SelectTrigger id="video-subject" className={`h-9 text-sm ${!selectedVideoSubject && 'border-destructive/50'}`}>
                      <SelectValue placeholder={loadingSubjects ? (mode === 'nbt' ? 'Loading sections...' : 'Loading subjects...') : (mode === 'nbt' ? 'Select a section' : 'Select a subject')} />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedVideoSubject && (
                    <p className="text-[10px] text-destructive mt-1">Please select a {mode === 'nbt' ? 'section' : 'subject'} to continue</p>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={handleAddYoutubeVideo}
              disabled={!youtubeUrl.trim() || !isValidYoutubeUrl(youtubeUrl) || isUploadingVideo}
              className="w-full relative overflow-hidden"
              size="sm"
            >
              {isUploadingVideo ? (
                <div className="flex flex-col items-center gap-1 py-1 w-full">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-xs font-semibold">{videoUploadStage}</span>
                  </div>
                </div>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                  Add Video
                </>
              )}
            </Button>

            {isUploadingVideo && (
              <p className="text-[10px] text-center text-muted-foreground animate-pulse">
                Extracting transcript... this can take up to a minute for long videos
              </p>
            )}
          </div>
        )}
      </div>

      <UpgradeModal
        open={isUpgradeModalOpen}
        onOpenChange={(open) => setIsUpgradeModalOpen(open)}
      />
    </div>
  );
};

export default CombinedUploadSection;

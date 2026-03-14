import { useState, useEffect, useCallback } from 'react';
import { FileText, Youtube, Clock, Sparkles, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import NBTMaterialView from './NBTMaterialView';

interface NBTDocument {
  id: string;
  title: string;
  file_name: string;
  file_type: string | null;
  section: string;
  extraction_status: string | null;
  created_at: string | null;
  content: string | null;
  processed_content: string | null;
  source_file_url: string | null;
}

const NBTDocuments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<NBTDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingDocument, setViewingDocument] = useState<any>(null);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('nbt_user_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      console.error('Error fetching NBT documents:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      // 1. Delete generated lessons referencing this document
      await supabase.from('nbt_generated_lessons').delete().eq('source_document_id', docId);
      // 2. Delete study materials referencing this document
      await supabase.from('nbt_study_materials').delete().eq('source_document_id', docId);
      // 3. Delete the document itself
      const { error } = await supabase.from('nbt_user_documents').delete().eq('id', docId);
      if (error) throw error;
      setDocuments(prev => prev.filter(d => d.id !== docId));
      toast({ title: 'Deleted', description: 'Document removed.' });
    } catch (err: any) {
      console.error('Delete error:', err);
      toast({ title: 'Error', description: 'Failed to delete document.', variant: 'destructive' });
    }
  };

  if (viewingDocument) {
    return (
      <NBTMaterialView
        material={{
          id: viewingDocument.id,
          title: viewingDocument.title || viewingDocument.file_name,
          content: viewingDocument.processed_content || viewingDocument.content || '',
          section: viewingDocument.section,
          material_type: viewingDocument.file_type?.includes('youtube') ? 'video' : 'notes',
          topic: 'My Upload',
          isUserUpload: true,
          document: viewingDocument,
        }}
        onClose={() => setViewingDocument(null)}
        onRefresh={fetchDocuments}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          My NBT Documents
        </h2>
        <p className="text-muted-foreground mt-1">
          All documents and content you've generated in the NBT section.
        </p>
      </div>

      {documents.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="text-lg font-bold text-foreground mb-2">No documents yet</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Upload documents or add YouTube videos in the Study Materials tab to start generating NBT-specific content.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map(doc => (
            <Card
              key={doc.id}
              className="hover:shadow-lg transition-all cursor-pointer group border-none shadow-sm"
              onClick={() => setViewingDocument(doc)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    {doc.file_type?.includes('youtube') ? (
                      <Youtube className="w-5 h-5 text-primary" />
                    ) : (
                      <FileText className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <h4 className="font-bold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                  {doc.title || doc.file_name}
                </h4>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 text-xs">
                    {doc.section}
                  </Badge>
                  {doc.extraction_status === 'completed' ? (
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-950/20 text-xs">
                      <Sparkles className="w-3 h-3 mr-1" /> Ready
                    </Badge>
                  ) : doc.extraction_status === 'processing' ? (
                    <Badge variant="outline" className="text-amber-600 border-amber-200 text-xs">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing
                    </Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Unknown'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default NBTDocuments;

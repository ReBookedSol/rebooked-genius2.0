import React from 'react';
import { extractYoutubeVideoId } from '@/lib/constants';
import { Youtube, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface YoutubeViewerProps {
  videoUrl: string;
}

export const YoutubeViewer: React.FC<YoutubeViewerProps> = ({ videoUrl }) => {
  const videoId = extractYoutubeVideoId(videoUrl);

  if (!videoId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
          <Youtube className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="font-bold text-lg">Invalid Video URL</h3>
          <p className="text-muted-foreground max-w-sm">
            We couldn't extract a valid YouTube video ID from the provided URL.
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => window.open(videoUrl, '_blank')}
          className="gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Open Link in New Tab
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background w-full overflow-hidden">
      {/* Immersive Video Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 lg:p-12 bg-muted/20">
        <div className="w-full max-w-5xl aspect-video relative group shadow-2xl rounded-2xl overflow-hidden border border-border/50">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
        
        <div className="mt-8 flex flex-col items-center text-center space-y-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full">
            <Youtube className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">YouTube Material</span>
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            Study directly from the video. Transcripts are hidden to help you focus on the visual and auditory learning.
          </p>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank')}
            className="text-muted-foreground hover:text-primary gap-2"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Watch on YouTube
          </Button>
        </div>
      </div>
    </div>
  );
};

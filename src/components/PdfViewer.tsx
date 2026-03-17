import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { useSidebar } from '@/contexts/SidebarContext';

// Configure PDF.js worker - use local file from public folder
// Using version 4.8.69 to match react-pdf's bundled pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PdfViewerProps {
  fileUrl: string;
}

export const PdfViewer = ({ fileUrl }: PdfViewerProps) => {
  const { isContentExpanded, isChatExpanded, chatWidth, isExpanded } = useSidebar();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [scaleInput, setScaleInput] = useState('100');
  const [loading, setLoading] = useState(true);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  // Handle responsive resize
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (numPages && currentPage < numPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const zoomIn = () => {
    const newScale = Math.min(scale + 0.1, 2.5);
    setScale(newScale);
    setScaleInput(Math.round(newScale * 100).toString());
  };

  const zoomOut = () => {
    const newScale = Math.max(scale - 0.1, 0.5);
    setScale(newScale);
    setScaleInput(Math.round(newScale * 100).toString());
  };

  const handleScaleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setScaleInput(value);

    // Parse the input and validate
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      const clampedScale = Math.min(Math.max(numValue / 100, 0.5), 2.5);
      setScale(clampedScale);
    }
  };

  const handleScaleInputBlur = () => {
    // Ensure the input shows the actual scale if invalid input was given
    const numValue = parseInt(scaleInput, 10);
    if (isNaN(numValue) || numValue < 50 || numValue > 250) {
      setScaleInput(Math.round(scale * 100).toString());
    }
  };

  // Calculate available width for PDF
  const getAvailableWidth = () => {
    let available = window.innerWidth;

    if (isDesktop && !isContentExpanded) {
      // Subtract left sidebar
      available -= isExpanded ? 224 : 80;
      available -= 24; // padding
    }

    if (isDesktop && isChatExpanded) {
      // Subtract right chat panel
      available -= chatWidth;
    }

    // Add some padding
    return Math.max(300, available * 0.95);
  };

  const pdfWidth = getAvailableWidth() * scale;

  return (
    <div className="flex flex-col h-full bg-background w-full">
      {/* Controls - Premium floating feel */}
      <div className="sticky top-0 z-20 w-full border-b border-border/50 bg-background/80 backdrop-blur-md px-4 py-2 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-1.5">
          <Button
            size="icon"
            variant="ghost"
            onClick={goToPreviousPage}
            disabled={currentPage <= 1}
            className="h-9 w-9 hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="px-3 py-1 bg-muted rounded-full text-xs font-bold tracking-tight text-muted-foreground flex items-center gap-1">
            <span className="text-foreground">{loading ? '...' : currentPage}</span>
            <span>/</span>
            <span>{numPages || '...'}</span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={goToNextPage}
            disabled={!numPages || currentPage >= numPages}
            className="h-9 w-9 hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="icon"
            variant="ghost"
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="h-9 w-9 hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <ZoomOut className="w-5 h-5" />
          </Button>
          <input
            type="number"
            min="50"
            max="250"
            value={scaleInput}
            onChange={handleScaleInputChange}
            onBlur={handleScaleInputBlur}
            className="w-12 text-center text-xs font-bold bg-muted border border-border/50 rounded px-1.5 py-1 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            placeholder="100"
          />
          <span className="text-xs font-bold text-muted-foreground">%</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={zoomIn}
            disabled={scale >= 2.5}
            className="h-9 w-9 hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <ZoomIn className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* PDF Viewer Container - Immersive feel */}
      <div className="flex-1 overflow-auto bg-muted/20 dark:bg-slate-950/50 flex items-center justify-center py-6 md:py-10 custom-scrollbar w-full gap-4">
        {/* Left Navigation Button */}
        <Button
          size="icon"
          variant="ghost"
          onClick={goToPreviousPage}
          disabled={currentPage <= 1}
          className="h-12 w-12 rounded-full hover:bg-primary/10 hover:text-primary transition-colors flex-shrink-0"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>

        {/* PDF Content Container */}
        <div className="flex flex-col items-center">
          <div className="relative group transition-all duration-500 ease-out max-w-full">
            {/* Paper shadow effect */}
            <div className="absolute inset-0 bg-black/5 dark:bg-black/20 blur-2xl transform translate-y-4 scale-95 opacity-50 group-hover:opacity-100 transition-opacity" />

            <div className="relative bg-white dark:bg-slate-900 border border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] flex flex-col items-center overflow-hidden transition-all duration-300">
              {/* {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  </div>
                </div>
              )} */}

              <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={null}
                className="flex flex-col items-center"
              >
                <div className="relative">
                  <Page
                    pageNumber={currentPage}
                    scale={scale}
                    className="transition-transform duration-300"
                    loading={null}
                    width={pdfWidth}
                  />
                </div>
              </Document>
            </div>
          </div>

          {/* Page indicator at bottom */}
          <div className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
            <span>Page {currentPage} of {numPages}</span>
          </div>
        </div>

        {/* Right Navigation Button */}
        <Button
          size="icon"
          variant="ghost"
          onClick={goToNextPage}
          disabled={!numPages || currentPage >= numPages}
          className="h-12 w-12 rounded-full hover:bg-primary/10 hover:text-primary transition-colors flex-shrink-0"
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
};

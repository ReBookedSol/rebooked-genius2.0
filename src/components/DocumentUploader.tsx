import { useState, useCallback, useRef } from 'react';
import { Upload, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProcessedDocument, chunkDocument } from '@/lib/documentProcessor';
import { extractTextFromPDFInBatches, extractTextFile, extractDOCXText, PDFBatch } from '@/lib/pdfExtractor';
import { cn } from '@/lib/utils';

interface DocumentUploaderProps {
  onDocumentProcessed: (document: ProcessedDocument) => void;
  onPDFBatchReady: (batches: PDFBatch[]) => void;
  isProcessing: boolean;
}

export function DocumentUploader({
  onDocumentProcessed,
  onPDFBatchReady,
  isProcessing,
}: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setError(null);

      try {
        const maxSize = 20 * 1024 * 1024; // 20MB
        if (file.size > maxSize) {
          throw new Error('File size exceeds 20MB limit');
        }

        const allowedExtensions = ['.pdf', '.txt', '.doc', '.docx'];
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];

        const fileName = file.name.toLowerCase();
        const hasValidExtension = allowedExtensions.some((ext) =>
          fileName.endsWith(ext)
        );
        const isImage = imageExtensions.some((ext) => fileName.endsWith(ext));

        if (isImage) {
          throw new Error('Images are not supported. Please upload a text-based document (PDF, Word, or TXT).');
        }

        if (!hasValidExtension) {
          throw new Error('Invalid file type. Please upload PDF, TXT, or Word document');
        }

        let text = '';
        let isBatchedPDF = false;

        // Extract text based on file type
        if (file.name.toLowerCase().endsWith('.pdf')) {
          // Use PDF.js for proper text extraction with batch support
          const result = await extractTextFromPDFInBatches(file);

          if (result.error) {
            throw new Error(result.error);
          }

          // For PDFs, return batches directly for proper processing
          if (result.batches.length > 0) {
            onPDFBatchReady(result.batches);
            isBatchedPDF = true;
          }
        } else if (file.name.toLowerCase().endsWith('.docx')) {
          const result = await extractDOCXText(file);
          text = result.text;
        } else {
          const result = await extractTextFile(file);
          text = result.text;
        }

        if (!isBatchedPDF) {
          // For non-PDF files
          if (!text || text.trim().length === 0) {
            throw new Error('No text content found in file');
          }

          const processedDocument = chunkDocument(text);
          onDocumentProcessed(processedDocument);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to process file';
        setError(message);
        console.error('Error processing file:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [onDocumentProcessed, onPDFBatchReady]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.currentTarget.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card>
      <CardHeader
        className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            Upload Document
          </CardTitle>
          {isExpanded ? <ChevronUp /> : <ChevronDown />}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 transition-colors text-center',
              isDragging ? 'border-primary bg-primary/5' : 'border-border',
              (isLoading || isProcessing) && 'opacity-50 cursor-not-allowed'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-3">
              {isLoading ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="font-medium">Processing file...</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Drag and drop your file here</p>
                    <p className="text-sm text-muted-foreground">or click to select</p>
                  </div>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isLoading || isProcessing}
            />
            <Button
              onClick={handleClick}
              disabled={isLoading || isProcessing}
              className="mt-4"
            >
              Select File
            </Button>
          </div>

          {/* File Info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Supported formats:</p>
            <ul className="space-y-0.5">
              <li>• PDF documents (processed in 50-page batches)</li>
              <li>• Word documents (.docx)</li>
              <li>• Text files (.txt)</li>
              <li>• Maximum file size: 20MB</li>
            </ul>
            <div className="pt-2 text-foreground">
              <p>Lessons generated using Google Gemini 2.0 Flash Lite</p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      )}
    </Card>
  );
}

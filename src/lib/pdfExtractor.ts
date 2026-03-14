// PDF text extraction utility using PDF.js from CDN
// Supports batch processing of 50 pages at a time

export interface PDFExtractionResult {
  text: string;
  pageCount: number;
  error?: string;
}

export interface PDFBatch {
  batchNumber: number;
  totalBatches: number;
  startPage: number;
  endPage: number;
  pagesInBatch: number;
  text: string;
}

export interface PDFBatchResult {
  batches: PDFBatch[];
  totalPages: number;
  error?: string;
}

const PAGES_PER_BATCH = 50;

// Dynamically load PDF.js from CDN
async function loadPdfJs(): Promise<any> {
  // Check if already loaded
  if ((window as any).pdfjsLib) {
    return (window as any).pdfjsLib;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(pdfjsLib);
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js library'));
    document.head.appendChild(script);
  });
}

/**
 * Extract text from a specific range of pages
 */
async function extractPagesRange(
  pdf: any,
  startPage: number,
  endPage: number
): Promise<string> {
  const textParts: string[] = [];
  
  for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    const pageText = textContent.items
      .map((item: any) => {
        if ('str' in item) {
          return item.str;
        }
        return '';
      })
      .join(' ');
    
    textParts.push(`\n--- Page ${pageNum} ---\n\n${pageText}`);
  }
  
  return textParts.join('\n');
}

/**
 * Extract text from PDF in batches of 50 pages
 */
export async function extractTextFromPDFInBatches(
  file: File,
  onBatchComplete?: (batch: PDFBatch) => void
): Promise<PDFBatchResult> {
  try {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const totalPages = pdf.numPages;
    const totalBatches = Math.ceil(totalPages / PAGES_PER_BATCH);

    console.log(`PDF has ${totalPages} pages, processing in ${totalBatches} batches of ${PAGES_PER_BATCH} pages`);

    // Process batches in parallel
    const batchPromises = [];
    for (let batchNum = 1; batchNum <= totalBatches; batchNum++) {
      const startPage = (batchNum - 1) * PAGES_PER_BATCH + 1;
      const endPage = Math.min(batchNum * PAGES_PER_BATCH, totalPages);
      const pagesInBatch = endPage - startPage + 1;

      batchPromises.push((async () => {
        console.log(`Extracting batch ${batchNum}/${totalBatches}: pages ${startPage}-${endPage}`);
        const text = await extractPagesRange(pdf, startPage, endPage);

        const batch: PDFBatch = {
          batchNumber: batchNum,
          totalBatches,
          startPage,
          endPage,
          pagesInBatch,
          text,
        };

        if (onBatchComplete) {
          onBatchComplete(batch);
        }
        return batch;
      })());
    }

    const batches = await Promise.all(batchPromises);
    // Sort batches by number just in case
    batches.sort((a, b) => a.batchNumber - b.batchNumber);

    return {
      batches,
      totalPages,
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
    return {
      batches: [],
      totalPages: 0,
      error: error instanceof Error ? error.message : 'Failed to extract PDF text',
    };
  }
}

/**
 * Extract all text from PDF (legacy single extraction)
 */
export async function extractTextFromPDF(file: File): Promise<PDFExtractionResult> {
  const result = await extractTextFromPDFInBatches(file);
  
  if (result.error) {
    return {
      text: '',
      pageCount: 0,
      error: result.error,
    };
  }
  
  const combinedText = result.batches.map(b => b.text).join('\n');
  
  return {
    text: combinedText,
    pageCount: result.totalPages,
  };
}

/**
 * Check if a file is a PDF
 */
export function isPDFFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Get batch info for chunk processing
 */
export function getBatchInfoForChunk(
  batchNumber: number,
  totalBatches: number,
  pagesInBatch: number
) {
  return {
    batchNumber,
    totalBatches,
    pagesInBatch,
  };
}

/**
 * Extract text from DOCX file (basic extraction)
 */
export async function extractDOCXText(file: File): Promise<{ text: string; pages: number }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const text = extractTextFromDOCX(arrayBuffer);
    
    const estimatedPages = Math.ceil(text.length / 3000);
    
    return {
      text,
      pages: estimatedPages,
    };
  } catch (error) {
    console.error('Error extracting DOCX text:', error);
    throw new Error('Failed to extract text from Word document');
  }
}

/**
 * Extract text from plain text file
 */
export async function extractTextFile(file: File): Promise<{ text: string; pages: number }> {
  try {
    const text = await file.text();
    const estimatedPages = Math.ceil(text.length / 3000);
    
    return {
      text,
      pages: estimatedPages,
    };
  } catch (error) {
    console.error('Error extracting text file:', error);
    throw new Error('Failed to extract text from file');
  }
}

/**
 * Create batches from text (for non-PDF files with estimated page count)
 * This is a fallback for when we have pre-extracted text
 */
export function createBatches(text: string, estimatedPages: number): PDFBatch[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const totalBatches = Math.ceil(estimatedPages / PAGES_PER_BATCH);
  const charsPerPage = text.length / estimatedPages;
  const charsPerBatch = charsPerPage * PAGES_PER_BATCH;

  const batches: PDFBatch[] = [];
  let currentIndex = 0;

  for (let i = 0; i < totalBatches; i++) {
    const startIndex = currentIndex;
    let endIndex = Math.min(currentIndex + charsPerBatch, text.length);

    // Try to break at a sentence boundary
    if (endIndex < text.length) {
      const lookBackLength = Math.min(1000, charsPerBatch / 2);
      for (let j = endIndex; j >= Math.max(startIndex + charsPerBatch / 2, endIndex - lookBackLength); j--) {
        if (text[j] === '.' || text[j] === '\n') {
          endIndex = j + 1;
          break;
        }
      }
    }

    const batchText = text.substring(startIndex, endIndex).trim();
    
    if (batchText.length > 0) {
      batches.push({
        batchNumber: i + 1,
        totalBatches,
        startPage: Math.floor(startIndex / charsPerPage) + 1,
        endPage: Math.floor(endIndex / charsPerPage) + 1,
        pagesInBatch: Math.ceil((endIndex - startIndex) / charsPerPage),
        text: batchText,
      });
    }

    currentIndex = endIndex;
  }

  return batches;
}

/**
 * Simple text extraction from DOCX buffer
 */
function extractTextFromDOCX(buffer: ArrayBuffer): string {
  try {
    // DOCX files are ZIP archives, extract text from XML
    const view = new Uint8Array(buffer);
    
    // Simple extraction - look for text between XML tags
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const decoded = decoder.decode(view);
    
    // Extract text between <w:t> tags (Word text elements)
    const textMatches = decoded.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
    if (textMatches) {
      const text = textMatches
        .map((match) => match.replace(/<[^>]+>/g, ''))
        .join(' ');
      
      if (text.length > 0) {
        return text;
      }
    }
    
    // Fallback: extract any readable text
    return decoded
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Unable to extract text from Word document.';
  } catch (error) {
    console.error('Error in extractTextFromDOCX:', error);
    return 'Unable to extract text from Word document.';
  }
}

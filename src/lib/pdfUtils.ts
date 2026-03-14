// PDF utilities for image extraction and processing

// Dynamically load PDF.js from CDN (reusing logic from pdfExtractor.ts)
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
 * Render the first page of a PDF as a base64-encoded image
 * @param file The PDF file to process
 * @param scale The scale at which to render the page (default 1.5 for OCR)
 * @returns Base64 string of the image (JPEG)
 */
export async function getPDFFirstPageAsImage(file: File, scale: number = 1.5): Promise<{ base64: string; mimeType: string }> {
  try {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    if (pdf.numPages === 0) {
      throw new Error('PDF has no pages');
    }

    // Get the first page
    const page = await pdf.getPage(1);

    // Set up viewport
    const viewport = page.getViewport({ scale });

    // Prepare canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get canvas context');
    }

    // Cap dimensions to ensure we don't exceed edge function payload limits
    // Max width/height of ~1600px is usually enough for AI analysis
    const MAX_DIMENSION = 1600;
    let finalScale = scale;

    if (viewport.width > MAX_DIMENSION || viewport.height > MAX_DIMENSION) {
      finalScale = MAX_DIMENSION / Math.max(viewport.width, viewport.height) * scale;
    }

    const finalViewport = page.getViewport({ scale: finalScale });

    canvas.height = finalViewport.height;
    canvas.width = finalViewport.width;

    // Render page into canvas
    await page.render({
      canvasContext: context,
      viewport: finalViewport
    }).promise;

    // Convert canvas to base64 with higher quality for better OCR
    // 0.8 is a good balance for OCR
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    console.log(`Extracted first page of ${file.name}. Image size: ${Math.round(base64.length / 1024)} KB. Dimensions: ${canvas.width}x${canvas.height}`);

    return {
      base64,
      mimeType: 'image/jpeg'
    };
  } catch (error) {
    console.error('Error rendering PDF page as image:', error);
    throw error;
  }
}

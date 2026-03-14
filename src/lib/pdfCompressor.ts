/**
 * Client-side PDF compression utility
 * Preserves quality while reducing file size through metadata stripping
 * and efficient re-encoding
 */

import { PDFDocument } from 'pdf-lib';

interface CompressionResult {
  compressedBlob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

/**
 * Compress a PDF file while preserving visual quality using pdf-lib.
 * This is safe and won't corrupt the PDF structure like manual string manipulation.
 */
export const compressPDF = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<CompressionResult> => {
  const originalSize = file.size;
  let arrayBuffer: ArrayBuffer | null = null;

  try {
    onProgress?.(10);
    // Read the file once and keep it in memory. This prevents "FileNotFound" errors
    // if the original File reference is lost or consumed during the compression process.
    arrayBuffer = await file.arrayBuffer();
    onProgress?.(30);

    const pdfDoc = await PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
      throwOnInvalidObject: false
    });
    onProgress?.(40);

    // Create a NEW document to copy pages into.
    // This is one of the most effective ways in pdf-lib to "clean" a PDF
    // and remove unused objects, streams, and dead metadata.
    const compressedDoc = await PDFDocument.create();
    const pageIndices = pdfDoc.getPageIndices();
    const copiedPages = await compressedDoc.copyPages(pdfDoc, pageIndices);

    onProgress?.(60);

    // Add pages to the new document
    copiedPages.forEach((page) => compressedDoc.addPage(page));

    // Metadata stripping on the new document
    console.log(`Applying metadata stripping to ${file.name}`);
    compressedDoc.setTitle('');
    compressedDoc.setAuthor('');
    compressedDoc.setSubject('');
    compressedDoc.setKeywords([]);
    compressedDoc.setProducer('');
    compressedDoc.setCreator('');
    compressedDoc.setModificationDate(new Date());
    compressedDoc.setCreationDate(new Date());

    onProgress?.(80);

    // Save with maximum compression features
    console.log(`Saving optimized PDF bytes for ${file.name}`);
    const optimizedBytes = await compressedDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      updateFieldAppearances: false
    });

    onProgress?.(95);
    console.log(`PDF compression successful for ${file.name}: ${formatFileSize(originalSize)} -> ${formatFileSize(optimizedBytes.length)}`);

    // Create a new File object from the optimized bytes to maintain file identity
    // Use File instead of Blob to ensure Supabase and other consumers get expected metadata
    const optimizedFile = new File([optimizedBytes as BlobPart], file.name, {
      type: 'application/pdf',
      lastModified: new Date().getTime()
    });
    onProgress?.(100);

    return {
      compressedBlob: optimizedFile,
      originalSize,
      compressedSize: optimizedFile.size,
      compressionRatio: originalSize / optimizedFile.size,
    };
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error(`PDF compression failed for ${file.name}. Error: ${errorMsg}`, errorStack);
    onProgress?.(100);

    // If we have already read the file into memory, use that as fallback.
    // This is much safer than returning the original File object which might
    // have been "consumed" or lost its reference to the underlying data.
    let fallbackFile: File | Blob = file;
    if (arrayBuffer) {
      console.log(`Using in-memory fallback for ${file.name} after compression failure`);
      fallbackFile = new File([arrayBuffer], file.name, {
        type: 'application/pdf',
        lastModified: file.lastModified
      });
    } else {
      console.warn(`No in-memory buffer available for ${file.name} fallback. Original File reference will be used.`);
      // Special check for NotFoundError which often means the file reference is dead
      if (errorMsg.includes('NotFoundError') || errorMsg.includes('File not found')) {
        console.error(`CRITICAL: Original file reference for ${file.name} is missing/invalid. Upload will likely fail.`);
      }
    }

    return {
      compressedBlob: fallbackFile,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
    };
  }
};

/**
 * Upload a PDF to Supabase storage (no destructive compression)
 */
export const uploadCompressedPDF = async (
  supabase: any,
  blob: Blob,
  fileName: string,
  userId: string,
  bucket: string = 'documents',
  retries: number = 3,
  customPath?: string
): Promise<string> => {
  const timestamp = Date.now();
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = customPath || `past-papers/${userId}/${timestamp}_${sanitizedName}`;

  console.log(`Starting upload to ${bucket}/${storagePath}. Type: ${blob instanceof File ? 'File' : 'Blob'}, Size: ${formatFileSize(blob.size)}`);

  // Builder Fusion Environment Note: Large uploads (>10MB) via fetch can sometimes fail
  // with "Failed to fetch" due to proxy limits or blob reference issues.
  // Converting to ArrayBuffer before upload can help by forcing the browser to resolve the data.
  let uploadData: any = blob;

  if (blob.size > 5 * 1024 * 1024) {
    console.log(`Large file detected (${formatFileSize(blob.size)}), attempting to resolve to ArrayBuffer for more stable upload...`);
    try {
      uploadData = await blob.arrayBuffer();
      console.log(`Successfully resolved ${fileName} to ArrayBuffer (${uploadData.byteLength} bytes)`);
    } catch (err) {
      console.warn(`Failed to resolve ${fileName} to ArrayBuffer. Proceeding with original blob. Error:`, err);
    }
  }

  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, uploadData, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(storagePath);

      return urlData.publicUrl;
    } catch (error: any) {
      console.error(`Upload attempt ${i + 1} failed for ${fileName}:`, error);
      lastError = error;

      // If we failed to fetch on the first attempt with a Blob, try converting to ArrayBuffer for the next attempt
      if (i === 0 && uploadData instanceof Blob && (error.message?.includes('Failed to fetch') || error.name === 'TypeError')) {
        console.log(`Retrying ${fileName} with ArrayBuffer conversion due to fetch error...`);
        try {
          uploadData = await blob.arrayBuffer();
        } catch (convErr) {
          console.error(`Failed to convert ${fileName} to ArrayBuffer during retry:`, convErr);
        }
      }

      if (i < retries - 1) {
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  throw new Error(`Upload failed for ${fileName} after ${retries} attempts: ${lastError?.message || 'Unknown error'}`);
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

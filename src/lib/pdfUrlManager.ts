import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches a PDF with automatic signed URL regeneration if the stored URL has expired.
 * This solves the issue of 400 errors from expired signed URLs.
 * 
 * @param fileUrl - The original file URL (can be signed or public)
 * @param storagePath - Optional storage path (user-uploads/userId/timestamp.ext) to regenerate signed URL if needed
 * @returns Promise<Blob> - The PDF file as a blob
 * @throws Error if the PDF cannot be fetched or signed URL cannot be generated
 */
export async function fetchPDFWithFreshSignedUrl(
  fileUrl: string,
  storagePath?: string
): Promise<Blob> {
  try {
    // First, try fetching with the provided URL
    const response = await fetch(fileUrl);
    
    if (response.ok) {
      return await response.blob();
    }
    
    // If we get a 400 or 403 error and have a storage path, regenerate the signed URL
    if ((response.status === 400 || response.status === 403) && storagePath) {
      console.warn(`PDF URL expired (${response.status}), regenerating signed URL for path: ${storagePath}`);
      
      // Extract bucket name from the storage path or default to 'user-uploads'
      const bucket = extractBucketFromPath(storagePath) || 'user-uploads';
      const path = cleanStoragePath(storagePath);
      
      // Generate a fresh signed URL valid for 7 days
      const { data: signedData, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
      
      if (signedError) {
        throw new Error(`Failed to regenerate signed URL: ${signedError.message}`);
      }
      
      if (!signedData?.signedUrl) {
        throw new Error('No signed URL generated');
      }
      
      // Retry fetch with the fresh signed URL
      const retryResponse = await fetch(signedData.signedUrl);
      
      if (!retryResponse.ok) {
        throw new Error(`Failed to fetch PDF: ${retryResponse.status} ${retryResponse.statusText}`);
      }
      
      return await retryResponse.blob();
    }
    
    // If no signed URL regeneration available or other status code
    throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
  } catch (error: any) {
    console.error('Error fetching PDF:', error);
    throw error;
  }
}

/**
 * Extract bucket name from a storage path (e.g., "user-uploads/userId/file.pdf" -> "user-uploads")
 */
function extractBucketFromPath(path: string): string | null {
  if (!path) return null;
  
  const buckets = ['user-uploads', 'chat-attachments', 'past-papers', 'documents'];
  for (const bucket of buckets) {
    if (path.includes(bucket)) {
      return bucket;
    }
  }
  
  return null;
}

/**
 * Clean storage path by removing bucket prefix if present
 */
function cleanStoragePath(path: string): string {
  if (!path) return path;
  
  const buckets = ['user-uploads', 'chat-attachments', 'past-papers', 'documents'];
  
  for (const bucket of buckets) {
    if (path.startsWith(bucket + '/')) {
      return path.substring(bucket.length + 1);
    }
  }
  
  return path;
}

/**
 * Extract storage path from a file_url (signed URL)
 * This extracts the actual storage path from a Supabase signed URL
 * 
 * Example: 
 * Input: "https://rpxmitaveezpinajrutw.supabase.co/storage/v1/object/sign/user-uploads/..."
 * Output: "user-uploads/userId/timestamp.pdf"
 */
export function extractStoragePathFromSignedUrl(signedUrl: string): string | null {
  try {
    const url = new URL(signedUrl);
    const pathnameParts = url.pathname.split('/');
    
    // Find the index of 'object' and 'sign' in the path
    // Standard format: /storage/v1/object/sign/{bucket}/{path}
    const objectIndex = pathnameParts.indexOf('object');
    const signIndex = pathnameParts.indexOf('sign');
    
    if (signIndex > objectIndex && signIndex >= 0) {
      // Everything after 'sign/' is the bucket + path
      const storagePath = pathnameParts.slice(signIndex + 1).join('/');
      return storagePath;
    }
  } catch (error) {
    console.warn('Failed to extract storage path from URL:', error);
  }
  
  return null;
}

/**
 * Get a file from Supabase storage and ensure we have a valid URL
 * This handles both signed and public URLs appropriately
 */
export async function getPDFUrl(
  fileId: string,
  bucket: string = 'user-uploads'
): Promise<string> {
  try {
    // Try to get a signed URL for private access
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(fileId, 60 * 60 * 24 * 7); // 7 days
    
    if (signedError) {
      console.warn(`Could not create signed URL: ${signedError.message}`);
      // Fall back to public URL
      const { data: publicData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileId);
      
      return publicData?.publicUrl || '';
    }
    
    return signedData?.signedUrl || '';
  } catch (error) {
    console.error('Error getting PDF URL:', error);
    throw error;
  }
}

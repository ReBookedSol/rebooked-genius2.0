/**
 * Centralized constants and helper functions for Study Hub
 * This file prevents duplication and typos across components
 */

export const CONTENT_TYPES = {
  DOCUMENT: 'document',
  LESSON: 'lesson',
  TEST: 'test',
  YOUTUBE_LESSON: 'youtube_lesson',
} as const;

export type ContentType = typeof CONTENT_TYPES[keyof typeof CONTENT_TYPES];

/**
 * Safely parse JSON strings with fallback
 * Returns the parsed object on success, or the fallback value on error
 */
export function safeJsonParse<T>(
  jsonString: string | null | undefined,
  fallback: T
): T {
  if (!jsonString) {
    return fallback;
  }

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn('Failed to parse JSON:', error);
    return fallback;
  }
}

/**
 * Extract YouTube video ID from various URL formats
 * Supports: youtube.com, youtu.be, youtube.com/embed, direct video IDs
 * Returns empty string if no valid ID found
 */
export function extractYoutubeVideoId(url: string): string {
  if (!url) return '';

  try {
    // Try standard YouTube URL patterns
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(youtubeRegex);

    if (match && match[1]) {
      return match[1];
    }

    // Try parsing as URL to extract v parameter
    try {
      const urlObj = new URL(url);
      const videoId = urlObj.searchParams.get('v') || urlObj.searchParams.get('video_id');
      if (videoId && videoId.length === 11) {
        return videoId;
      }
    } catch (e) {
      // Not a valid URL, try other methods
    }

    // Last resort: check if it looks like a video ID itself
    if (url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url)) {
      return url;
    }

    return '';
  } catch (e) {
    console.warn('Error extracting YouTube video ID:', e);
    return '';
  }
}

/**
 * Validate if a string is a valid YouTube URL or video ID
 */
export function isValidYoutubeUrl(url: string): boolean {
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
  if (youtubeRegex.test(url)) return true;

  // Also allow direct video IDs
  if (url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url)) return true;

  // Try as URL with v parameter
  try {
    const urlObj = new URL(url);
    const videoId = urlObj.searchParams.get('v');
    if (videoId && videoId.length === 11) return true;
  } catch (e) {
    // Not a valid URL
  }

  return false;
}

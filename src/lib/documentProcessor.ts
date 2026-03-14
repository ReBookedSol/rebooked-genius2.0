export interface DocumentChunk {
  id: number;
  content: string;
  startIndex: number;
  endIndex: number;
}

export interface ProcessedDocument {
  chunks: DocumentChunk[];
  totalChunks: number;
  totalCharacters: number;
  estimatedPages: number;
}

// Configuration
const CHUNK_SIZE = 150000; // characters per chunk (roughly 50 pages of content, as per user requirement)
const CHUNK_OVERLAP = 5000; // characters to overlap between chunks for context continuity
const AVERAGE_CHARS_PER_PAGE = 3000; // approximate characters per page

export function chunkDocument(text: string): ProcessedDocument {
  const cleanedText = text.trim();
  const chunks: DocumentChunk[] = [];

  if (cleanedText.length === 0) {
    return { chunks: [], totalChunks: 0, totalCharacters: 0, estimatedPages: 0 };
  }

  // If document is small enough, return as single chunk
  if (cleanedText.length <= CHUNK_SIZE) {
    chunks.push({
      id: 1,
      content: cleanedText,
      startIndex: 0,
      endIndex: cleanedText.length,
    });
    return {
      chunks,
      totalChunks: 1,
      totalCharacters: cleanedText.length,
      estimatedPages: Math.ceil(cleanedText.length / AVERAGE_CHARS_PER_PAGE),
    };
  }

  let startIndex = 0;
  let chunkId = 1;

  while (startIndex < cleanedText.length) {
    let endIndex = Math.min(startIndex + CHUNK_SIZE, cleanedText.length);

    // Try to break at a paragraph or sentence boundary for better semantic chunks
    if (endIndex < cleanedText.length) {
      // First, look for paragraph break (double newline)
      const paragraphBreak = cleanedText.lastIndexOf('\n\n', endIndex);
      if (paragraphBreak > startIndex + CHUNK_SIZE / 2) {
        endIndex = paragraphBreak + 2;
      } else {
        // Otherwise, look for sentence break (period followed by space)
        const sentenceBreak = cleanedText.lastIndexOf('. ', endIndex);
        if (sentenceBreak > startIndex + CHUNK_SIZE / 2) {
          endIndex = sentenceBreak + 2;
        }
      }
    }

    chunks.push({
      id: chunkId,
      content: cleanedText.slice(startIndex, endIndex).trim(),
      startIndex,
      endIndex,
    });

    // Move start with overlap for context continuity
    startIndex = endIndex - CHUNK_OVERLAP;
    if (startIndex >= cleanedText.length - CHUNK_OVERLAP) {
      break;
    }
    chunkId++;
  }

  return {
    chunks,
    totalChunks: chunks.length,
    totalCharacters: cleanedText.length,
    estimatedPages: Math.ceil(cleanedText.length / AVERAGE_CHARS_PER_PAGE),
  };
}

export function getCombinedChunkContent(chunks: DocumentChunk[]): string {
  return chunks
    .map((chunk) => chunk.content)
    .join('\n\n');
}

/**
 * Generate excerpt from lesson for continuity context
 * Extracts the last portion of the lesson content to maintain continuity across chunks
 */
export function generateContextExcerpt(lessonContent: string, maxLength: number = 1500): string {
  if (lessonContent.length <= maxLength) {
    return lessonContent;
  }

  // Get the last portion of the lesson for context
  const excerpt = lessonContent.slice(-maxLength);

  // Try to start at a sentence boundary
  const sentenceStart = excerpt.indexOf('. ');
  if (sentenceStart > 0 && sentenceStart < 200) {
    return excerpt.slice(sentenceStart + 2);
  }

  return excerpt;
}

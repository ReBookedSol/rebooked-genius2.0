/**
 * Extracts main heading (first H1 or H2) from markdown content
 */
export function extractMainHeading(markdown: string): string | null {
  const lines = markdown.split('\n');
  for (const line of lines) {
    // Match H1 (#) or H2 (##) headings
    const match = line.match(/^#{1,2}\s+(.+)$/);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Extracts all sections (headings with their content) from markdown
 */
export interface MarkdownSection {
  id: string;
  title: string;
  level: number;
  content: string;
  startIndex: number;
}

export function extractMarkdownSections(markdown: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  const lines = markdown.split('\n');
  
  let currentSection: { title: string; level: number; startLine: number } | null = null;
  
  lines.forEach((line, lineIndex) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (match) {
      // Save previous section if it exists
      if (currentSection !== null) {
        const contentLines = lines.slice(currentSection.startLine + 1, lineIndex);
        const content = contentLines.join('\n').trim();
        sections.push({
          id: `section-${sections.length}`,
          title: currentSection.title,
          level: currentSection.level,
          content: content,
          startIndex: currentSection.startLine,
        });
      }
      
      // Start new section
      currentSection = {
        title: match[2].trim(),
        level: match[1].length,
        startLine: lineIndex,
      };
    }
  });
  
  // Save last section
  if (currentSection !== null) {
    const contentLines = lines.slice(currentSection.startLine + 1);
    const content = contentLines.join('\n').trim();
    sections.push({
      id: `section-${sections.length}`,
      title: currentSection.title,
      level: currentSection.level,
      content: content,
      startIndex: currentSection.startLine,
    });
  }
  
  return sections;
}

/**
 * Gets content for a specific section (from section heading until next heading of same or higher level)
 */
export function getSectionContent(markdown: string, sectionTitle: string): string {
  const sections = extractMarkdownSections(markdown);
  const section = sections.find(s => s.title === sectionTitle);
  
  if (!section) {
    return markdown; // fallback to full content
  }
  
  return section.content;
}

/**
 * Strips markdown code blocks from the beginning and end of a string
 * Often AI models wrap markdown responses in triple backticks
 */
export function stripMarkdownCodeBlocks(content: string): string {
  if (!content) return content;

  let stripped = content.trim();

  // Remove starting ```markdown or ```
  if (stripped.startsWith('```')) {
    const firstLineEnd = stripped.indexOf('\n');
    if (firstLineEnd !== -1) {
      const firstLine = stripped.substring(0, firstLineEnd).toLowerCase();
      if (firstLine === '```markdown' || firstLine === '```') {
        stripped = stripped.substring(firstLineEnd + 1);
      }
    }
  }

  // Remove ending ```
  if (stripped.endsWith('```')) {
    stripped = stripped.substring(0, stripped.length - 3).trim();
  }

  return stripped;
}

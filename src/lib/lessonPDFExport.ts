import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { GeneratedLesson } from '@/contexts/LessonGenerationContext';

export async function exportLessonToPDF(lesson: GeneratedLesson, filename?: string) {
  return exportToPDF([lesson], filename || `lesson-${lesson.chunkNumber}.pdf`);
}

export async function exportAllLessonsToPDF(lessons: GeneratedLesson[], filename?: string) {
  const completedLessons = lessons.filter((l) => l.status === 'completed');
  if (completedLessons.length === 0) throw new Error('No lessons to export');
  return exportToPDF(completedLessons, filename || 'all-lessons.pdf');
}

export function exportContentToPDF(content: string, title: string, filename?: string) {
  if (!content?.trim()) throw new Error('No content to export');
  const fakeLessons: GeneratedLesson[] = [{
    chunkNumber: 0,
    content: `# ${title}\n\n${content}`,
    status: 'completed' as const,
    error: '',
  }];
  return exportToPDF(fakeLessons, filename || `${title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, '').replace(/```/g, ''))
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1')
    .replace(/^>\s*/gm, '  ')
    .replace(/^[\*\-]\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, (match) => match)
    .replace(/^---+$/gm, '────────────────────────────────')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}


async function exportToPDF(lessons: GeneratedLesson[], filename: string) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 16;
  const headingLineHeight = 24;
  const titleLineHeight = 30;

  const primaryColor = rgb(16 / 255, 185 / 255, 129 / 255); // #10b981
  const darkColor = rgb(26 / 255, 26 / 255, 26 / 255);
  const mutedColor = rgb(107 / 255, 114 / 255, 128 / 255);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const addNewPage = () => {
    // Add footer to current page
    page.drawText('ReBooked Genius - genius.rebookedsolutions.co.za', {
      x: margin,
      y: 25,
      size: 7,
      font,
      color: mutedColor,
    });
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < margin + 30) {
      addNewPage();
    }
  };

  const wrapText = (text: string, fontSize: number, usedFont: typeof font): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = usedFont.widthOfTextAtSize(testLine, fontSize);
      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  // Sanitize text to only include characters the font can encode
  const sanitizeText = (text: string): string => {
    // Replace common problematic characters with safe alternatives
    return text
      .replace(/[\u2018\u2019]/g, "'")  // Smart quotes
      .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes
      .replace(/\u2013/g, '-')          // En dash
      .replace(/\u2014/g, '--')         // Em dash
      .replace(/\u2026/g, '...')        // Ellipsis
      .replace(/\u00A0/g, ' ')          // Non-breaking space
      .replace(/\u2022/g, '•')          // Bullet (keep if supported)
      .replace(/[^\x00-\x7F•─────]/g, ''); // Remove other non-ASCII
  };

  const drawWrappedText = (text: string, fontSize: number, usedFont: typeof font, color: typeof darkColor, lh: number) => {
    const lines = wrapText(sanitizeText(text), fontSize, usedFont);
    for (const line of lines) {
      ensureSpace(lh);
      try {
        page.drawText(line, { x: margin, y, size: fontSize, font: usedFont, color });
      } catch {
        // If character encoding fails, skip the line
        page.drawText(line.replace(/[^\x20-\x7E]/g, ''), { x: margin, y, size: fontSize, font: usedFont, color });
      }
      y -= lh;
    }
  };

  // Header / watermark
  page.drawText('ReBooked Genius', { x: margin, y, size: 14, font: fontBold, color: primaryColor });
  y -= 18;
  page.drawText('genius.rebookedsolutions.co.za - Study Smarter, Not Harder', { x: margin, y, size: 8, font, color: mutedColor });
  y -= 8;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 2, color: primaryColor });
  y -= 30;

  for (let li = 0; li < lessons.length; li++) {
    const lesson = lessons[li];
    const rawContent = lesson.content;
    
    // Strip HTML if it's HTML content
    let textContent = rawContent;
    if (rawContent.trim().startsWith('<') && rawContent.includes('</')) {
      // Basic HTML to text conversion
      textContent = rawContent
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<h([1-6])[^>]*>/gi, (_, level) => '#'.repeat(parseInt(level)) + ' ')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n');
    }

    const lines = textContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        y -= 8;
        continue;
      }

      // Headings
      const h1Match = trimmed.match(/^#\s+(.+)/);
      const h2Match = trimmed.match(/^##\s+(.+)/);
      const h3Match = trimmed.match(/^###\s+(.+)/);

      if (h1Match) {
        ensureSpace(titleLineHeight + 10);
        y -= 10;
        page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: margin + 3, y: y - titleLineHeight + 4 }, thickness: 3, color: primaryColor });
        drawWrappedText(stripMarkdown(h1Match[1]), 18, fontBold, primaryColor, titleLineHeight);
        y -= 6;
      } else if (h2Match) {
        ensureSpace(headingLineHeight + 8);
        y -= 8;
        page.drawLine({ start: { x: margin, y: y + 3 }, end: { x: margin + 2, y: y - headingLineHeight + 3 }, thickness: 2, color: rgb(13/255, 148/255, 136/255) });
        drawWrappedText(stripMarkdown(h2Match[1]), 14, fontBold, rgb(13/255, 148/255, 136/255), headingLineHeight);
        y -= 4;
      } else if (h3Match) {
        ensureSpace(headingLineHeight + 6);
        y -= 6;
        drawWrappedText(stripMarkdown(h3Match[1]), 12, fontBold, rgb(15/255, 118/255, 110/255), 20);
        y -= 2;
      } else if (trimmed.startsWith('>')) {
        // Blockquote
        ensureSpace(lineHeight);
        const quoteText = sanitizeText(stripMarkdown(trimmed.replace(/^>\s*/, '')));
        page.drawLine({ start: { x: margin, y: y + 2 }, end: { x: margin, y: y - lineHeight + 2 }, thickness: 2, color: mutedColor });
        const quoteLines = wrapText(quoteText, 10, fontItalic);
        for (const ql of quoteLines) {
          ensureSpace(lineHeight);
          try {
            page.drawText(ql, { x: margin + 12, y, size: 10, font: fontItalic, color: mutedColor });
          } catch {
            page.drawText(ql.replace(/[^\x20-\x7E]/g, ''), { x: margin + 12, y, size: 10, font: fontItalic, color: mutedColor });
          }
          y -= lineHeight;
        }
      } else if (trimmed.startsWith('• ') || trimmed.match(/^[\*\-]\s/)) {
        // Bullet point
        const bulletText = stripMarkdown(trimmed.replace(/^[\*\-•]\s+/, ''));
        ensureSpace(lineHeight);
        try {
          page.drawText('*', { x: margin + 8, y, size: 10, font, color: primaryColor });
        } catch {
          // Skip bullet if encoding fails
        }
        const bulletLines = wrapText(sanitizeText(bulletText), 10, font);
        for (let bi = 0; bi < bulletLines.length; bi++) {
          ensureSpace(lineHeight);
          try {
            page.drawText(bulletLines[bi], { x: margin + 22, y, size: 10, font, color: darkColor });
          } catch {
            page.drawText(bulletLines[bi].replace(/[^\x20-\x7E]/g, ''), { x: margin + 22, y, size: 10, font, color: darkColor });
          }
          y -= lineHeight;
        }
      } else if (trimmed.match(/^\d+\.\s/)) {
        // Numbered list
        const numMatch = trimmed.match(/^(\d+\.)\s+(.+)/);
        if (numMatch) {
          ensureSpace(lineHeight);
          try {
            page.drawText(numMatch[1], { x: margin + 4, y, size: 10, font: fontBold, color: primaryColor });
          } catch { /* skip */ }
          const numLines = wrapText(sanitizeText(stripMarkdown(numMatch[2])), 10, font);
          for (const nl of numLines) {
            ensureSpace(lineHeight);
            try {
              page.drawText(nl, { x: margin + 22, y, size: 10, font, color: darkColor });
            } catch {
              page.drawText(nl.replace(/[^\x20-\x7E]/g, ''), { x: margin + 22, y, size: 10, font, color: darkColor });
            }
            y -= lineHeight;
          }
        }
      } else if (trimmed.startsWith('---') || trimmed.startsWith('───')) {
        ensureSpace(20);
        y -= 8;
        page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: mutedColor });
        y -= 12;
      } else {
        // Normal paragraph
        drawWrappedText(stripMarkdown(trimmed), 10, font, darkColor, lineHeight);
      }
    }

    // Page break between lessons
    if (li < lessons.length - 1) {
      addNewPage();
    }
  }

  // Final footer
  page.drawText('ReBooked Genius - genius.rebookedsolutions.co.za - Not an official NBT test', {
    x: margin,
    y: 25,
    size: 7,
    font,
    color: mutedColor,
  });
  const dateStr = new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });
  page.drawText(`Generated on ${dateStr}`, {
    x: margin,
    y: 15,
    size: 7,
    font,
    color: mutedColor,
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  link.click();
  URL.revokeObjectURL(url);

  return true;
}

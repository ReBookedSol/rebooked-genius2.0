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

// Sanitize text to only include characters the font can encode
function sanitizeText(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/\u2022/g, '*')
    .replace(/[^\x00-\x7F]/g, '');
}


async function exportToPDF(lessons: GeneratedLesson[], filename: string) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 56;
  const contentWidth = pageWidth - margin * 2;
  const bodyFontSize = 10.5;
  const bodyLineHeight = 17;
  const h1FontSize = 22;
  const h1LineHeight = 30;
  const h2FontSize = 16;
  const h2LineHeight = 24;
  const h3FontSize = 13;
  const h3LineHeight = 20;
  const footerHeight = 50;

  // Color palette — rich, harmonious tones
  const primary = rgb(16 / 255, 185 / 255, 129 / 255);       // Emerald #10b981
  const primaryDark = rgb(5 / 255, 150 / 255, 105 / 255);    // Darker emerald
  const teal = rgb(13 / 255, 148 / 255, 136 / 255);          // Teal for H2
  const tealDark = rgb(15 / 255, 118 / 255, 110 / 255);      // Darker teal for H3
  const dark = rgb(17 / 255, 24 / 255, 39 / 255);            // Near-black text
  const muted = rgb(107 / 255, 114 / 255, 128 / 255);        // Gray-500
  const lightMuted = rgb(156 / 255, 163 / 255, 175 / 255);   // Gray-400
  const blockquoteBg = rgb(243 / 255, 244 / 255, 246 / 255); // Gray-100 fill
  const blockquoteBar = rgb(209 / 255, 213 / 255, 219 / 255);// Gray-300 bar
  const accentGold = rgb(245 / 255, 158 / 255, 11 / 255);    // Amber accent
  const white = rgb(1, 1, 1);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  let pageNumber = 1;

  const drawFooter = () => {
    // Thin separator line
    page.drawLine({
      start: { x: margin, y: footerHeight - 5 },
      end: { x: pageWidth - margin, y: footerHeight - 5 },
      thickness: 0.5,
      color: rgb(229 / 255, 231 / 255, 235 / 255),
    });
    // Left: branding
    drawTextSafe('ReBooked Genius  |  genius.rebookedsolutions.co.za', margin, footerHeight - 22, 7.5, font, lightMuted);
    // Right: page number
    const pageStr = `Page ${pageNumber}`;
    const pageStrWidth = font.widthOfTextAtSize(pageStr, 7.5);
    drawTextSafe(pageStr, pageWidth - margin - pageStrWidth, footerHeight - 22, 7.5, font, lightMuted);
  };

  const addNewPage = () => {
    drawFooter();
    pageNumber++;
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < footerHeight + 10) {
      addNewPage();
    }
  };

  const wrapText = (text: string, fontSize: number, usedFont: typeof font, maxW?: number): string[] => {
    const effectiveMax = maxW || contentWidth;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = usedFont.widthOfTextAtSize(testLine, fontSize);
      if (width > effectiveMax && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const drawTextSafe = (text: string, x: number, cy: number, fontSize: number, usedFont: typeof font, color: typeof dark) => {
    try {
      page.drawText(text, { x, y: cy, size: fontSize, font: usedFont, color });
    } catch {
      page.drawText(text.replace(/[^\x20-\x7E]/g, ''), { x, y: cy, size: fontSize, font: usedFont, color });
    }
  };

  const drawWrappedText = (text: string, fontSize: number, usedFont: typeof font, color: typeof dark, lh: number, indent?: number) => {
    const xPos = margin + (indent || 0);
    const maxW = contentWidth - (indent || 0);
    const lines = wrapText(sanitizeText(text), fontSize, usedFont, maxW);
    for (const line of lines) {
      ensureSpace(lh);
      drawTextSafe(line, xPos, y, fontSize, usedFont, color);
      y -= lh;
    }
  };

  // ═══════════════════════════════════════
  //  HEADER — Professional branded header
  // ═══════════════════════════════════════

  // Top accent bar (gradient-like effect using two overlapping rectangles)
  page.drawRectangle({
    x: 0, y: pageHeight - 6, width: pageWidth, height: 6,
    color: primary,
  });
  page.drawRectangle({
    x: pageWidth * 0.6, y: pageHeight - 6, width: pageWidth * 0.4, height: 6,
    color: teal,
  });

  y = pageHeight - margin - 10;

  // Brand name
  drawTextSafe('REBOOKED GENIUS', margin, y, 11, fontBold, primary);
  // Tagline on the right
  const tagline = 'Study Smarter, Not Harder';
  const taglineWidth = font.widthOfTextAtSize(tagline, 8);
  drawTextSafe(tagline, pageWidth - margin - taglineWidth, y + 1, 8, fontItalic, muted);
  y -= 14;

  // Subtle URL
  drawTextSafe('genius.rebookedsolutions.co.za', margin, y, 7.5, font, lightMuted);
  y -= 16;

  // Separator
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1.5,
    color: primary,
  });
  y -= 8;
  // Secondary thin line
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.3,
    color: rgb(229 / 255, 231 / 255, 235 / 255),
  });
  y -= 24;

  // ═══════════════════════════════════════
  //  CONTENT
  // ═══════════════════════════════════════

  for (let li = 0; li < lessons.length; li++) {
    const lesson = lessons[li];
    const rawContent = lesson.content;

    // Strip HTML if needed
    let textContent = rawContent;
    if (rawContent.trim().startsWith('<') && rawContent.includes('</')) {
      textContent = rawContent
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<h([1-6])[^>]*>/gi, (_, level) => '#'.repeat(parseInt(level)) + ' ')
        .replace(/<li[^>]*>/gi, '- ')
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
        y -= 6;
        continue;
      }

      // ── Headings ──
      const h1Match = trimmed.match(/^#\s+(.+)/);
      const h2Match = trimmed.match(/^##\s+(.+)/);
      const h3Match = trimmed.match(/^###\s+(.+)/);
      const h4Match = trimmed.match(/^####\s+(.+)/);

      if (h1Match) {
        ensureSpace(h1LineHeight + 20);
        y -= 18;
        // Thick accent bar to the left
        const textLines = wrapText(sanitizeText(stripMarkdown(h1Match[1])), h1FontSize, fontBold);
        const blockHeight = textLines.length * h1LineHeight;
        page.drawRectangle({
          x: margin,
          y: y - blockHeight + h1LineHeight - 2,
          width: 4,
          height: blockHeight + 4,
          color: primary,
        });
        // Draw heading text
        for (const tl of textLines) {
          drawTextSafe(tl, margin + 12, y, h1FontSize, fontBold, dark);
          y -= h1LineHeight;
        }
        // Underline
        y -= 4;
        page.drawLine({
          start: { x: margin, y },
          end: { x: pageWidth - margin, y },
          thickness: 0.75,
          color: rgb(229 / 255, 231 / 255, 235 / 255),
        });
        y -= 12;
      } else if (h2Match) {
        ensureSpace(h2LineHeight + 16);
        y -= 14;
        // Teal accent bar
        const textLines = wrapText(sanitizeText(stripMarkdown(h2Match[1])), h2FontSize, fontBold);
        const blockHeight = textLines.length * h2LineHeight;
        page.drawRectangle({
          x: margin,
          y: y - blockHeight + h2LineHeight - 2,
          width: 3,
          height: blockHeight + 4,
          color: teal,
        });
        for (const tl of textLines) {
          drawTextSafe(tl, margin + 10, y, h2FontSize, fontBold, teal);
          y -= h2LineHeight;
        }
        y -= 8;
      } else if (h3Match) {
        ensureSpace(h3LineHeight + 12);
        y -= 10;
        // Small dot accent
        page.drawCircle({
          x: margin + 3,
          y: y + 4,
          size: 2.5,
          color: tealDark,
        });
        drawWrappedText(stripMarkdown(h3Match[1]), h3FontSize, fontBold, tealDark, h3LineHeight, 12);
        y -= 4;
      } else if (h4Match) {
        ensureSpace(bodyLineHeight + 8);
        y -= 8;
        drawWrappedText(stripMarkdown(h4Match[1]), 11.5, fontBold, dark, bodyLineHeight + 1);
        y -= 2;

      // ── Blockquote ──
      } else if (trimmed.startsWith('>')) {
        const quoteText = sanitizeText(stripMarkdown(trimmed.replace(/^>\s*/, '')));
        const quoteLines = wrapText(quoteText, bodyFontSize - 0.5, fontItalic, contentWidth - 28);
        const quoteBlockHeight = quoteLines.length * bodyLineHeight + 12;
        ensureSpace(quoteBlockHeight);

        // Background rectangle
        page.drawRectangle({
          x: margin,
          y: y - quoteBlockHeight + bodyLineHeight + 2,
          width: contentWidth,
          height: quoteBlockHeight,
          color: blockquoteBg,
        });
        // Left bar
        page.drawRectangle({
          x: margin,
          y: y - quoteBlockHeight + bodyLineHeight + 2,
          width: 3,
          height: quoteBlockHeight,
          color: blockquoteBar,
        });

        y -= 4;
        for (const ql of quoteLines) {
          ensureSpace(bodyLineHeight);
          drawTextSafe(ql, margin + 14, y, bodyFontSize - 0.5, fontItalic, muted);
          y -= bodyLineHeight;
        }
        y -= 8;

      // ── Bullet points ──
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.match(/^[\*\-]\s/)) {
        const bulletText = stripMarkdown(trimmed.replace(/^[\*\-]\s+/, ''));
        const bulletLines = wrapText(sanitizeText(bulletText), bodyFontSize, font, contentWidth - 24);
        ensureSpace(bodyLineHeight);

        // Colored bullet dot
        page.drawCircle({
          x: margin + 7,
          y: y + 3,
          size: 2,
          color: primary,
        });

        for (let bi = 0; bi < bulletLines.length; bi++) {
          ensureSpace(bodyLineHeight);
          drawTextSafe(bulletLines[bi], margin + 18, y, bodyFontSize, font, dark);
          y -= bodyLineHeight;
        }

      // ── Numbered list ──
      } else if (trimmed.match(/^\d+\.\s/)) {
        const numMatch = trimmed.match(/^(\d+\.)\s+(.+)/);
        if (numMatch) {
          const numText = stripMarkdown(numMatch[2]);
          const numLines = wrapText(sanitizeText(numText), bodyFontSize, font, contentWidth - 24);
          ensureSpace(bodyLineHeight);

          // Number badge
          drawTextSafe(numMatch[1], margin + 2, y, bodyFontSize, fontBold, primary);

          for (const nl of numLines) {
            ensureSpace(bodyLineHeight);
            drawTextSafe(nl, margin + 20, y, bodyFontSize, font, dark);
            y -= bodyLineHeight;
          }
        }

      // ── Horizontal rule ──
      } else if (trimmed.startsWith('---') || trimmed.startsWith('___') || trimmed.match(/^-{3,}$/)) {
        ensureSpace(24);
        y -= 10;
        page.drawLine({
          start: { x: margin + contentWidth * 0.15, y },
          end: { x: pageWidth - margin - contentWidth * 0.15, y },
          thickness: 0.5,
          color: rgb(209 / 255, 213 / 255, 219 / 255),
        });
        // Small decorative diamond in center
        const cx = pageWidth / 2;
        page.drawRectangle({
          x: cx - 2, y: y - 2, width: 4, height: 4,
          color: rgb(209 / 255, 213 / 255, 219 / 255),
          rotate: { type: 0 as any, angle: 45 },
        });
        y -= 14;

      // ── Code blocks (indented or fenced) ──
      } else if (trimmed.startsWith('```') || trimmed.startsWith('    ')) {
        const codeText = sanitizeText(trimmed.replace(/^```\w*/, '').replace(/```$/, '').replace(/^\s{4}/, ''));
        if (codeText.trim()) {
          const codeLines = wrapText(codeText, 9, font, contentWidth - 24);
          const codeBlockHeight = codeLines.length * 14 + 12;
          ensureSpace(codeBlockHeight);

          // Code background
          page.drawRectangle({
            x: margin + 4,
            y: y - codeBlockHeight + 14,
            width: contentWidth - 8,
            height: codeBlockHeight,
            color: rgb(249 / 255, 250 / 255, 251 / 255),
            borderColor: rgb(229 / 255, 231 / 255, 235 / 255),
            borderWidth: 0.5,
          });

          y -= 4;
          for (const cl of codeLines) {
            ensureSpace(14);
            drawTextSafe(cl, margin + 14, y, 9, font, rgb(55 / 255, 65 / 255, 81 / 255));
            y -= 14;
          }
          y -= 8;
        }

      // ── Bold text detection (standalone bold lines like **Key Point:**) ──
      } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        const boldText = stripMarkdown(trimmed);
        ensureSpace(bodyLineHeight + 4);
        drawWrappedText(boldText, bodyFontSize + 0.5, fontBold, dark, bodyLineHeight);

      // ── Normal paragraph ──
      } else {
        drawWrappedText(stripMarkdown(trimmed), bodyFontSize, font, dark, bodyLineHeight);
      }
    }

    // Page break between lessons
    if (li < lessons.length - 1) {
      addNewPage();
    }
  }

  // ═══════════════════════════════════════
  //  FINAL FOOTER
  // ═══════════════════════════════════════
  drawFooter();

  // Date generated — on last page, above the footer separator
  const dateStr = new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });
  const dateText = `Generated on ${dateStr}`;
  const dateWidth = font.widthOfTextAtSize(dateText, 7);
  drawTextSafe(dateText, pageWidth - margin - dateWidth, footerHeight - 34, 7, font, lightMuted);

  // ═══════════════════════════════════════
  //  SAVE & DOWNLOAD
  // ═══════════════════════════════════════
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

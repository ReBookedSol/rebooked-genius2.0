import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const WATERMARK_TEXT_TOP = 'ReBooked Genius';
const WATERMARK_URL = 'genius.rebookedsolutions.co.za';
const WATERMARK_SLOGAN = 'Study Smarter, Not Harder';

export async function addWatermarkToPdf(pdfBytes: ArrayBuffer): Promise<Uint8Array> {
  if (!pdfBytes || pdfBytes.byteLength === 0) {
    throw new Error('Empty PDF bytes');
  }

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  const fontSize = 8;
  const diagonalFontSize = 30;
  const color = rgb(0.5, 0.5, 0.5); // Grey watermark
  const opacity = 0.4;
  const diagonalOpacity = 0.15;

  for (const page of pages) {
    const { width, height } = page.getSize();

    // Top-right corner watermark
    const topLine1Width = font.widthOfTextAtSize(WATERMARK_TEXT_TOP, fontSize);
    const topLine2Width = font.widthOfTextAtSize(WATERMARK_URL, fontSize - 1);
    const topLine3Width = font.widthOfTextAtSize(WATERMARK_SLOGAN, fontSize - 1);

    page.drawText(WATERMARK_TEXT_TOP, {
      x: width - topLine1Width - 15,
      y: height - 18,
      size: fontSize,
      font,
      color,
      opacity,
    });
    page.drawText(WATERMARK_URL, {
      x: width - topLine2Width - 15,
      y: height - 28,
      size: fontSize - 1,
      font,
      color,
      opacity,
    });
    page.drawText(WATERMARK_SLOGAN, {
      x: width - topLine3Width - 15,
      y: height - 37,
      size: fontSize - 1,
      font,
      color,
      opacity,
    });

    // Bottom-left corner watermark
    page.drawText(WATERMARK_TEXT_TOP, {
      x: 15,
      y: 30,
      size: fontSize,
      font,
      color,
      opacity,
    });
    page.drawText(WATERMARK_URL, {
      x: 15,
      y: 21,
      size: fontSize - 1,
      font,
      color,
      opacity,
    });
    page.drawText(WATERMARK_SLOGAN, {
      x: 15,
      y: 12,
      size: fontSize - 1,
      font,
      color,
      opacity,
    });


    // Large diagonal watermark in the center
    const diagonalText = `${WATERMARK_TEXT_TOP} - ${WATERMARK_URL}`;
    const diagWidth = font.widthOfTextAtSize(diagonalText, diagonalFontSize);
    const diagHeight = diagonalFontSize;
    const angle = 45;
    const radians = (angle * Math.PI) / 180;

    // Proper centered coordinates for rotated text:
    const cosA = Math.cos(radians);
    const sinA = Math.sin(radians);

    // We want the rotated center (L/2*cos - H/2*sin, L/2*sin + H/2*cos) to be at (width/2, height/2)
    const xStart = (width / 2) - (0.5 * diagWidth * cosA - 0.5 * diagHeight * sinA);
    const yStart = (height / 2) - (0.5 * diagWidth * sinA + 0.5 * diagHeight * cosA);

    page.drawText(diagonalText, {
      x: xStart,
      y: yStart,
      size: diagonalFontSize,
      font,
      color,
      opacity: diagonalOpacity,
      rotate: { type: 'degrees' as any, angle: angle },
    });
  }

  return pdfDoc.save();
}

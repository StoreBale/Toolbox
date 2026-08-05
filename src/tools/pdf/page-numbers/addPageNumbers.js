import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

function hexToRgb(value) {
  const hex = value.replace('#', '');
  return rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
}

export async function addPageNumbers(file, { position = 'bottomCenter', startAt = 1, fromPage = 1, toPage = Infinity, fontSize = 12, color = '#15233c' } = {}) {
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  pages.forEach((page, index) => {
    const pageNumber = index + 1;
    if (pageNumber < fromPage || pageNumber > toPage) return;
    const label = String(startAt + pageNumber - fromPage);
    const { width, height } = page.getSize();
    const labelWidth = font.widthOfTextAtSize(label, fontSize);
    const margin = 22;
    const positions = {
      bottomLeft: [margin, margin], bottomCenter: [(width - labelWidth) / 2, margin], bottomRight: [width - margin - labelWidth, margin],
      topLeft: [margin, height - margin - fontSize], topCenter: [(width - labelWidth) / 2, height - margin - fontSize], topRight: [width - margin - labelWidth, height - margin - fontSize]
    };
    const [x, y] = positions[position] ?? positions.bottomCenter;
    page.drawText(label, { x, y, size: fontSize, font, color: hexToRgb(color) });
  });
  return { bytes: await pdf.save({ useObjectStreams: true }), pageCount: pages.length };
}

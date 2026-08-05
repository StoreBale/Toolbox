import { PDFDocument } from 'pdf-lib';

const A4 = [595.28, 841.89];

export async function imagesToPdf(images, { pageSize = 'fit', orientation = 'auto', margin = 20 } = {}) {
  const pdf = await PDFDocument.create();
  for (const item of images) {
    const bytes = await item.file.arrayBuffer();
    const image = item.file.type === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    let width = image.width;
    let height = image.height;
    if (pageSize === 'a4') {
      const landscape = orientation === 'landscape' || (orientation === 'auto' && width > height);
      [width, height] = landscape ? [A4[1], A4[0]] : A4;
    }
    const page = pdf.addPage([width, height]);
    const availableWidth = Math.max(1, width - margin * 2);
    const availableHeight = Math.max(1, height - margin * 2);
    const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    page.drawImage(image, { x: (width - drawWidth) / 2, y: (height - drawHeight) / 2, width: drawWidth, height: drawHeight });
  }
  return pdf.save({ useObjectStreams: true });
}

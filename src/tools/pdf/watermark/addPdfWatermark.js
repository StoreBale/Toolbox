import { PDFDocument, degrees } from 'pdf-lib';

export async function addPdfWatermark(file, { text, position = 'center', opacity = .35, fontSize = 48, color = '#1769d3', rotation = -30 } = {}) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = `700 ${fontSize}px "Segoe UI", "Microsoft JhengHei", sans-serif`;
  const measured = Math.ceil(context.measureText(text).width);
  canvas.width = Math.max(1, measured + 28); canvas.height = fontSize + 28;
  const draw = canvas.getContext('2d'); draw.font = `700 ${fontSize}px "Segoe UI", "Microsoft JhengHei", sans-serif`; draw.fillStyle = color; draw.textBaseline = 'middle'; draw.fillText(text, 14, canvas.height / 2);
  const png = await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('無法建立浮水印。')), 'image/png'));
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  const image = await pdf.embedPng(await png.arrayBuffer());
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize(); const scale = Math.min(1, width * .58 / image.width); const imageWidth = image.width * scale; const imageHeight = image.height * scale; const margin = 24;
    const positions = { topLeft: [margin, height - margin - imageHeight], topRight: [width - margin - imageWidth, height - margin - imageHeight], center: [(width - imageWidth) / 2, (height - imageHeight) / 2], bottomLeft: [margin, margin], bottomRight: [width - margin - imageWidth, margin] };
    const [x, y] = positions[position] ?? positions.center;
    page.drawImage(image, { x, y, width: imageWidth, height: imageHeight, opacity, rotate: degrees(position === 'center' ? rotation : 0) });
  }
  return { bytes: await pdf.save({ useObjectStreams: true }), pageCount: pdf.getPageCount() };
}

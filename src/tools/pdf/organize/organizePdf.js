import { degrees, PDFDocument } from 'pdf-lib';

export async function organizePdf(file, items) {
  const source = await PDFDocument.load(await file.arrayBuffer());
  const output = await PDFDocument.create();
  const kept = items.filter((item) => !item.deleted);
  if (!kept.length) throw new Error('至少要保留一頁。');
  for (const item of kept) {
    const [page] = await output.copyPages(source, [item.originalIndex]);
    const originalRotation = page.getRotation().angle;
    page.setRotation(degrees((originalRotation + item.rotation) % 360));
    output.addPage(page);
  }
  return { bytes: await output.save({ useObjectStreams: true }), pageCount: kept.length };
}

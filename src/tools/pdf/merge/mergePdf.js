import { PDFDocument } from 'pdf-lib';

export async function mergePdfBytes(files) {
  if (files.length < 2) {
    throw new Error('請至少選擇兩個 PDF 檔案。');
  }

  const mergedPdf = await PDFDocument.create();
  for (const file of files) {
    const sourcePdf = await PDFDocument.load(await file.arrayBuffer());
    const pages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
    pages.forEach((page) => mergedPdf.addPage(page));
  }
  return mergedPdf.save();
}

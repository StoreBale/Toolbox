import { PDFDocument } from 'pdf-lib';
import { parsePageSelection } from '../split/splitPdf.js';

export async function deletePdfPages(file, selection) {
  const source = await PDFDocument.load(await file.arrayBuffer());
  const deletedIndices = new Set(parsePageSelection(selection, source.getPageCount()));
  const remainingIndices = source.getPageIndices().filter((index) => !deletedIndices.has(index));
  if (!remainingIndices.length) throw new Error('不能刪除全部頁面，請至少保留一頁。');

  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, remainingIndices);
  pages.forEach((page) => output.addPage(page));
  return { bytes: await output.save(), deletedPages: deletedIndices.size, remainingPages: pages.length };
}

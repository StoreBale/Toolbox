import { PDFDocument } from 'pdf-lib';

export function parsePageSelection(value, pageCount) {
  if (!value.trim()) throw new Error('請輸入要擷取的頁碼。');
  const pages = [];

  for (const part of value.split(',')) {
    const token = part.trim();
    const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error(`無法辨識頁碼「${token}」。`);
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      throw new Error(`頁碼必須介於 1 到 ${pageCount}。`);
    }
    const direction = start <= end ? 1 : -1;
    for (let page = start; page !== end + direction; page += direction) {
      if (!pages.includes(page - 1)) pages.push(page - 1);
    }
  }
  return pages;
}

export async function extractPdfPages(file, selection) {
  const source = await PDFDocument.load(await file.arrayBuffer());
  const indices = parsePageSelection(selection, source.getPageCount());
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, indices);
  pages.forEach((page) => output.addPage(page));
  return { bytes: await output.save(), pageCount: pages.length };
}

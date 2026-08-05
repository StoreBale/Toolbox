import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument, rgb } from 'pdf-lib';
import { mergePdfBytes } from '../src/tools/pdf/merge/mergePdf.js';

async function makePdf(pageCount, color, size) {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    const page = pdf.addPage(size);
    page.drawRectangle({ x: 0, y: 0, width: size[0], height: size[1], color });
  }
  const bytes = await pdf.save();
  return { arrayBuffer: async () => bytes, bytes };
}

const first = await makePdf(2, rgb(0.9, 0.2, 0.2), [300, 200]);
const second = await makePdf(3, rgb(0.2, 0.4, 0.9), [420, 240]);
const result = await mergePdfBytes([first, second]);
const merged = await PDFDocument.load(result);

assert.equal(merged.getPageCount(), 5, '合併後應保留所有頁面');
assert.deepEqual(merged.getPages().map((page) => [page.getWidth(), page.getHeight()]), [
  [300, 200], [300, 200], [420, 240], [420, 240], [420, 240]
], '合併後應保留來源檔案順序');
await assert.rejects(() => mergePdfBytes([first]), /至少選擇兩個/);

await mkdir('tmp/pdfs', { recursive: true });
await writeFile('tmp/pdfs/source-red.pdf', first.bytes);
await writeFile('tmp/pdfs/source-blue.pdf', second.bytes);
await writeFile('tmp/pdfs/merged-validation.pdf', result);

console.log('PASS: 合併順序與總頁數正確（2 + 3 = 5 頁）');

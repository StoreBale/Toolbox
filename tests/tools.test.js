import assert from 'node:assert/strict';
import { PDFDocument, rgb } from 'pdf-lib';
import { deletePdfPages } from '../src/tools/pdf/delete/deletePages.js';
import { rotatePdf } from '../src/tools/pdf/rotate/rotatePdf.js';
import { extractPdfPages, parsePageSelection } from '../src/tools/pdf/split/splitPdf.js';
import { analyzeText, cleanText, csvToJson, jsonToCsv, parseCsv, sortJson } from '../src/utils/text.js';

assert.deepEqual(parsePageSelection('1-3, 5, 3', 6), [0, 1, 2, 4]);
assert.deepEqual(parsePageSelection('3-1', 3), [2, 1, 0]);
assert.throws(() => parsePageSelection('0, 2', 3), /介於 1 到 3/);

const source = await PDFDocument.create();
for (const size of [[200, 300], [300, 400], [400, 500]]) {
  const page = source.addPage(size);
  page.drawRectangle({ x: 0, y: 0, width: size[0], height: size[1], color: rgb(0.2, 0.5, 0.7) });
}
const sourceBytes = await source.save();

const extracted = await extractPdfPages({ arrayBuffer: async () => sourceBytes }, '3, 1');
const extractedPdf = await PDFDocument.load(extracted.bytes);
assert.deepEqual(extractedPdf.getPages().map((page) => [page.getWidth(), page.getHeight()]), [[400, 500], [200, 300]]);

const rotated = await rotatePdf({ arrayBuffer: async () => sourceBytes }, '2', 90);
const rotatedPdf = await PDFDocument.load(rotated.bytes);
assert.deepEqual(rotatedPdf.getPages().map((page) => page.getRotation().angle), [0, 90, 0]);

const deleted = await deletePdfPages({ arrayBuffer: async () => sourceBytes }, '2');
const deletedPdf = await PDFDocument.load(deleted.bytes);
assert.deepEqual(deletedPdf.getPages().map((page) => [page.getWidth(), page.getHeight()]), [[200, 300], [400, 500]]);
await assert.rejects(() => deletePdfPages({ arrayBuffer: async () => sourceBytes }, '1-3'), /不能刪除全部頁面/);

assert.deepEqual(analyzeText('Hello 世界\n第二行'), { characters: 10, charactersWithSpaces: 12, words: 6, lines: 2, paragraphs: 1, readingMinutes: 1 });
assert.equal(cleanText('  A   B  \n\nA   B', { trimLines: true, collapseSpaces: true, removeBlankLines: true, removeDuplicateLines: true }), 'A B');
assert.deepEqual(sortJson({ z: 1, a: { y: 2, b: 3 } }), { a: { b: 3, y: 2 }, z: 1 });
assert.deepEqual(parseCsv('name,note\r\nAmy,"a,b"'), [['name', 'note'], ['Amy', 'a,b']]);
assert.deepEqual(csvToJson('name,age\nAmy,28'), [{ name: 'Amy', age: '28' }]);
assert.equal(jsonToCsv([{ name: 'Amy', note: 'a,b' }]), 'name,note\r\nAmy,"a,b"');

console.log('PASS: PDF 操作與文字、JSON、CSV 邏輯正確');

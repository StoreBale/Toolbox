import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { createServer } from 'vite';
import { chromium } from 'file:///C:/Users/stor/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const server = await createServer({ server: { host: '127.0.0.1', port: 4173 } });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });

try {
  await mkdir('tmp/browser', { recursive: true });
  await mkdir('tmp/images', { recursive: true });
  await server.listen();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.tool-card').count(), 23);
  await page.screenshot({ path: 'tmp/browser/desktop-home.png', fullPage: true });

  await page.goto('http://127.0.0.1:4173/daily/qr', { waitUntil: 'networkidle' });
  await page.locator('#qr-url').fill('https://example.com/toolbox');
  await page.locator('#qr-image').waitFor({ state: 'visible' });
  const qrPromise = page.waitForEvent('download');
  await page.locator('#action-button').click();
  await (await qrPromise).saveAs('tmp/images/browser-qrcode.png');
  await page.screenshot({ path: 'tmp/browser/desktop-qr.png', fullPage: true });

  await page.goto('http://127.0.0.1:4173/daily/zip', { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(['tmp/pdfs/merged-page-1.png', 'tmp/pdfs/merged-page-3.png']);
  const zipPromise = page.waitForEvent('download');
  await page.locator('#action-button').click();
  await (await zipPromise).saveAs('tmp/browser/browser-files.zip');
  const dailyZip = await JSZip.loadAsync(await readFile('tmp/browser/browser-files.zip'));
  assert.equal(Object.keys(dailyZip.files).length, 2);

  await page.goto('http://127.0.0.1:4173/daily/counter', { waitUntil: 'networkidle' });
  await page.locator('#text-input').fill('Hello 世界\n第二行');
  assert.equal(await page.locator('#stat-characters').textContent(), '10');
  assert.equal(await page.locator('#stat-words').textContent(), '6');

  await page.goto('http://127.0.0.1:4173/daily/cleanup', { waitUntil: 'networkidle' });
  await page.locator('#source-text').fill('  A   B  \n\nA   B');
  await page.locator('#remove-blank-lines').check();
  await page.locator('#remove-duplicate-lines').check();
  assert.equal(await page.locator('#result-text').inputValue(), 'A B');
  const textPromise = page.waitForEvent('download');
  await page.locator('#download-button').click();
  await (await textPromise).saveAs('tmp/browser/cleaned-text.txt');

  await page.goto('http://127.0.0.1:4173/daily/json', { waitUntil: 'networkidle' });
  await page.locator('#json-input').fill('{"z":1,"a":{"y":2,"b":3}}');
  await page.locator('#sort-keys').check();
  await page.locator('#format-button').click();
  assert.match(await page.locator('#json-input').inputValue(), /^\{\n  "a"/);

  await page.goto('http://127.0.0.1:4173/daily/csv-json', { waitUntil: 'networkidle' });
  await page.locator('#source-data').fill('name,note\nAmy,"a,b"');
  await page.locator('#convert-button').click();
  assert.match(await page.locator('#result-data').inputValue(), /"note": "a,b"/);

  await page.goto('http://127.0.0.1:4173/pdf/merge', { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(['tmp/pdfs/source-red.pdf', 'tmp/pdfs/source-blue.pdf']);
  await page.locator('.file-item').first().getByRole('button', { name: '向下移動' }).click();
  const mergePromise = page.waitForEvent('download');
  await page.locator('#merge-button').click();
  const mergeDownload = await mergePromise;
  await mergeDownload.saveAs('tmp/pdfs/browser-smoke-result.pdf');
  assert.equal((await PDFDocument.load(await readFile('tmp/pdfs/browser-smoke-result.pdf'))).getPageCount(), 5);

  await page.goto('http://127.0.0.1:4173/pdf/split', { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles('tmp/pdfs/source-blue.pdf');
  await page.locator('#page-selection').fill('1, 3');
  const splitPromise = page.waitForEvent('download');
  await page.locator('#action-button').click();
  const splitDownload = await splitPromise;
  await splitDownload.saveAs('tmp/pdfs/browser-split-result.pdf');
  assert.equal((await PDFDocument.load(await readFile('tmp/pdfs/browser-split-result.pdf'))).getPageCount(), 2);

  await page.goto('http://127.0.0.1:4173/pdf/compress', { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles('tmp/pdfs/source-red.pdf');
  const compressPromise = page.waitForEvent('download');
  await page.locator('#action-button').click();
  const compressDownload = await compressPromise;
  await compressDownload.saveAs('tmp/pdfs/browser-compress-result.pdf');
  assert.equal((await PDFDocument.load(await readFile('tmp/pdfs/browser-compress-result.pdf'))).getPageCount(), 2);

  await page.goto('http://127.0.0.1:4173/pdf/rotate', { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles('tmp/pdfs/source-blue.pdf');
  await page.locator('#page-selection').fill('2');
  const rotatePromise = page.waitForEvent('download');
  await page.locator('#action-button').click();
  const rotateDownload = await rotatePromise;
  await rotateDownload.saveAs('tmp/pdfs/browser-rotate-result.pdf');
  assert.deepEqual((await PDFDocument.load(await readFile('tmp/pdfs/browser-rotate-result.pdf'))).getPages().map((item) => item.getRotation().angle), [0, 90, 0]);

  await page.goto('http://127.0.0.1:4173/pdf/delete', { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles('tmp/pdfs/source-blue.pdf');
  await page.locator('#page-selection').fill('2');
  const deletePromise = page.waitForEvent('download');
  await page.locator('#action-button').click();
  const deleteDownload = await deletePromise;
  await deleteDownload.saveAs('tmp/pdfs/browser-delete-result.pdf');
  assert.equal((await PDFDocument.load(await readFile('tmp/pdfs/browser-delete-result.pdf'))).getPageCount(), 2);

  await page.goto('http://127.0.0.1:4173/pdf/organize', { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles('tmp/pdfs/source-blue.pdf');
  await page.locator('.page-thumbnail').nth(0).getByRole('button', { name: /旋轉/ }).click();
  await page.locator('.page-thumbnail').nth(1).getByRole('button', { name: '移除' }).click();
  const organizePromise = page.waitForEvent('download');
  await page.locator('#action-button').click();
  await (await organizePromise).saveAs('tmp/pdfs/browser-organize-result.pdf');
  const organized = await PDFDocument.load(await readFile('tmp/pdfs/browser-organize-result.pdf'));
  assert.equal(organized.getPageCount(), 2);
  assert.equal(organized.getPage(0).getRotation().angle, 90);
  await page.screenshot({ path: 'tmp/browser/desktop-organize.png', fullPage: true });

  await page.goto('http://127.0.0.1:4173/pdf/from-image', { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles(['tmp/pdfs/merged-page-1.png', 'tmp/pdfs/merged-page-3.png']);
  const imageToPdfPromise = page.waitForEvent('download');
  await page.locator('#action-button').click();
  await (await imageToPdfPromise).saveAs('tmp/pdfs/browser-image-to-pdf.pdf');
  assert.equal((await PDFDocument.load(await readFile('tmp/pdfs/browser-image-to-pdf.pdf'))).getPageCount(), 2);

  await page.goto('http://127.0.0.1:4173/pdf/to-image', { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles('tmp/pdfs/source-red.pdf');
  const pdfToImagePromise = page.waitForEvent('download');
  await page.locator('#action-button').click();
  await (await pdfToImagePromise).saveAs('tmp/images/browser-pdf-images.zip');
  const imageZip = await JSZip.loadAsync(await readFile('tmp/images/browser-pdf-images.zip'));
  assert.equal(Object.keys(imageZip.files).length, 2);

  await page.goto('http://127.0.0.1:4173/pdf/page-numbers', { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles('tmp/pdfs/source-red.pdf');
  const pageNumbersPromise = page.waitForEvent('download');
  await page.locator('#action-button').click();
  await (await pageNumbersPromise).saveAs('tmp/pdfs/browser-page-numbers.pdf');
  assert.equal((await PDFDocument.load(await readFile('tmp/pdfs/browser-page-numbers.pdf'))).getPageCount(), 2);

  await page.goto('http://127.0.0.1:4173/pdf/watermark', { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles('tmp/pdfs/source-red.pdf');
  await page.locator('#watermark-text').fill('內部文件');
  const pdfWatermarkPromise = page.waitForEvent('download');
  await page.locator('#action-button').click();
  await (await pdfWatermarkPromise).saveAs('tmp/pdfs/browser-pdf-watermark.pdf');
  assert.equal((await PDFDocument.load(await readFile('tmp/pdfs/browser-pdf-watermark.pdf'))).getPageCount(), 2);

  if (existsSync('tmp/pdfs/encrypted-source.pdf')) {
    await page.goto('http://127.0.0.1:4173/pdf/unlock', { waitUntil: 'networkidle' });
    await page.locator('#file-input').setInputFiles('tmp/pdfs/encrypted-source.pdf');
    await page.locator('#pdf-password').fill('toolbox123');
    const unlockPromise = page.waitForEvent('download');
    await page.locator('#action-button').click();
    const unlockDownload = await unlockPromise;
    await unlockDownload.saveAs('tmp/pdfs/browser-unlocked-result.pdf');
    assert.equal((await PDFDocument.load(await readFile('tmp/pdfs/browser-unlocked-result.pdf'))).getPageCount(), 2);
  }

  await page.goto('http://127.0.0.1:4173/image/compress', { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles('tmp/browser/desktop-home.png');
  const imageCompressPromise = page.waitForEvent('download');
  await page.locator('#action-button').click();
  await (await imageCompressPromise).saveAs('tmp/images/browser-compressed.webp');

  await page.goto('http://127.0.0.1:4173/image/resize', { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles('tmp/browser/desktop-home.png');
  await page.locator('#image-width').fill('640');
  const resizePromise = page.waitForEvent('download');
  await page.locator('#action-button').click();
  await (await resizePromise).saveAs('tmp/images/browser-resized.png');

  await page.goto('http://127.0.0.1:4173/image/crop', { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles('tmp/browser/desktop-home.png');
  await page.locator('#crop-width').fill('320');
  await page.locator('#crop-height').fill('200');
  const cropPromise = page.waitForEvent('download');
  await page.locator('#action-button').click();
  await (await cropPromise).saveAs('tmp/images/browser-cropped.png');
  await page.screenshot({ path: 'tmp/browser/desktop-crop.png', fullPage: true });

  await page.goto('http://127.0.0.1:4173/image/convert', { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles('tmp/browser/desktop-home.png');
  await page.locator('#output-format').selectOption('image/webp');
  const convertPromise = page.waitForEvent('download');
  await page.locator('#action-button').click();
  await (await convertPromise).saveAs('tmp/images/browser-converted.webp');

  await page.goto('http://127.0.0.1:4173/image/transform', { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles('tmp/browser/desktop-home.png');
  const transformPromise = page.waitForEvent('download');
  await page.locator('#action-button').click();
  await (await transformPromise).saveAs('tmp/images/browser-rotated.png');

  await page.goto('http://127.0.0.1:4173/image/watermark', { waitUntil: 'networkidle' });
  await page.locator('#file-input').setInputFiles('tmp/browser/desktop-home.png');
  await page.locator('#watermark-text').fill('Toolbox QA');
  const watermarkPromise = page.waitForEvent('download');
  await page.locator('#action-button').click();
  await (await watermarkPromise).saveAs('tmp/images/browser-watermarked.png');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  await mobile.screenshot({ path: 'tmp/browser/mobile-home.png', fullPage: true });
  await mobile.locator('#menu-button').click();
  assert.equal(await mobile.locator('#sidebar').isVisible(), true);

  console.log('PASS: 23 個 PDF、圖片與日常工具及手機版流程均可用');
} finally {
  await browser.close();
  await server.close();
}

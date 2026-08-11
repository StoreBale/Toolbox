import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export async function unlockPdf(file, password, onProgress = () => {}) {
  const source = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), password }).promise;
  const output = await PDFDocument.create();

  for (let pageNumber = 1; pageNumber <= source.numPages; pageNumber += 1) {
    const page = await source.getPage(pageNumber);
    const renderViewport = page.getViewport({ scale: 1.5 });
    const pdfViewport = page.getViewport({ scale: 1 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(renderViewport.width);
    canvas.height = Math.ceil(renderViewport.height);
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport: renderViewport, canvas }).promise;
    const jpegBlob = await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('無法轉換 PDF 頁面。')), 'image/jpeg', 0.9));
    const image = await output.embedJpg(await jpegBlob.arrayBuffer());
    const outputPage = output.addPage([pdfViewport.width, pdfViewport.height]);
    outputPage.drawImage(image, { x: 0, y: 0, width: pdfViewport.width, height: pdfViewport.height });
    page.cleanup();
    onProgress(pageNumber, source.numPages);
  }

  return { bytes: await output.save({ useObjectStreams: true }), pageCount: source.numPages };
}

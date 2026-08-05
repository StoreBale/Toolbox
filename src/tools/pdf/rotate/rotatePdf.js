import { degrees, PDFDocument } from 'pdf-lib';
import { parsePageSelection } from '../split/splitPdf.js';

export async function rotatePdf(file, selection, angle) {
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  const pages = pdf.getPages();
  const indices = selection.trim() ? parsePageSelection(selection, pages.length) : pages.map((_, index) => index);
  indices.forEach((index) => {
    const currentAngle = pages[index].getRotation().angle;
    pages[index].setRotation(degrees((currentAngle + Number(angle)) % 360));
  });
  return { bytes: await pdf.save(), rotatedPages: indices.length };
}

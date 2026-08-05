import JSZip from 'jszip';

export async function createZip(files) {
  const zip = new JSZip();
  files.forEach(({ name, blob }) => zip.file(name, blob));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

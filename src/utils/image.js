export const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function extensionFor(type) {
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
}

export async function processImage(file, { type, quality = 0.82, maxDimension = 0, targetWidth = 0, targetHeight = 0 }) {
  const bitmap = await createImageBitmap(file);
  const longestSide = Math.max(bitmap.width, bitmap.height);
  const scale = maxDimension > 0 && longestSide > maxDimension ? maxDimension / longestSide : 1;
  const width = Math.max(1, Math.round(targetWidth || bitmap.width * scale));
  const height = Math.max(1, Math.round(targetHeight || bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (type === 'image/jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('無法轉換圖片。')), type, quality);
  });
  return { blob, width, height };
}

export async function transformImage(file, operation) {
  const bitmap = await createImageBitmap(file);
  const swapsDimensions = operation === 'rotate90' || operation === 'rotate270';
  const canvas = document.createElement('canvas');
  canvas.width = swapsDimensions ? bitmap.height : bitmap.width;
  canvas.height = swapsDimensions ? bitmap.width : bitmap.height;
  const context = canvas.getContext('2d');

  if (file.type === 'image/jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (operation === 'rotate90') { context.translate(canvas.width, 0); context.rotate(Math.PI / 2); }
  if (operation === 'rotate180') { context.translate(canvas.width, canvas.height); context.rotate(Math.PI); }
  if (operation === 'rotate270') { context.translate(0, canvas.height); context.rotate(-Math.PI / 2); }
  if (operation === 'flipHorizontal') { context.translate(canvas.width, 0); context.scale(-1, 1); }
  if (operation === 'flipVertical') { context.translate(0, canvas.height); context.scale(1, -1); }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('無法轉換圖片。')), file.type, 0.92);
  });
  return { blob, width: canvas.width, height: canvas.height };
}

export async function cropImage(file, { x, y, width, height }) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (file.type === 'image/jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(bitmap, x, y, width, height, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('無法裁切圖片。')), file.type, 0.92));
  return blob;
}

export async function watermarkImage(file, { text, position, opacity, fontSize, color }) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const size = Math.max(12, Math.round(fontSize));
  context.globalAlpha = opacity;
  context.fillStyle = color;
  context.font = `700 ${size}px "Segoe UI", sans-serif`;
  context.textBaseline = 'middle';
  const padding = Math.max(16, Math.round(Math.min(canvas.width, canvas.height) * 0.04));
  const textWidth = context.measureText(text).width;
  const positions = {
    topLeft: [padding, padding + size / 2],
    topRight: [canvas.width - padding - textWidth, padding + size / 2],
    center: [(canvas.width - textWidth) / 2, canvas.height / 2],
    bottomLeft: [padding, canvas.height - padding - size / 2],
    bottomRight: [canvas.width - padding - textWidth, canvas.height - padding - size / 2]
  };
  const [x, y] = positions[position] ?? positions.bottomRight;
  context.fillText(text, Math.max(padding, x), y);
  context.globalAlpha = 1;
  const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('無法加入浮水印。')), file.type, 0.92));
  return blob;
}

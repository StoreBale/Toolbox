import { bindHome, homeTemplate } from './pages/home.js';
import { bindSidebar, sidebarTemplate } from './sidebar.js';
import { authDialogTemplate, bindAuth } from './auth.js';

const toolRoutes = {
  '/pdf/merge': () => import('./tools/pdf/merge/page.js').then((module) => ({ template: module.pdfMergeTemplate, bind: module.bindPdfMerge })),
  '/pdf/split': () => import('./tools/pdf/split/page.js').then((module) => ({ template: module.pdfSplitTemplate, bind: module.bindPdfSplit })),
  '/pdf/compress': () => import('./tools/pdf/compress/page.js').then((module) => ({ template: module.pdfCompressTemplate, bind: module.bindPdfCompress })),
  '/pdf/organize': () => import('./tools/pdf/organize/page.js').then((module) => ({ template: module.pdfOrganizeTemplate, bind: module.bindPdfOrganize })),
  '/pdf/from-image': () => import('./tools/pdf/from-image/page.js').then((module) => ({ template: module.imageToPdfTemplate, bind: module.bindImageToPdf })),
  '/pdf/to-image': () => import('./tools/pdf/to-image/page.js').then((module) => ({ template: module.pdfToImageTemplate, bind: module.bindPdfToImage })),
  '/pdf/page-numbers': () => import('./tools/pdf/page-numbers/page.js').then((module) => ({ template: module.pdfPageNumbersTemplate, bind: module.bindPdfPageNumbers })),
  '/pdf/watermark': () => import('./tools/pdf/watermark/page.js').then((module) => ({ template: module.pdfWatermarkTemplate, bind: module.bindPdfWatermark })),
  '/pdf/rotate': () => import('./tools/pdf/rotate/page.js').then((module) => ({ template: module.pdfRotateTemplate, bind: module.bindPdfRotate })),
  '/pdf/delete': () => import('./tools/pdf/delete/page.js').then((module) => ({ template: module.pdfDeleteTemplate, bind: module.bindPdfDelete })),
  '/pdf/unlock': () => import('./tools/pdf/unlock/page.js').then((module) => ({ template: module.pdfUnlockTemplate, bind: module.bindPdfUnlock })),
  '/image/compress': () => import('./tools/image/compress/page.js').then((module) => ({ template: module.imageCompressTemplate, bind: module.bindImageCompress })),
  '/image/convert': () => import('./tools/image/convert/page.js').then((module) => ({ template: module.imageConvertTemplate, bind: module.bindImageConvert })),
  '/image/resize': () => import('./tools/image/resize/page.js').then((module) => ({ template: module.imageResizeTemplate, bind: module.bindImageResize })),
  '/image/transform': () => import('./tools/image/transform/page.js').then((module) => ({ template: module.imageTransformTemplate, bind: module.bindImageTransform })),
  '/image/crop': () => import('./tools/image/crop/page.js').then((module) => ({ template: module.imageCropTemplate, bind: module.bindImageCrop })),
  '/image/watermark': () => import('./tools/image/watermark/page.js').then((module) => ({ template: module.imageWatermarkTemplate, bind: module.bindImageWatermark })),
  '/daily/qr': () => import('./tools/daily/qr/page.js').then((module) => ({ template: module.qrCodeTemplate, bind: module.bindQrCode })),
  '/daily/zip': () => import('./tools/daily/zip/page.js').then((module) => ({ template: module.zipToolTemplate, bind: module.bindZipTool })),
  '/daily/counter': () => import('./tools/daily/counter/page.js').then((module) => ({ template: module.textCounterTemplate, bind: module.bindTextCounter })),
  '/daily/cleanup': () => import('./tools/daily/cleanup/page.js').then((module) => ({ template: module.textCleanupTemplate, bind: module.bindTextCleanup })),
  '/daily/json': () => import('./tools/daily/json/page.js').then((module) => ({ template: module.jsonFormatterTemplate, bind: module.bindJsonFormatter })),
  '/daily/csv-json': () => import('./tools/daily/csv-json/page.js').then((module) => ({ template: module.csvJsonTemplate, bind: module.bindCsvJson }))
};

let renderVersion = 0;

function bindLinks() {
  document.querySelectorAll('[data-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      navigate(link.getAttribute('href'));
    });
  });
}

function categoryFromPath(pathname) {
  return pathname.match(/^\/category\/(pdf|image|daily)$/)?.[1] ?? null;
}

export function navigate(path) {
  if (window.location.pathname !== path) history.pushState({}, '', path);
  renderApp();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export async function renderApp() {
  const currentVersion = ++renderVersion;
  const pathname = window.location.pathname;
  const loader = toolRoutes[pathname];
  const app = document.querySelector('#app');

  app.innerHTML = `${sidebarTemplate(pathname)}<div class="app-shell">${loader ? '<div class="route-loading">載入工具中…</div>' : homeTemplate(categoryFromPath(pathname))}</div>${authDialogTemplate()}`;
  bindLinks();
  bindSidebar();
  bindAuth();

  if (!loader) {
    bindHome();
    return;
  }

  const route = await loader();
  if (currentVersion !== renderVersion) return;
  document.querySelector('.app-shell').innerHTML = route.template();
  bindLinks();
  bindSidebar();
  route.bind();
}

window.addEventListener('popstate', renderApp);
window.addEventListener('authchange', renderApp);

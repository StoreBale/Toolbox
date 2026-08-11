export const categories = [
  { id: 'pdf', label: 'PDF 工具', shortLabel: 'PDF', description: '整理、最佳化與解除 PDF 保護' },
  { id: 'image', label: '圖片工具', shortLabel: '圖片', description: '壓縮、裁切、轉檔與編輯圖片' },
  { id: 'daily', label: '日常工具', shortLabel: '日常', description: '處理文字、資料、QR Code 與壓縮檔' }
];

export const tools = [
  { id: 'pdf-merge', category: 'pdf', icon: 'merge', title: '合併 PDF', path: '/pdf/merge', color: 'orange', available: true, description: '將多個 PDF 依照指定順序合併成一份文件。', keywords: ['pdf', '合併', '文件'] },
  { id: 'pdf-split', category: 'pdf', icon: 'split', title: '分割 PDF', path: '/pdf/split', color: 'violet', available: true, description: '擷取指定頁面或範圍，另存成新的 PDF。', keywords: ['pdf', '分割', '頁面', '擷取'] },
  { id: 'pdf-compress', category: 'pdf', icon: 'compressPdf', title: '壓縮 PDF', path: '/pdf/compress', color: 'blue', available: true, description: '縮小掃描或圖片型 PDF，方便寄送分享。', keywords: ['pdf', '壓縮', '縮小'] },
  { id: 'pdf-organize', category: 'pdf', icon: 'organize', title: '整理 PDF 頁面', path: '/pdf/organize', color: 'violet', available: true, description: '看縮圖拖曳排序、旋轉或移除頁面。', keywords: ['pdf', '整理', '排序', '頁面'] },
  { id: 'image-to-pdf', category: 'pdf', icon: 'imageToPdf', title: '圖片轉 PDF', path: '/pdf/from-image', color: 'green', available: true, description: '將多張圖片依照順序合併成一份 PDF。', keywords: ['pdf', '圖片', 'jpg', 'png', '轉檔'] },
  { id: 'pdf-to-image', category: 'pdf', icon: 'pdfToImage', title: 'PDF 轉 JPG', path: '/pdf/to-image', color: 'rose', available: true, description: '將 PDF 每一頁轉成 JPG 或 PNG 圖片。', keywords: ['pdf', '圖片', 'jpg', 'png', '轉檔'] },
  { id: 'pdf-page-numbers', category: 'pdf', icon: 'pageNumbers', title: '加入 PDF 頁碼', path: '/pdf/page-numbers', color: 'blue', available: true, description: '自訂位置、範圍與起始數字，加入頁碼。', keywords: ['pdf', '頁碼', '頁數', '編號'] },
  { id: 'pdf-watermark', category: 'pdf', icon: 'pdfWatermark', title: 'PDF 浮水印', path: '/pdf/watermark', color: 'orange', available: true, description: '在每一頁加入自訂文字浮水印。', keywords: ['pdf', '浮水印', '文字', 'watermark'] },
  { id: 'pdf-rotate', category: 'pdf', icon: 'rotate', title: '旋轉 PDF', path: '/pdf/rotate', color: 'green', available: true, description: '旋轉全部或指定頁面並下載新 PDF。', keywords: ['pdf', '旋轉', '方向', '頁面'] },
  { id: 'pdf-delete', category: 'pdf', icon: 'delete', title: '刪除 PDF 頁面', path: '/pdf/delete', color: 'violet', available: true, description: '移除指定頁面並保留其餘 PDF 內容。', keywords: ['pdf', '刪除', '移除', '頁面'] },
  { id: 'pdf-unlock', category: 'pdf', icon: 'unlock', title: '移除 PDF 密碼', path: '/pdf/unlock', color: 'blue', available: true, description: '輸入目前密碼，建立不需密碼的新 PDF。', keywords: ['pdf', '密碼', '解鎖', 'unlock'] },
  { id: 'image-compress', category: 'image', icon: 'compressImage', title: '壓縮圖片', path: '/image/compress', color: 'green', available: true, description: '批次縮小 JPG、PNG 與 WebP 圖片。', keywords: ['圖片', '壓縮', 'jpg', 'png', 'webp'] },
  { id: 'image-resize', category: 'image', icon: 'resize', title: '調整圖片尺寸', path: '/image/resize', color: 'blue', available: true, description: '輸入寬高並保持比例，輸出指定尺寸圖片。', keywords: ['圖片', '尺寸', '寬度', '高度', 'resize'] },
  { id: 'image-crop', category: 'image', icon: 'crop', title: '裁切圖片', path: '/image/crop', color: 'violet', available: true, description: '視覺化選擇範圍並裁切需要的圖片區域。', keywords: ['圖片', '裁切', 'crop', '範圍'] },
  { id: 'image-convert', category: 'image', icon: 'convert', title: '圖片轉檔', path: '/image/convert', color: 'rose', available: true, description: '在 JPG、PNG、WebP 格式之間快速轉換。', keywords: ['圖片', '轉檔', '格式', 'jpg', 'png', 'webp'] },
  { id: 'image-transform', category: 'image', icon: 'flip', title: '圖片旋轉與翻轉', path: '/image/transform', color: 'green', available: true, description: '旋轉圖片方向，或進行水平與垂直翻轉。', keywords: ['圖片', '旋轉', '翻轉', '鏡像'] },
  { id: 'image-watermark', category: 'image', icon: 'watermark', title: '圖片浮水印', path: '/image/watermark', color: 'blue', available: true, description: '加入文字浮水印並設定位置與透明度。', keywords: ['圖片', '浮水印', 'watermark', '文字'] },
  { id: 'daily-qr', category: 'daily', icon: 'qr', title: 'QR Code 產生器', path: '/daily/qr', color: 'blue', available: true, description: '建立網址、Wi-Fi、文字與聯絡人 QR Code。', keywords: ['qr', '網址', 'wifi', '聯絡人'] },
  { id: 'daily-zip', category: 'daily', icon: 'zip', title: 'ZIP 打包／解壓', path: '/daily/zip', color: 'violet', available: true, description: '將多個檔案打包，或查看並解開 ZIP。', keywords: ['zip', '壓縮', '解壓縮', '打包'] },
  { id: 'daily-counter', category: 'daily', icon: 'counter', title: '字數統計', path: '/daily/counter', color: 'green', available: true, description: '即時統計中英文字數、行數與閱讀時間。', keywords: ['文字', '字數', '統計', '行數'] },
  { id: 'daily-cleanup', category: 'daily', icon: 'cleanup', title: '文字清理', path: '/daily/cleanup', color: 'blue', available: true, description: '清除多餘空白、空行與重複內容。', keywords: ['文字', '清理', '空白', '重複'] },
  { id: 'daily-json', category: 'daily', icon: 'json', title: 'JSON 格式化', path: '/daily/json', color: 'rose', available: true, description: '格式化、壓縮、排序並驗證 JSON。', keywords: ['json', '格式化', '驗證', '資料'] },
  { id: 'daily-csv-json', category: 'daily', icon: 'csvJson', title: 'CSV／JSON 轉換', path: '/daily/csv-json', color: 'orange', available: true, description: 'CSV 與 JSON 資料快速雙向轉換。', keywords: ['csv', 'json', '轉換', '資料'] }
];

export function getCategory(id) {
  return categories.find((category) => category.id === id);
}

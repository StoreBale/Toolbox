# Toolbox

瀏覽器本機處理的 PDF、圖片與日常工具網站。檔案與內容不會上傳到處理伺服器。

## 功能

- PDF：合併、分割、壓縮、整理、轉圖片、圖片轉 PDF、頁碼、浮水印、旋轉、刪頁與移除密碼
- 圖片：壓縮、調整尺寸、裁切、轉檔、旋轉／翻轉與浮水印
- 日常：QR Code、ZIP、字數統計、文字清理、JSON 格式化與 CSV／JSON 轉換

## 本機執行

```bash
npm install
npm run dev
```

## 正式建置

```bash
npm run build
```

建置輸出位於 `dist`，可部署至 Cloudflare Pages。SPA 路由規則位於 `public/_redirects`。

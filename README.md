<div align="center">
  <img src="public/logo.svg" width="96" alt="Toolbox logo">
  <h1>Toolbox</h1>
  <p>PDF、圖片與日常工具，全部在瀏覽器內完成。</p>
  <p>
    <a href="https://toolbox-a9q.pages.dev/"><strong>立即使用</strong></a>
    ·
    <a href="#功能一覽">功能一覽</a>
    ·
    <a href="#本機開發">本機開發</a>
  </p>
</div>

> [!NOTE]
> 選取的檔案只會在目前的瀏覽器中處理，不會上傳到處理伺服器。

## 特色

| 本機處理 | 直觀操作 | 多裝置支援 |
| --- | --- | --- |
| PDF、圖片與文字內容留在裝置上 | 清楚的步驟、即時狀態與下載結果 | 適合桌面與行動裝置使用 |

## 功能一覽

| 分類 | 工具 |
| --- | --- |
| PDF | 合併、分割、壓縮、整理、轉圖片、圖片轉 PDF、頁碼、浮水印、旋轉、刪除頁面、移除密碼 |
| 圖片 | 壓縮、調整尺寸、裁切、格式轉換、旋轉與翻轉、浮水印 |
| 日常 | QR Code、ZIP、字數統計、文字清理、JSON 格式化、CSV／JSON 轉換 |

## 本機開發

需要 Node.js 20 或更新版本。

```bash
npm install
npm run dev
```

執行測試與正式建置：

```bash
npm test
npm run build
```

## 專案結構

```text
public/          靜態資產與 Cloudflare Pages 路由規則
src/components/ 共用操作介面
src/tools/      PDF、圖片與日常工具
src/utils/      下載、圖片、文字與壓縮共用邏輯
tests/          核心邏輯與瀏覽器測試
```

## 技術與部署

- Vite + JavaScript
- `pdf-lib`、`pdfjs-dist`、`JSZip`、`qrcode`
- Cloudflare Pages 連接 GitHub，自動建置 `main`
- 正式建置輸出目錄：`dist`

## 隱私設計

- 不需要註冊帳號或提供個人資料。
- 不包含檔案上傳 API 或伺服器端文件處理。
- `.env`、IDE 設定、暫存檔與建置產物皆排除於版本控制之外。

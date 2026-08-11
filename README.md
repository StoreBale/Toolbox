<div align="center">
  <img src="frontend/public/logo.svg" width="96" alt="Toolbox logo">
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

需要 Node.js 20、Python 3.11 或更新版本，以及 Docker Desktop。

1. 啟動 PostgreSQL：

```powershell
docker compose up -d postgres
```

2. 安裝並啟動 Python API：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
Set-Location backend
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe app\main.py
```

API 預設位於 `http://127.0.0.1:8000`，互動文件位於 `http://127.0.0.1:8000/docs`。

### 後台控制中心

第一次啟動前，先執行 migration，再於 `backend` 目錄建立資料庫管理員：

```powershell
..\.venv\Scripts\python.exe scripts\bootstrap_admin.py
```

管理員電子郵件預設為 `admin@toolbox.local`。若舊版 `.env` 內已有管理員密碼，腳本會沿用並在成功寫入 PostgreSQL 後移除；全新安裝則只顯示一次隨機初始密碼。啟動後端後開啟 `http://127.0.0.1:8000`，會自動進入管理員登入頁。

管理員的電子郵件、Argon2 密碼雜湊與 `is_admin` 角色都存於 PostgreSQL；`.env` 只保留 `ADMIN_SESSION_SECRET`。正式部署時請設定獨立的工作階段密鑰，並將 `ADMIN_COOKIE_SECURE` 改為 `true`。

需要修改管理員密碼時，使用隱藏輸入提示：

```powershell
..\.venv\Scripts\python.exe scripts\bootstrap_admin.py --email admin@toolbox.local --prompt-password
```

後台可以：

- 查看 PostgreSQL 連線狀態、使用者與有效登入統計
- 查看電子郵件／Google 帳號及建立時間
- 撤銷指定帳號的所有登入工作階段
- 經二次確認後永久刪除帳號

3. 開啟另一個終端並啟動前端：

```powershell
Set-Location frontend
Copy-Item .env.example .env
npm install
npm run dev
```

執行測試與正式建置：

```powershell
Set-Location frontend
npm test
npm run build
Set-Location ..\backend
..\.venv\Scripts\python.exe -m pytest
```

## Google 登入設定

在 Google Auth Platform 建立「網頁應用程式」OAuth 用戶端，將本機與正式網站加入「已授權的 JavaScript 來源」，例如：

- `http://localhost:5173`
- `https://toolbox-a9q.pages.dev`

將同一個 Client ID 同時填入前端 `.env`：

```env
VITE_API_URL=http://127.0.0.1:8000/api
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

以及後端 `backend/.env`：

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

前端取得 Google ID Token 後交給 Python API；API 會驗證簽章、audience、issuer、有效期限及電子郵件驗證狀態，再以 Google `sub` 建立或連結 PostgreSQL 使用者。此流程不需要把 Google Client Secret 放進前端或 Git。

## 專案結構

```text
frontend/          Vite 前端專案
frontend/public/   靜態資產與 Cloudflare Pages 路由規則
frontend/src/      畫面、工具與前端共用邏輯
frontend/tests/    前端邏輯與瀏覽器測試
backend/app/       FastAPI、SQLAlchemy 資料模型與帳號 API
backend/alembic/   PostgreSQL schema migrations
backend/tests/     後端 API 測試
docker-compose.yml 本機 PostgreSQL
```

## 技術與部署

- Vite + JavaScript 前端
- FastAPI + SQLAlchemy + PostgreSQL 後端
- Alembic 資料庫 migration、Argon2 密碼雜湊
- `pdf-lib`、`pdfjs-dist`、`JSZip`、`qrcode`
- 前端可部署至 Cloudflare Pages；Root directory 設為 `frontend`，建置輸出目錄為 `dist`
- Python API 需部署至支援 Docker／Python 的服務，並在 Cloudflare Pages 設定正式 `VITE_API_URL`

## 隱私設計

- 帳號功能為選用；電子郵件、密碼雜湊、Google 帳號識別碼及工作階段會保存在 PostgreSQL。
- 不包含檔案上傳 API 或伺服器端文件處理。
- `.env`、IDE 設定、暫存檔與建置產物皆排除於版本控制之外。

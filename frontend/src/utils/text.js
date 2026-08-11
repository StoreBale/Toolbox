export function analyzeText(value) {
  const trimmed = value.trim();
  const latinWords = value.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? [];
  const cjkCharacters = value.match(/[\u3400-\u9fff\uf900-\ufaff]/g) ?? [];
  const characters = value.replace(/\s/g, '').length;
  const lines = value ? value.split(/\r?\n/).length : 0;
  const paragraphs = trimmed ? trimmed.split(/(?:\r?\n){2,}/).filter((part) => part.trim()).length : 0;
  const words = latinWords.length + cjkCharacters.length;
  return { characters, charactersWithSpaces: value.length, words, lines, paragraphs, readingMinutes: words ? Math.max(1, Math.ceil(words / 300)) : 0 };
}

export function cleanText(value, options) {
  let result = value.replace(/\r\n?/g, '\n').replace(/\u3000/g, ' ');
  if (options.trimLines) result = result.split('\n').map((line) => line.trim()).join('\n');
  if (options.collapseSpaces) result = result.replace(/[ \t]+/g, ' ');
  if (options.removeBlankLines) result = result.replace(/\n{2,}/g, '\n');
  if (options.removeDuplicateLines) {
    const seen = new Set();
    result = result.split('\n').filter((line) => { if (seen.has(line)) return false; seen.add(line); return true; }).join('\n');
  }
  return result.trim();
}

export function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort((a, b) => a.localeCompare(b)).map((key) => [key, sortJson(value[key])]));
  return value;
}

export function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  if (quoted) throw new Error('CSV 中有未關閉的雙引號。');
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function csvCell(value) {
  const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvToJson(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV 至少需要標題列與一列資料。');
  const headers = rows[0].map((header, index) => header.trim() || `欄位${index + 1}`);
  return rows.slice(1).filter((row) => row.some((cell) => cell !== '')).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

export function jsonToCsv(value) {
  if (!Array.isArray(value) || !value.every((item) => item && typeof item === 'object' && !Array.isArray(item))) throw new Error('JSON 必須是物件陣列，例如 [{"name":"Amy"}]。');
  const headers = [...new Set(value.flatMap((item) => Object.keys(item)))];
  if (!headers.length) throw new Error('JSON 沒有可轉換的欄位。');
  return [headers.map(csvCell).join(','), ...value.map((item) => headers.map((header) => csvCell(item[header])).join(','))].join('\r\n');
}

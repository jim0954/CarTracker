// --- 保養紀錄的項目明細：[{ name, spec, price }] ---

// 早期從愛車99 匯入的紀錄沒有明細，項目寫在標題（以「、」分隔）與備註（以「；」分隔，
// 每段為「名稱 規格 $單價×數量 (說明)」）。能完整對上時轉回明細，其餘備註保留。
function parseLegacy(record) {
  const names = String(record.title || '').split('、').map(s => s.trim());
  const segs = String(record.notes || '').split('；');
  if (!names[0] || segs.length < names.length) return null;

  const parts = [];
  for (let i = 0; i < names.length; i++) {
    const seg = segs[i].trim();
    if (!seg.startsWith(names[i])) return null;
    let rest = seg.slice(names[i].length);
    let price = 0;
    rest = rest.replace(/\s?\$(\d+(?:\.\d+)?)(?:×(\d+))?/, (m, p, q) => {
      price = Number(p) * (Number(q) || 1);
      return '';
    });
    parts.push({ name: names[i], spec: rest.replace(/\s+/g, ' ').trim(), price });
  }
  return { parts, notes: segs.slice(names.length).join('；').trim() };
}

// 回傳 { parts, notes }：有明細直接使用，否則嘗試從舊格式轉回
export function recordParts(record) {
  const parts = record.details && Array.isArray(record.details.parts) ? record.details.parts : [];
  if (parts.length || record.type !== 'maintenance') return { parts, notes: record.notes || '' };
  return parseLegacy(record) || { parts: [], notes: record.notes || '' };
}

// --- 依里程與月數推算保養項目的預計到期日 ---
// 月數到期日 = 上次日期 + 間隔月數
// 里程到期日 = 今天 + 剩餘公里 ÷ 平均每日公里數（由近 90 天紀錄估算）
// 兩者取較早者，寫入「預計到期日」欄

const RATE_WINDOW_DAYS = 90;
const MIN_RATE_SPAN_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate_(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(str || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function today_() {
  return parseDate_(formatDate_(new Date()));
}

function addMonths_(date, months) {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0); // 1/31 + 1 個月 → 2 月底
  return d;
}

// points: [{ date: Date, km: number }]；資料不足時回傳 null
function rateFromPoints_(points) {
  if (points.length < 2) return null;
  const times = points.map(p => p.date.getTime());
  const kms = points.map(p => p.km);
  const spanDays = (Math.max(...times) - Math.min(...times)) / DAY_MS;
  if (spanDays < MIN_RATE_SPAN_DAYS) return null;
  const rate = (Math.max(...kms) - Math.min(...kms)) / spanDays;
  return rate > 0 ? rate : null;
}

// 平均每日公里數：優先用近 90 天，不足時改用全部紀錄
function avgDailyKm_(vehicle, records, today) {
  const points = records
    .map(r => ({ date: parseDate_(r.date), km: Number(r.mileage) }))
    .filter(p => p.date && p.km > 0);
  if (vehicle.updatedAt && Number(vehicle.currentMileage) > 0) {
    const updated = parseDate_(formatDate_(new Date(vehicle.updatedAt)));
    if (updated) points.push({ date: updated, km: Number(vehicle.currentMileage) });
  }
  const since = today.getTime() - RATE_WINDOW_DAYS * DAY_MS;
  return rateFromPoints_(points.filter(p => p.date.getTime() >= since)) || rateFromPoints_(points);
}

function computeDueDate_(item, vehicle, dailyKm, today) {
  const candidates = [];

  const lastDate = parseDate_(item.lastDate);
  if (lastDate && Number(item.intervalMonths) > 0) {
    candidates.push(addMonths_(lastDate, Number(item.intervalMonths)));
  }

  if (dailyKm && Number(item.intervalKm) > 0) {
    const remainingKm = Number(item.lastKm || 0) + Number(item.intervalKm) - Number(vehicle.currentMileage || 0);
    const days = Math.max(0, Math.ceil(remainingKm / dailyKm));
    candidates.push(new Date(today.getTime() + days * DAY_MS));
  }

  if (candidates.length === 0) return '';
  return formatDate_(new Date(Math.min(...candidates.map(d => d.getTime()))));
}

// 重新計算某台車所有保養項目的到期日，只寫回有變動的列；回傳前端格式的項目清單
function refreshDueDates_(email, vehicleId) {
  const vehicle = readTable_('vehicles').rows.find(r => r.id === vehicleId && r.owner === email);
  if (!vehicle) return [];
  const records = readTable_('records').rows.filter(r => r.owner === email && r.vehicleId === vehicleId);
  const items = readTable_('items');
  const today = today_();
  const dailyKm = avgDailyKm_(vehicle, records, today);

  return items.rows
    .filter(r => r.owner === email && r.vehicleId === vehicleId)
    .map(row => {
      const dueDate = computeDueDate_(row, vehicle, dailyKm, today);
      if (dueDate !== row.dueDate) updateRow_(items, row._row, { dueDate });
      return itemToClient_({ ...row, dueDate });
    });
}

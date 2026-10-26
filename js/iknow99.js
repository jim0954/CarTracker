// --- 愛車99（iknow99.com）資料轉換 ---
// 輸入：在愛車99 網站以「收集器」下載的 iknow99_export.json（[{ url, data }] 陣列）
//   data.Forms + data.Count：某台車的紀錄列表（可能分頁）
//   data.Form：單筆紀錄明細，保養的 SubForm 是更換項目陣列，加油的 SubForm 是加油資料
//   data.Components：某台車各保養項目目前的狀態（週期與最近一次更換）
// 輸出：CarTracker 格式 { vehicles, maintenanceItems, records }，供附加匯入

const FORM_CARE = 1;
const FORM_FUEL = 2;
const NEW_CAR_TITLE = '新車保養週期';
const CAR_HINTS = ['變速箱', '冷氣', '雨刷', '方向機', '汽車檢驗'];

// 愛車99 的時間是 UTC，轉成台灣日期
function localDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s || '');
  if (!m) return String(s || '').slice(0, 10);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

const num = v => Number(v) || 0;
const round = (v, digits) => Math.round(num(v) * 10 ** digits) / 10 ** digits;
const countTotal = c => num(c.Care) + num(c.Fuel) + num(c.Expense);
const sameCount = (a, b) => a.Care === b.Care && a.Fuel === b.Fuel && a.Expense === b.Expense;

export function isIknow99Export(data) {
  return Array.isArray(data) && data.some(e => e && e.data && (e.data.Forms || e.data.Form || e.data.Components));
}

// 依紀錄列表把紀錄分到各台車：有共同紀錄的列表是同一台車；
// 分頁的後續頁沒有重疊，以相同的 Count 且合併後不超過總數判斷
function groupVehicles(lists) {
  const groups = [];
  lists.forEach(list => {
    const ids = list.Forms.map(f => f.Id);
    let group = groups.find(g => ids.some(id => g.forms.has(id)));
    if (!group) {
      group = groups.find(g => sameCount(g.count, list.Count) && g.forms.size + ids.length <= countTotal(list.Count));
    }
    if (!group) {
      group = { count: list.Count, forms: new Map() };
      groups.push(group);
    }
    list.Forms.forEach(f => group.forms.set(f.Id, f));
  });
  return groups;
}

function itemNotes(sub) {
  const parts = [sub.Name];
  if (sub.Spec) parts.push(sub.Spec);
  if (num(sub.UnitPrice) > 0) parts.push(`$${num(sub.UnitPrice)}${num(sub.Qty) > 1 ? `×${num(sub.Qty)}` : ''}`);
  if (sub.Comment) parts.push(`(${sub.Comment})`);
  return parts.join(' ');
}

// 加油明細；沒有明細時從列表的 Title（是否加滿,公升,單價,...,油品,距離）解析
function fuelDetails(form, detail) {
  if (detail && detail.SubForm && !Array.isArray(detail.SubForm)) {
    const s = detail.SubForm;
    return { liters: round(s.Quantity, 2), pricePerLiter: round(s.UnitPrice, 2), isFullTank: num(s.EOP) >= 100, fuelType: s.FuelType || '' };
  }
  const p = String(form.Title || '').split(',');
  return { liters: round(p[1], 2), pricePerLiter: round(p[2], 2), isFullTank: p[0] === 'true', fuelType: p[6] || '' };
}

export function convertIknow99(captures) {
  const lists = captures.filter(e => e.data && Array.isArray(e.data.Forms)).map(e => e.data);
  const details = new Map();
  captures.forEach(e => {
    if (e.data && e.data.Form) details.set(e.data.Form.Id, e.data.Form);
  });
  const properties = captures.filter(e => e.data && Array.isArray(e.data.Components)).map(e => e.data.Components);

  const out = { vehicles: [], maintenanceItems: [], records: [] };
  let missingDetails = 0;

  groupVehicles(lists).forEach((group, gi) => {
    const forms = [...group.forms.values()].sort((a, b) => String(a.Date).localeCompare(String(b.Date)));
    const vehicleId = `iknow_v${gi + 1}`;
    const components = properties.find(list => list.some(c => group.forms.has(c.FormId))) || [];

    // 保養項目：先依明細由舊到新推算，再以愛車99 的目前狀態（Components）為準
    const items = new Map();
    const setItem = (sub, odometer, date) => {
      const prev = items.get(sub.Name) || {};
      items.set(sub.Name, {
        ...prev,
        name: sub.Name,
        intervalKm: num(sub.ValidDistance),
        intervalMonths: num(sub.LifeTime),
        lastKm: num(odometer),
        lastDate: date,
        notes: sub.Spec || prev.notes || ''
      });
    };
    forms.forEach(f => {
      const d = details.get(f.Id);
      if (f.Type === FORM_CARE && d && Array.isArray(d.SubForm)) d.SubForm.forEach(s => setItem(s, f.Odometer, localDate(f.Date)));
    });
    components.forEach(c => setItem(c, c.Odometer, localDate(c.Date)));

    const itemIds = new Map();
    [...items.values()]
      .filter(it => it.intervalKm > 0 || it.intervalMonths > 0)
      .forEach((it, i) => {
        const id = `${vehicleId}_m${i + 1}`;
        itemIds.set(it.name, id);
        out.maintenanceItems.push({ id, vehicleId, ...it });
      });

    forms.forEach(f => {
      const d = details.get(f.Id);
      const base = { id: `iknow_r${f.Id}`, vehicleId, date: localDate(f.Date), mileage: num(f.Odometer), amount: num(f.Amount) };
      if (f.Type === FORM_FUEL) {
        const fuel = fuelDetails(f, d);
        out.records.push({
          ...base, type: 'fuel', title: `加油 ${fuel.fuelType}`.trim(), vendor: '', notes: f.Comment || '',
          details: { liters: fuel.liters, pricePerLiter: fuel.pricePerLiter, isFullTank: fuel.isFullTank }
        });
        return;
      }
      if (f.Type !== FORM_CARE) {
        out.records.push({ ...base, type: 'other', title: f.Title || '其他支出', vendor: '', notes: f.Comment || '', details: {} });
        return;
      }
      if (f.Title === NEW_CAR_TITLE) return; // 只是週期設定，已轉成保養項目
      if (!d) missingDetails++;
      const subs = d && Array.isArray(d.SubForm) ? d.SubForm : [];
      const notes = subs.map(itemNotes);
      if (f.Comment) notes.push(f.Comment);
      out.records.push({
        ...base,
        type: 'maintenance',
        title: subs.length ? subs.map(s => s.Name).join('、') : (f.Title || '保養維修'),
        vendor: subs.length ? (f.Title || '') : '',
        notes: notes.join('；'),
        details: { itemIds: [...new Set(subs.map(s => itemIds.get(s.Name)).filter(Boolean))] }
      });
    });

    const names = [...items.keys()].join(' ');
    const type = CAR_HINTS.some(h => names.includes(h)) ? 'car' : 'moto';
    const first = forms[0];
    const year = first ? Number(localDate(first.Date).slice(0, 4)) : new Date().getFullYear();
    out.vehicles.push({
      id: vehicleId,
      name: `愛車99 ${type === 'car' ? '汽車' : '機車'} ${gi + 1}（${year} 起）`,
      plate: '',
      type,
      year,
      currentMileage: Math.max(0, ...forms.map(f => num(f.Odometer)), ...components.map(c => num(c.Odometer))),
      initialMileage: 0,
      notes: '從愛車99 匯入，請編輯車名與車牌'
    });
  });

  return { data: out, missingDetails };
}

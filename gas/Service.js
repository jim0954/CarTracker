// --- 業務邏輯：所有操作都限定在登入者（email）自己的資料 ---

// 寫入期間鎖定，避免兩人同時存檔互相覆蓋
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function findOwned_(table, email, id) {
  const row = table.rows.find(r => r.id === id && r.owner === email);
  if (!row) throw new AppError_('NOT_FOUND', '找不到資料或沒有權限');
  return row;
}

function stripPrivate_(row) {
  const { _row, owner, ...rest } = row;
  return rest;
}

// --- 前端資料格式轉換 ---
function vehicleToClient_(row) {
  const { createdAt, updatedAt, ...v } = stripPrivate_(row);
  return v;
}

function itemToClient_(row) {
  const { updatedAt, calendarEventId, ...item } = stripPrivate_(row);
  return item;
}

// 試算表為平面欄位，前端的紀錄把加油 / 保養細節放在 details
function recordToClient_(row) {
  const r = stripPrivate_(row);
  let details = {};
  if (r.type === 'fuel') {
    details = { liters: r.liters || 0, pricePerLiter: r.pricePerLiter || 0, isFullTank: r.isFullTank };
  } else if (r.type === 'maintenance') {
    details = { itemIds: r.itemIds };
  }
  return {
    id: r.id, vehicleId: r.vehicleId, date: r.date, mileage: r.mileage, type: r.type,
    title: r.title, amount: r.amount, vendor: r.vendor, notes: r.notes, details
  };
}

function recordFromClient_(rec) {
  const d = rec.details || {};
  return {
    date: rec.date, mileage: rec.mileage, type: rec.type, title: rec.title,
    amount: rec.amount, vendor: rec.vendor, notes: rec.notes,
    liters: rec.type === 'fuel' ? d.liters : '',
    pricePerLiter: rec.type === 'fuel' ? d.pricePerLiter : '',
    isFullTank: rec.type === 'fuel' ? !!d.isFullTank : false,
    itemIds: rec.type === 'maintenance' ? d.itemIds || [] : []
  };
}

function pick_(obj, keys) {
  const out = {};
  keys.forEach(k => { if (k in obj) out[k] = obj[k]; });
  return out;
}

const VEHICLE_FIELDS = ['name', 'plate', 'type', 'year', 'currentMileage', 'notes'];
const ITEM_FIELDS = ['name', 'intervalKm', 'intervalMonths', 'lastKm', 'lastDate', 'notes'];

// --- 讀取全部 ---
function svcBootstrap_(email) {
  const own = rows => rows.filter(r => r.owner === email);
  return {
    vehicles: own(readTable_('vehicles').rows).map(vehicleToClient_),
    maintenanceItems: own(readTable_('items').rows).map(itemToClient_),
    records: own(readTable_('records').rows).map(recordToClient_)
  };
}

// --- 車輛 ---
function svcSaveVehicle_(email, data) {
  return withLock_(() => {
    const table = readTable_('vehicles');
    const now = new Date();
    if (data.id) {
      const row = findOwned_(table, email, data.id);
      const changes = { ...pick_(data, VEHICLE_FIELDS), updatedAt: now };
      updateRow_(table, row._row, changes);
      // 里程變動會影響到期日推算
      return { vehicle: vehicleToClient_({ ...row, ...changes }), items: refreshDueDates_(email, data.id) };
    }
    const row = {
      ...pick_(data, VEHICLE_FIELDS),
      id: newId_('v'), owner: email,
      initialMileage: data.currentMileage || 0,
      createdAt: now, updatedAt: now
    };
    appendRows_(table, [row]);
    return { vehicle: vehicleToClient_(row), items: [] };
  });
}

// 一併刪除該車的保養項目與紀錄
function svcDeleteVehicle_(email, vehicleId) {
  return withLock_(() => {
    const vehicles = readTable_('vehicles');
    const row = findOwned_(vehicles, email, vehicleId);
    ['records', 'items'].forEach(key => {
      const table = readTable_(key);
      deleteRows_(table, table.rows.filter(r => r.owner === email && r.vehicleId === vehicleId).map(r => r._row));
    });
    deleteRows_(vehicles, [row._row]);
    return { id: vehicleId };
  });
}

// --- 保養項目 ---
function svcSaveItem_(email, data) {
  return withLock_(() => {
    const table = readTable_('items');
    const now = new Date();
    if (data.id) {
      const row = findOwned_(table, email, data.id);
      const changes = { ...pick_(data, ITEM_FIELDS), updatedAt: now };
      updateRow_(table, row._row, changes);
      return { item: refreshDueDates_(email, row.vehicleId).find(it => it.id === row.id) };
    }
    findOwned_(readTable_('vehicles'), email, data.vehicleId);
    const row = { ...pick_(data, ITEM_FIELDS), id: newId_('item'), owner: email, vehicleId: data.vehicleId, updatedAt: now };
    appendRows_(table, [row]);
    return { item: refreshDueDates_(email, data.vehicleId).find(it => it.id === row.id) };
  });
}

function svcDeleteItem_(email, itemId) {
  return withLock_(() => {
    const table = readTable_('items');
    const row = findOwned_(table, email, itemId);
    deleteRows_(table, [row._row]);
    return { id: itemId };
  });
}

// --- 用車紀錄 ---
// 新增紀錄時：里程較高則更新車輛里程；保養紀錄重設勾選項目的上次里程與日期
// 回傳 { record, vehicle, items } 讓前端一次更新
function svcSaveRecord_(email, data) {
  return withLock_(() => {
    const records = readTable_('records');
    const now = new Date();

    if (data.id) {
      const row = findOwned_(records, email, data.id);
      const changes = { ...recordFromClient_(data), updatedAt: now };
      updateRow_(records, row._row, changes);
      return { record: recordToClient_({ ...row, ...changes }), items: refreshDueDates_(email, row.vehicleId) };
    }

    const vehicles = readTable_('vehicles');
    const vehicleRow = findOwned_(vehicles, email, data.vehicleId);
    const row = {
      ...recordFromClient_(data),
      id: newId_('rec'), owner: email, vehicleId: data.vehicleId,
      createdAt: now, updatedAt: now
    };
    appendRows_(records, [row]);

    let vehicle = vehicleToClient_(vehicleRow);
    if (Number(row.mileage) > Number(vehicleRow.currentMileage || 0)) {
      updateRow_(vehicles, vehicleRow._row, { currentMileage: row.mileage, updatedAt: now });
      vehicle = { ...vehicle, currentMileage: Number(row.mileage) };
    }

    const items = readTable_('items');
    row.itemIds.forEach(itemId => {
      const itemRow = items.rows.find(r => r.id === itemId && r.owner === email && r.vehicleId === data.vehicleId);
      if (!itemRow) return;
      updateRow_(items, itemRow._row, { lastKm: row.mileage, lastDate: row.date, updatedAt: now });
    });

    // items 為該車全部保養項目（含重新推算的到期日）
    return { record: recordToClient_(row), vehicle, items: refreshDueDates_(email, data.vehicleId) };
  });
}

function svcDeleteRecord_(email, recordId) {
  return withLock_(() => {
    const table = readTable_('records');
    const row = findOwned_(table, email, recordId);
    deleteRows_(table, [row._row]);
    return { id: recordId, items: refreshDueDates_(email, row.vehicleId) };
  });
}

// --- 匯入（本機資料搬到雲端）---
// 會先刪除登入者在雲端的所有資料，再寫入；ID 全部重新產生
function svcImportAll_(email, data) {
  return withLock_(() => {
    const now = new Date();
    const vehicleIdMap = {};
    const itemIdMap = {};

    const vehicleRows = (data.vehicles || []).map(v => {
      const id = newId_('v');
      vehicleIdMap[v.id] = id;
      return {
        ...pick_(v, VEHICLE_FIELDS), id, owner: email,
        initialMileage: v.initialMileage || 0, createdAt: now, updatedAt: now
      };
    });

    const itemRows = (data.maintenanceItems || []).filter(it => vehicleIdMap[it.vehicleId]).map(it => {
      const id = newId_('item');
      itemIdMap[it.id] = id;
      return { ...pick_(it, ITEM_FIELDS), id, owner: email, vehicleId: vehicleIdMap[it.vehicleId], updatedAt: now };
    });

    const recordRows = (data.records || []).filter(r => vehicleIdMap[r.vehicleId]).map(r => {
      const flat = recordFromClient_(r);
      flat.itemIds = flat.itemIds.map(id => itemIdMap[id]).filter(Boolean);
      return { ...flat, id: newId_('rec'), owner: email, vehicleId: vehicleIdMap[r.vehicleId], createdAt: now, updatedAt: now };
    });

    [['records', recordRows], ['items', itemRows], ['vehicles', vehicleRows]].forEach(([key, rows]) => {
      const table = readTable_(key);
      deleteRows_(table, table.rows.filter(r => r.owner === email).map(r => r._row));
      appendRows_(readTable_(key), rows);
    });
    vehicleRows.forEach(v => refreshDueDates_(email, v.id));

    return { vehicles: vehicleRows.length, maintenanceItems: itemRows.length, records: recordRows.length };
  });
}

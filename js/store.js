// --- 資料存取層 ---
// 畫面與事件處理只透過這裡讀寫資料。
// 本機模式：資料存在 localStorage。
// 雲端模式：先更新畫面（樂觀更新），再依序送到 GAS 後台；後台回傳的結果（例如推算的到期日）
// 會合併回來並重新繪製。同步失敗時重新從雲端載入，確保畫面與雲端一致。
import { INITIAL_STATE } from './sample-data.js';
import { showToast } from './utils.js';
import { isCloudMode } from './config.js';
import * as api from './api.js';

const LOCAL_STORAGE_KEY = 'cartracker_db_v1';
const LEGACY_STORAGE_KEY = 'autocare99_pro_db_v1';
const CLOUD_CACHE_PREFIX = 'cartracker_cache_';

// 資料格式版本；格式變更時遞增並在 migrate() 補上轉換
export const SCHEMA_VERSION = 1;

let appState = null;
let storageKey = LOCAL_STORAGE_KEY;

function emptyState() {
  return { schemaVersion: SCHEMA_VERSION, currentVehicleId: null, vehicles: [], maintenanceItems: [], records: [] };
}

function cloneInitialState() {
  return { ...JSON.parse(JSON.stringify(INITIAL_STATE)), schemaVersion: SCHEMA_VERSION };
}

// 舊版資料（無 schemaVersion）即為第 1 版格式
function migrate(data) {
  if (!data.schemaVersion) data.schemaVersion = 1;
  return data;
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(appState));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
    if (!isCloudMode) showToast('儲存失敗：本機儲存空間不足或已受限', 'error');
  }
}

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function readStorage(key) {
  try {
    const json = localStorage.getItem(key);
    return json ? migrate(JSON.parse(json)) : null;
  } catch (e) {
    console.warn('LocalStorage error', e);
    return null;
  }
}

// --- 變更通知與同步狀態 ---
const changeListeners = [];
const syncListeners = [];
let errorHandler = (err) => showToast(err.message, 'error');
let syncQueue = Promise.resolve();
let pendingCount = 0;
let syncError = false;

export function onChange(cb) {
  changeListeners.push(cb);
}

// cb({ pending, error })
export function onSyncState(cb) {
  syncListeners.push(cb);
}

export function setErrorHandler(fn) {
  errorHandler = fn;
}

export function hasPendingSync() {
  return pendingCount > 0;
}

function notifyChange() {
  changeListeners.forEach(cb => cb());
}

function notifySync() {
  syncListeners.forEach(cb => cb({ pending: pendingCount, error: syncError }));
}

// --- 待上傳佇列（outbox）---
// 每個變更先存進 localStorage 的佇列再送出，成功才移除。離線或登入過期時留在佇列，
// 下次連線（重新整理、重新開啟、恢復網路）會先依序補送，再從雲端重新載入，不會被雲端舊資料蓋掉。
// 後台以前端產生的 ID 做新增或更新，重送不會重複建立。
let outbox = [];
let outboxKey = null;
let offlineNotified = false;

function saveOutbox() {
  if (!outboxKey) return;
  try {
    localStorage.setItem(outboxKey, JSON.stringify(outbox));
  } catch (e) { /* 忽略 */ }
}

function loadOutbox(email) {
  outboxKey = `${CLOUD_CACHE_PREFIX}outbox_${email.toLowerCase()}`;
  try {
    outbox = JSON.parse(localStorage.getItem(outboxKey) || '[]');
  } catch (e) {
    outbox = [];
  }
}

function removeFromOutbox(entry) {
  outbox = outbox.filter(e => e.id !== entry.id);
  saveOutbox();
}

const KEEP_FOR_RETRY = ['NETWORK', ...api.AUTH_ERROR_CODES];

// 送出一筆；回傳 false 表示仍留在佇列（離線或需要重新登入）
async function sendEntry(entry, applyResult, reloadOnError = true) {
  if (!outbox.some(e => e.id === entry.id)) return true; // 已由補送處理
  try {
    const result = await api.call(entry.action, entry.payload);
    removeFromOutbox(entry);
    offlineNotified = false;
    if (applyResult && result) {
      applyResult(result);
      persist();
      notifyChange();
    }
    return true;
  } catch (err) {
    if (KEEP_FOR_RETRY.includes(err.code)) {
      syncError = true;
      if (err.code !== 'NETWORK') errorHandler(err);
      else if (!offlineNotified) {
        offlineNotified = true;
        showToast('目前無法連線，資料已暫存在這台裝置，連線後會自動上傳', 'error');
      }
      return false;
    }
    // 後台拒絕（資料錯誤等）：移除並以雲端資料為準；重送刪除時已不存在視為完成
    removeFromOutbox(entry);
    if (entry.action.startsWith('delete') && err.code === 'NOT_FOUND') return true;
    syncError = true;
    errorHandler(err);
    if (reloadOnError) await reloadFromCloud().catch(() => {});
    return true;
  }
}

// 依序送出，確保「新增車輛」一定早於「新增該車的紀錄」
function sync(action, payload, applyResult) {
  if (!isCloudMode) return;
  const entry = { id: newId('op'), action, payload };
  outbox.push(entry);
  saveOutbox();
  pendingCount++;
  syncError = false;
  notifySync();
  syncQueue = syncQueue
    .then(() => sendEntry(entry, applyResult))
    .finally(() => {
      pendingCount--;
      notifySync();
    });
}

// 補送佇列中所有尚未上傳的變更；回傳 true 表示已全部送出
function flushOutbox() {
  const run = syncQueue.then(async () => {
    for (const entry of [...outbox]) {
      if (!(await sendEntry(entry, null, false))) return false;
    }
    return true;
  });
  syncQueue = run.catch(() => {});
  return run;
}

export function hasUnsentChanges() {
  return outbox.length > 0;
}

function replaceById(list, obj) {
  const idx = list.findIndex(x => x.id === obj.id);
  if (idx === -1) list.push(obj);
  else list[idx] = { ...list[idx], ...obj };
}

function mergeItems(items) {
  (items || []).forEach(it => replaceById(appState.maintenanceItems, it));
}

// --- 載入 ---
export function load() {
  // 搬移舊版儲存鍵的資料
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy && !localStorage.getItem(LOCAL_STORAGE_KEY)) {
      localStorage.setItem(LOCAL_STORAGE_KEY, legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch (e) { /* 忽略 */ }
  storageKey = LOCAL_STORAGE_KEY;
  appState = readStorage(LOCAL_STORAGE_KEY) || emptyState();
}

// 雲端模式：先用上次的快取立即顯示，回傳 true 表示有快取可用
export function loadCloudCache(email) {
  storageKey = CLOUD_CACHE_PREFIX + email.toLowerCase();
  loadOutbox(email);
  const cached = readStorage(storageKey);
  appState = cached || emptyState();
  return !!cached;
}

// 從雲端取得最新資料（保留目前選擇的車輛）；先補送離線時暫存的變更，避免被雲端舊資料蓋掉
export async function reloadFromCloud() {
  if (outbox.length && !(await flushOutbox())) {
    throw new api.ApiError('NETWORK', `還有 ${outbox.length} 筆變更尚未上傳，連線後會自動補送`);
  }
  const data = await api.call('bootstrap');
  const currentVehicleId = appState ? appState.currentVehicleId : null;
  appState = {
    schemaVersion: SCHEMA_VERSION,
    currentVehicleId,
    vehicles: data.vehicles,
    maintenanceItems: data.maintenanceItems,
    records: data.records
  };
  syncError = false;
  offlineNotified = false;
  persist();
  notifyChange();
  notifySync();
  return data.user;
}

// --- 車輛 ---
export function getVehicles() {
  return appState.vehicles;
}

export function getCurrentVehicle() {
  let vehicle = appState.vehicles.find(v => v.id === appState.currentVehicleId);
  if (!vehicle && appState.vehicles.length > 0) {
    vehicle = appState.vehicles[0];
    appState.currentVehicleId = vehicle.id;
  }
  return vehicle;
}

export function setCurrentVehicle(vehicleId) {
  appState.currentVehicleId = vehicleId;
  persist();
}

function applyVehicleResult(res) {
  replaceById(appState.vehicles, res.vehicle);
  mergeItems(res.items);
}

// data 有 id 時更新，否則新增並切換為目前車輛
export function saveVehicle(data) {
  let v;
  if (data.id) {
    v = appState.vehicles.find(item => item.id === data.id);
    if (v) Object.assign(v, data);
  } else {
    v = { ...data, id: newId('v'), initialMileage: data.currentMileage };
    appState.vehicles.push(v);
    appState.currentVehicleId = v.id;
  }
  persist();
  sync('saveVehicle', { vehicle: v }, applyVehicleResult);
  return v;
}

export function updateMileage(vehicleId, mileage) {
  const v = appState.vehicles.find(item => item.id === vehicleId);
  if (v) v.currentMileage = mileage;
  persist();
  sync('saveVehicle', { vehicle: { id: vehicleId, currentMileage: mileage } }, applyVehicleResult);
}

// 一併刪除該車的保養項目與紀錄
export function deleteVehicle(vehicleId) {
  appState.vehicles = appState.vehicles.filter(item => item.id !== vehicleId);
  appState.maintenanceItems = appState.maintenanceItems.filter(item => item.vehicleId !== vehicleId);
  appState.records = appState.records.filter(item => item.vehicleId !== vehicleId);
  appState.currentVehicleId = appState.vehicles.length > 0 ? appState.vehicles[0].id : null;
  persist();
  sync('deleteVehicle', { id: vehicleId });
}

// --- 保養項目 ---
export function getItems(vehicleId) {
  return appState.maintenanceItems.filter(item => item.vehicleId === vehicleId);
}

export function getItem(itemId) {
  return appState.maintenanceItems.find(it => it.id === itemId);
}

export function saveItem(data) {
  let item;
  if (data.id) {
    item = getItem(data.id);
    if (item) Object.assign(item, data);
  } else {
    item = { ...data, id: newId('item') };
    appState.maintenanceItems.push(item);
  }
  persist();
  sync('saveItem', { item }, res => replaceById(appState.maintenanceItems, res.item));
  return item;
}

export function deleteItem(itemId) {
  appState.maintenanceItems = appState.maintenanceItems.filter(it => it.id !== itemId);
  persist();
  sync('deleteItem', { id: itemId });
}

// --- 用車紀錄 ---
export function getRecords(vehicleId) {
  return appState.records.filter(r => r.vehicleId === vehicleId);
}

export function getRecord(recordId) {
  return appState.records.find(r => r.id === recordId);
}

function applyRecordResult(res) {
  replaceById(appState.records, res.record);
  if (res.vehicle) replaceById(appState.vehicles, res.vehicle);
  mergeItems(res.items);
}

// 新增紀錄時：里程較高則更新車輛里程；保養紀錄重設勾選項目的上次里程與日期
function isNewerChange(rec, item) {
  if (!item.lastDate) return true;
  const recDate = String(rec.date);
  const itemDate = String(item.lastDate);
  return recDate > itemDate || (recDate === itemDate && Number(rec.mileage) >= Number(item.lastKm || 0));
}

export function saveRecord(data) {
  if (data.id) {
    const rec = getRecord(data.id);
    if (rec) Object.assign(rec, data);
    persist();
    sync('saveRecord', { record: rec }, applyRecordResult);
    return rec;
  }

  const rec = { ...data, id: newId('rec') };
  appState.records.push(rec);

  const v = appState.vehicles.find(item => item.id === rec.vehicleId);
  if (v && rec.mileage > v.currentMileage) {
    v.currentMileage = rec.mileage;
  }

  // 補登較舊的紀錄時不覆蓋項目較新的上次更換（與後台 isNewerChange_ 相同規則）
  const itemIds = rec.type === 'maintenance' && rec.details ? rec.details.itemIds || [] : [];
  itemIds.forEach(itemId => {
    const mItem = getItem(itemId);
    if (mItem && isNewerChange(rec, mItem)) {
      mItem.lastKm = rec.mileage;
      mItem.lastDate = rec.date;
    }
  });

  persist();
  sync('saveRecord', { record: rec }, applyRecordResult);
  return rec;
}

export function deleteRecord(recordId) {
  appState.records = appState.records.filter(r => r.id !== recordId);
  persist();
  sync('deleteRecord', { id: recordId }, res => mergeItems(res.items));
}

// --- 備份 ---
export function exportData() {
  return appState;
}

export function isValidBackup(data) {
  return !!(data && data.vehicles && data.maintenanceItems && data.records)
    && !(data.schemaVersion > SCHEMA_VERSION);
}

// 雲端模式會以 data 取代登入者在雲端的所有資料（等待後台完成）
export async function importData(data) {
  if (isCloudMode) {
    await syncQueue;
    await api.call('importAll', { data: migrate(data) });
    await reloadFromCloud();
    return;
  }
  appState = migrate(data);
  persist();
}

// 附加匯入（例如從愛車99 轉換的資料）：不刪除既有資料，id 重新產生避免衝突
export async function appendData(data) {
  if (isCloudMode) {
    await syncQueue;
    const result = await api.call('importAll', { data: migrate(data), append: true });
    await reloadFromCloud();
    return result;
  }
  const vehicleIds = {};
  const itemIds = {};
  data.vehicles.forEach(v => {
    vehicleIds[v.id] = newId('v');
    appState.vehicles.push({ ...v, id: vehicleIds[v.id] });
  });
  data.maintenanceItems.filter(it => vehicleIds[it.vehicleId]).forEach(it => {
    itemIds[it.id] = newId('item');
    appState.maintenanceItems.push({ ...it, id: itemIds[it.id], vehicleId: vehicleIds[it.vehicleId] });
  });
  data.records.filter(r => vehicleIds[r.vehicleId]).forEach(r => {
    const details = { ...(r.details || {}) };
    if (details.itemIds) details.itemIds = details.itemIds.map(id => itemIds[id]).filter(Boolean);
    if (details.parts) details.parts = details.parts.map(({ itemId, ...p }) => (itemIds[itemId] ? { ...p, itemId: itemIds[itemId] } : p));
    appState.records.push({ ...r, id: newId('rec'), vehicleId: vehicleIds[r.vehicleId], details });
  });
  if (!appState.currentVehicleId && appState.vehicles.length) appState.currentVehicleId = appState.vehicles[0].id;
  persist();
  return { vehicles: data.vehicles.length, maintenanceItems: Object.keys(itemIds).length, records: data.records.length };
}

export function resetToSample() {
  return importData(cloneInitialState());
}

// --- 本機模式資料上傳到雲端 ---
const LOCAL_UPLOADED_KEY = 'cartracker_db_v1_uploaded';
const LOCAL_UPLOAD_DISMISSED_KEY = 'cartracker_local_upload_dismissed';

// 尚未上傳、也沒有被略過的本機模式資料；沒有則回傳 null
export function getPendingLocalData() {
  try {
    if (localStorage.getItem(LOCAL_UPLOAD_DISMISSED_KEY)) return null;
  } catch (e) {
    return null;
  }
  const data = readStorage(LOCAL_STORAGE_KEY);
  return data && data.vehicles && data.vehicles.length > 0 ? data : null;
}

export function dismissLocalUpload() {
  try {
    localStorage.setItem(LOCAL_UPLOAD_DISMISSED_KEY, '1');
  } catch (e) { /* 忽略 */ }
}

// 合併上傳（不刪除雲端既有資料），成功後本機資料改名保留一份備份，避免重複上傳
export async function uploadLocalData(data) {
  await syncQueue;
  const result = await api.call('importAll', { data: migrate(data), append: true });
  try {
    localStorage.setItem(LOCAL_UPLOADED_KEY, localStorage.getItem(LOCAL_STORAGE_KEY));
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (e) { /* 忽略 */ }
  await reloadFromCloud();
  return result;
}

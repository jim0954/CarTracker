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

// 依序送出，確保「新增車輛」一定早於「新增該車的紀錄」
function sync(action, payload, applyResult) {
  if (!isCloudMode) return;
  pendingCount++;
  syncError = false;
  notifySync();
  syncQueue = syncQueue
    .then(() => api.call(action, payload))
    .then(result => {
      if (applyResult && result) {
        applyResult(result);
        persist();
        notifyChange();
      }
    })
    .catch(err => {
      syncError = true;
      errorHandler(err);
      if (!api.AUTH_ERROR_CODES.includes(err.code)) return reloadFromCloud().catch(() => {});
    })
    .finally(() => {
      pendingCount--;
      notifySync();
    });
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
  const cached = readStorage(storageKey);
  appState = cached || emptyState();
  return !!cached;
}

// 從雲端取得最新資料（保留目前選擇的車輛）
export async function reloadFromCloud() {
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

  const itemIds = rec.type === 'maintenance' && rec.details ? rec.details.itemIds || [] : [];
  itemIds.forEach(itemId => {
    const mItem = getItem(itemId);
    if (mItem) {
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

export function resetToSample() {
  return importData(cloneInitialState());
}

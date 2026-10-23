// --- 資料存取層 ---
// 畫面與事件處理只透過這裡讀寫資料；之後改接雲端後台時只需修改此檔。
import { INITIAL_STATE } from './sample-data.js';
import { showToast } from './utils.js';

const DEFAULT_STORAGE_KEY = 'cartracker_db_v1';
const LEGACY_STORAGE_KEY = 'autocare99_pro_db_v1';

let appState = null;

function cloneInitialState() {
  return JSON.parse(JSON.stringify(INITIAL_STATE));
}

function persist() {
  try {
    localStorage.setItem(DEFAULT_STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
    showToast('儲存失敗：本機儲存空間不足或已受限', 'error');
  }
}

function newId(prefix) {
  return `${prefix}_${Date.now()}`;
}

// --- 載入 ---
export function load() {
  try {
    // 搬移舊版儲存鍵的資料
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy && !localStorage.getItem(DEFAULT_STORAGE_KEY)) {
      localStorage.setItem(DEFAULT_STORAGE_KEY, legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    const json = localStorage.getItem(DEFAULT_STORAGE_KEY);
    if (json) {
      appState = JSON.parse(json);
    } else {
      appState = cloneInitialState();
      persist();
    }
  } catch (e) {
    console.warn('LocalStorage error, fallback to initial state', e);
    appState = cloneInitialState();
  }
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

// data 有 id 時更新，否則新增並切換為目前車輛
export function saveVehicle(data) {
  if (data.id) {
    const v = appState.vehicles.find(item => item.id === data.id);
    if (v) Object.assign(v, data);
    persist();
    return v;
  }
  const v = { ...data, id: newId('v'), initialMileage: data.currentMileage };
  appState.vehicles.push(v);
  appState.currentVehicleId = v.id;
  persist();
  return v;
}

export function updateMileage(vehicleId, mileage) {
  const v = appState.vehicles.find(item => item.id === vehicleId);
  if (v) v.currentMileage = mileage;
  persist();
}

// 一併刪除該車的保養項目與紀錄
export function deleteVehicle(vehicleId) {
  appState.vehicles = appState.vehicles.filter(item => item.id !== vehicleId);
  appState.maintenanceItems = appState.maintenanceItems.filter(item => item.vehicleId !== vehicleId);
  appState.records = appState.records.filter(item => item.vehicleId !== vehicleId);
  if (appState.vehicles.length > 0) {
    appState.currentVehicleId = appState.vehicles[0].id;
  }
  persist();
}

// --- 保養項目 ---
export function getItems(vehicleId) {
  return appState.maintenanceItems.filter(item => item.vehicleId === vehicleId);
}

export function getItem(itemId) {
  return appState.maintenanceItems.find(it => it.id === itemId);
}

export function saveItem(data) {
  if (data.id) {
    const item = getItem(data.id);
    if (item) Object.assign(item, data);
    persist();
    return item;
  }
  const item = { ...data, id: newId('item') };
  appState.maintenanceItems.push(item);
  persist();
  return item;
}

export function deleteItem(itemId) {
  appState.maintenanceItems = appState.maintenanceItems.filter(it => it.id !== itemId);
  persist();
}

// --- 用車紀錄 ---
export function getRecords(vehicleId) {
  return appState.records.filter(r => r.vehicleId === vehicleId);
}

export function getRecord(recordId) {
  return appState.records.find(r => r.id === recordId);
}

// 新增紀錄時：里程較高則更新車輛里程；保養紀錄重設勾選項目的上次里程與日期
export function saveRecord(data) {
  if (data.id) {
    const rec = getRecord(data.id);
    if (rec) Object.assign(rec, data);
    persist();
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
  return rec;
}

export function deleteRecord(recordId) {
  appState.records = appState.records.filter(r => r.id !== recordId);
  persist();
}

// --- 備份 ---
export function exportData() {
  return appState;
}

export function isValidBackup(data) {
  return !!(data && data.vehicles && data.maintenanceItems && data.records);
}

export function importData(data) {
  appState = data;
  persist();
}

export function resetToSample() {
  appState = cloneInitialState();
  persist();
}

// --- 狀態與本機儲存 ---
import { INITIAL_STATE } from './sample-data.js';
import { showToast } from './utils.js';

const DEFAULT_STORAGE_KEY = 'cartracker_db_v1';
const LEGACY_STORAGE_KEY = 'autocare99_pro_db_v1';

export let appState = null;

export function setAppState(next) {
  appState = next;
}

export function cloneInitialState() {
  return JSON.parse(JSON.stringify(INITIAL_STATE));
}

export function loadState() {
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
      saveState();
    }
  } catch (e) {
    console.warn('LocalStorage error, fallback to initial state', e);
    appState = cloneInitialState();
  }
}

export function saveState() {
  try {
    localStorage.setItem(DEFAULT_STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
    showToast('儲存失敗：本機儲存空間不足或已受限', 'error');
  }
}

export function getCurrentVehicle() {
  let vehicle = appState.vehicles.find(v => v.id === appState.currentVehicleId);
  if (!vehicle && appState.vehicles.length > 0) {
    vehicle = appState.vehicles[0];
    appState.currentVehicleId = vehicle.id;
  }
  return vehicle;
}

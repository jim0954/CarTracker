// --- 預設示範資料 ---

export const INITIAL_STATE = {
  currentVehicleId: 'v1',
  vehicles: [
    {
      id: 'v1',
      name: 'SYM DRG BT 158',
      plate: 'MBQ-8899',
      type: 'moto',
      year: 2023,
      currentMileage: 12850,
      initialMileage: 0,
      notes: '主要通勤代步車 • 順暢耐操'
    },
    {
      id: 'v2',
      name: 'Toyota RAV4 2.0 尊爵',
      plate: 'BLM-6688',
      type: 'car',
      year: 2022,
      currentMileage: 45200,
      initialMileage: 0,
      notes: '家庭出遊休旅車 • 原廠保固中'
    }
  ],
  maintenanceItems: [
    // v1 (機車)
    { id: 'm1', vehicleId: 'v1', name: '機油更換', intervalKm: 1000, intervalMonths: 3, lastKm: 12000, lastDate: '2026-09-15', notes: '建議 10W-40 或 5W-40，容量約 800cc' },
    { id: 'm2', vehicleId: 'v1', name: '齒輪油更換', intervalKm: 2000, intervalMonths: 6, lastKm: 12000, lastDate: '2026-09-15', notes: '85W-140 或 原廠專用齒輪油' },
    { id: 'm3', vehicleId: 'v1', name: '空氣濾網 (空濾)', intervalKm: 5000, intervalMonths: 12, lastKm: 10000, lastDate: '2026-05-10', notes: '原廠空濾紙芯，維持引擎進氣順暢' },
    { id: 'm4', vehicleId: 'v1', name: '火星塞檢查/更換', intervalKm: 10000, intervalMonths: 18, lastKm: 10000, lastDate: '2026-05-10', notes: 'NGK CPR8EA-9 銥合金火星塞' },
    { id: 'm5', vehicleId: 'v1', name: '前後煞車皮與煞車油', intervalKm: 10000, intervalMonths: 18, lastKm: 10000, lastDate: '2026-05-10', notes: 'DOT4 煞車油，來令片厚度檢視' },
    { id: 'm6', vehicleId: 'v1', name: '水箱精 / 冷卻液', intervalKm: 10000, intervalMonths: 12, lastKm: 0, lastDate: '2023-08-01', notes: '水冷車系必備！原廠乙二醇冷卻液 (已逾期)' },
    { id: 'm7', vehicleId: 'v1', name: '傳動皮帶 / 普利珠', intervalKm: 15000, intervalMonths: 24, lastKm: 0, lastDate: '2023-08-01', notes: '每 1.5 萬公里檢查或更換避免斷皮帶' },
    { id: 'm8', vehicleId: 'v1', name: '前後輪胎 (胎紋檢查)', intervalKm: 10000, intervalMonths: 18, lastKm: 6000, lastDate: '2025-11-20', notes: '安全線磨損指標檢查' },
    // v2 (汽車)
    { id: 'm201', vehicleId: 'v2', name: '機油與機油芯', intervalKm: 10000, intervalMonths: 6, lastKm: 40000, lastDate: '2026-04-12', notes: '0W-20 全合成機油 + 原廠機油濾芯' },
    { id: 'm202', vehicleId: 'v2', name: '冷氣濾網 & 空氣芯', intervalKm: 20000, intervalMonths: 12, lastKm: 40000, lastDate: '2026-04-12', notes: 'PM2.5 活性碳冷氣濾網' },
    { id: 'm203', vehicleId: 'v2', name: '變速箱油 (CVT)', intervalKm: 40000, intervalMonths: 24, lastKm: 40000, lastDate: '2026-04-12', notes: 'CVT FE 專用油' },
    { id: 'm204', vehicleId: 'v2', name: '四輪煞車油', intervalKm: 40000, intervalMonths: 24, lastKm: 40000, lastDate: '2026-04-12', notes: '含循環更換' }
  ],
  records: [
    // v1 (DRG) Records
    { id: 'r1', vehicleId: 'v1', date: '2026-10-18', mileage: 12800, type: 'fuel', title: '加滿 95 無鉛汽油', amount: 195, vendor: '中油新中和站', notes: '跳停', details: { liters: 6.2, pricePerLiter: 31.45, isFullTank: true } },
    { id: 'r2', vehicleId: 'v1', date: '2026-10-02', mileage: 12560, type: 'fuel', title: '加滿 95 無鉛汽油', amount: 190, vendor: '中油新中和站', notes: '跳停', details: { liters: 6.0, pricePerLiter: 31.6, isFullTank: true } },
    { id: 'r3', vehicleId: 'v1', date: '2026-09-15', mileage: 12000, type: 'maintenance', title: '12,000 km 定期保養', amount: 450, vendor: 'SYM 益民車業', notes: '賽克隆 10W-40 + 齒輪油', details: { itemIds: ['m1', 'm2'] } },
    { id: 'r4', vehicleId: 'v1', date: '2026-09-12', mileage: 11980, type: 'fuel', title: '加滿 95 無鉛汽油', amount: 185, vendor: '台塑台亞站', notes: '跳停', details: { liters: 5.9, pricePerLiter: 31.3, isFullTank: true } },
    { id: 'r5', vehicleId: 'v1', date: '2026-08-20', mileage: 11720, type: 'fuel', title: '加滿 95 無鉛汽油', amount: 192, vendor: '中油新中和站', notes: '跳停', details: { liters: 6.1, pricePerLiter: 31.5, isFullTank: true } },
    { id: 'r6', vehicleId: 'v1', date: '2026-05-10', mileage: 10000, type: 'maintenance', title: '10,000 km 大保養', amount: 2400, vendor: 'SYM 益民車業', notes: '機油、空濾、火星塞、煞車油更換', details: { itemIds: ['m1', 'm3', 'm4', 'm5'] } },
    { id: 'r7', vehicleId: 'v1', date: '2026-01-15', mileage: 8200, type: 'other', title: '安裝行車記錄器', amount: 3500, vendor: '小港二輪工房', notes: '前後雙鏡頭 FHD', details: {} },
    // v2 (RAV4) Records
    { id: 'r201', vehicleId: 'v2', date: '2026-10-15', mileage: 45000, type: 'fuel', title: '加滿 95 無鉛汽油', amount: 1550, vendor: '中油直營站', notes: '跳停', details: { liters: 49.2, pricePerLiter: 31.5, isFullTank: true } },
    { id: 'r202', vehicleId: 'v2', date: '2026-04-12', mileage: 40000, type: 'maintenance', title: '40,000 km 原廠定保', amount: 6800, vendor: 'Toyota 國都中和廠', notes: '換機油、機油芯、CVT變速箱油、煞車油', details: { itemIds: ['m201', 'm202', 'm203', 'm204'] } }
  ]
};

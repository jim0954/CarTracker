// 保養明細測試：node tests/web/parts.test.mjs
import assert from 'node:assert';
import { recordParts } from '../../js/parts.js';

// 有明細直接使用
const withParts = { type: 'maintenance', title: '機油', notes: '好', details: { parts: [{ name: '機油', spec: '', price: 250 }] } };
assert.deepStrictEqual(recordParts(withParts), { parts: withParts.details.parts, notes: '好' });

// 舊版愛車99 匯入：標題以「、」分隔，備註以「；」分隔，最後多出的段落保留為備註
const legacy = {
  type: 'maintenance',
  title: '前碟盤、機油、齒輪油',
  notes: '前碟盤 副廠 $1800 (2000九折\n刮傷了)；機油 車行 10W40 $225；齒輪油 車行；老闆送贈品',
  details: { itemIds: [] }
};
assert.deepStrictEqual(recordParts(legacy), {
  parts: [
    { name: '前碟盤', spec: '副廠 (2000九折 刮傷了)', price: 1800 },
    { name: '機油', spec: '車行 10W40', price: 225 },
    { name: '齒輪油', spec: '車行', price: 0 }
  ],
  notes: '老闆送贈品'
});
assert.deepStrictEqual(recordParts({ type: 'maintenance', title: '火星塞', notes: '火星塞 $150×2', details: {} }).parts,
  [{ name: '火星塞', spec: '', price: 300 }]);

// 對不上就維持原樣
const manual = { type: 'maintenance', title: '良祐車業', notes: '換機油', details: {} };
assert.deepStrictEqual(recordParts(manual), { parts: [], notes: '換機油' });
assert.deepStrictEqual(recordParts({ type: 'fuel', title: '加油', notes: '', details: {} }), { parts: [], notes: '' });

console.log('parts tests passed');

// 執行所有 GAS 單元測試：node tests/gas/run.js
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort();
let failed = 0;
files.forEach(f => {
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    process.stdout.write(out);
  } catch (err) {
    failed++;
    console.error(`✗ ${f}\n${err.stdout || ''}${err.stderr || ''}`);
  }
});
console.log(failed ? `${failed} 個測試檔失敗` : `全部 ${files.length} 個測試檔通過`);
process.exit(failed ? 1 : 0);

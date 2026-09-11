'use strict';
/* win-region: Windows 胶囊裁剪模块存在性与导出 */
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

let fail = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name); if (!cond) fail++; };

const src = fs.readFileSync(path.join(ROOT, 'lib/win-region.js'), 'utf8');
check('导出 applyCapsuleRegion', /exports\.applyCapsuleRegion|applyCapsuleRegion/.test(src) && /module\.exports/.test(src));
check('导出 clearWindowRegion', /clearWindowRegion/.test(src));
check('使用 CreateRoundRectRgn', /CreateRoundRectRgn/.test(src));
check('使用 SetWindowRgn', /SetWindowRgn/.test(src));

const main = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
check('隐身结束时 syncStealthRegion', /syncStealthRegion\(\)/.test(main));
check('退出隐身时 resetWindowRegion', /resetWindowRegion\(\)/.test(main));

if (process.platform === 'win32') {
  const { applyCapsuleRegion, clearWindowRegion } = require('../lib/win-region');
  check('模块可加载', typeof applyCapsuleRegion === 'function' && typeof clearWindowRegion === 'function');
}

console.log(fail === 0 ? '\n===== 全部通过 =====' : '\n===== 存在 ' + fail + ' 个失败 =====');
process.exit(fail === 0 ? 0 : 1);

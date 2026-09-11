'use strict';
/* 静态断言: 详情命令文本可选中复制, 全局禁选保留(保护桌宠交互) */
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

let fail = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name); if (!cond) fail++; };

const css = fs.readFileSync(path.join(ROOT, 'renderer/css/style.css'), 'utf8');

check('body 全局禁选保留', /(^|\n)body\s*\{[^}]*user-select:\s*none/.test(css));
check('隐身条为胶囊圆角', /#stealth-bar\s*\{[^}]*border-radius:\s*999px/.test(css));
check('隐身条有霓虹描边', /#stealth-bar\s*\{[^}]*border:\s*1px solid rgba\(0,\s*255,\s*136/.test(css));
check('隐身外发光贴合圆角(drop-shadow)', /#stealth-bar\s*\{[^}]*filter:\s*drop-shadow/.test(css));
check('隐身不用矩形外发光 box-shadow', !/#stealth-bar\s*\{[^}]*box-shadow:\s*0\s+0\s+\d+px/.test(css));

const allowIdx = css.indexOf('.detail-col, .detail-col *');
const allowBlock = allowIdx >= 0 ? css.slice(allowIdx, css.indexOf('}', allowIdx)) : '';
check('详情列放开选中(.detail-col, .detail-col * 存在)', allowIdx >= 0);
check('放开规则含 user-select: text', /-webkit-user-select:\s*text[^;}]*;\s*user-select:\s*text/.test(allowBlock));

console.log(fail === 0 ? '\n===== 全部通过 =====' : '\n===== 存在 ' + fail + ' 个失败 =====');
process.exit(fail === 0 ? 0 : 1);

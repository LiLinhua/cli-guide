'use strict';
const path = require('path');
const { validateCommand } = require('../lib/commands');
const ROOT = path.join(__dirname, '..');

let fail = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name); if (!cond) fail++; };

/* ---- 校验函数 ---- */
check('缺 id 报错', validateCommand({ cmd: 'ls', cat: 'linux', desc: 'x' }).length > 0);
check('缺 cmd 报错', validateCommand({ id: 'a', cat: 'linux', desc: 'x' }).length > 0);
check('非法 cat 报错', validateCommand({ id: 'a', cmd: 'ls', cat: 'nope', desc: 'x' }).length > 0);
check('缺 examples 报错', validateCommand({ id: 'a', cmd: 'ls', cat: 'linux', desc: 'x', syntax: 'ls', args: [], tags: [] }).length > 0);
check('合法条目零错误', validateCommand({
  id: 'ls', cmd: 'ls', cat: 'linux', desc: '列出目录内容',
  syntax: 'ls [-la] [path]', args: [{ name: '-l', desc: '长格式' }],
  examples: [{ cmd: 'ls -la', comment: '查看详细列表' }], tags: ['目录']
}).length === 0);

/* ---- 内置库完整性 ---- */
const { loadBuiltinCommands } = require('../lib/commands');
const all = loadBuiltinCommands(ROOT);
check('六个分类文件都存在', ['linux', 'k8s', 'helm', 'vim', 'terminal', 'office'].every(c => all.some(x => x.cat === c)));
check('命令总数 >= 300', all.length >= 300);
const ids = new Set();
let dup = 0;
for (const c of all) { if (ids.has(c.id)) dup++; ids.add(c.id); }
check('id 全局唯一', dup === 0);
const invalid = all.filter(c => validateCommand(c).length > 0);
check('所有命令通过校验', invalid.length === 0);

console.log(fail === 0 ? '\n===== 全部通过 =====' : '\n===== 存在 ' + fail + ' 个失败 =====');
process.exit(fail === 0 ? 0 : 1);

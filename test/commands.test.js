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
check('十三个分类文件都存在', ['linux', 'k8s', 'helm', 'vim', 'terminal', 'office', 'docker', 'kafka', 'mysql', 'postgres', 'redis', 'vscode', 'idea'].every(c => all.some(x => x.cat === c)));
check('命令总数 >= 500', all.length >= 500);
const ids = new Set();
let dup = 0;
for (const c of all) { if (ids.has(c.id)) dup++; ids.add(c.id); }
check('id 全局唯一', dup === 0);
const invalid = all.filter(c => validateCommand(c).length > 0);
check('所有命令通过校验', invalid.length === 0);

/* ---- 用户扩展合并 ---- */
const fs = require('fs');
const os = require('os');
const { loadUserCommands, mergeCommands } = require('../lib/commands');

// 临时用户目录: 1 个覆盖内置 + 1 个新增 + 1 个非法 JSON
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-guide-test-'));
fs.writeFileSync(path.join(tmpDir, 'user.json'), JSON.stringify([
  { id: 'ls', cmd: 'ls', cat: 'linux', desc: '用户改写的 ls 描述', syntax: 'ls', args: [], examples: [{ cmd: 'ls', comment: 'x' }], tags: [] },
  { id: 'my-own', cmd: 'mycmd', cat: 'linux', desc: '用户自定义', syntax: 'mycmd', args: [], examples: [{ cmd: 'mycmd', comment: 'x' }], tags: [] }
]));
fs.writeFileSync(path.join(tmpDir, 'broken.json'), '{ not valid json');

const merged = mergeCommands(all, loadUserCommands(tmpDir));
check('用户新增命令生效', merged.some(x => x.id === 'my-own'));
check('用户覆盖内置(id 相同取用户版)', merged.find(x => x.id === 'ls').desc === '用户改写的 ls 描述');
check('非法 JSON 文件被跳过不崩溃', merged.length === all.length + 1);
check('合并后无重复 id', new Set(merged.map(x => x.id)).size === merged.length);

console.log(fail === 0 ? '\n===== 全部通过 =====' : '\n===== 存在 ' + fail + ' 个失败 =====');
process.exit(fail === 0 ? 0 : 1);

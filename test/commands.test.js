'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const ROOT = path.join(__dirname, '..');
const {
  validateCommand, validateFileMeta, parseCommandFile,
  loadBuiltinCommands, loadUserCommands, mergeCommands, mergeCategories
} = require('../lib/commands');

let fail = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name); if (!cond) fail++; };

/* ---- validateCommand: cat 只要求非空 ---- */
check('缺 id 报错', validateCommand({ cmd: 'ls', cat: 'linux', desc: 'x' }).length > 0);
check('缺 cmd 报错', validateCommand({ id: 'a', cat: 'linux', desc: 'x' }).length > 0);
check('空 cat 报错', validateCommand({ id: 'a', cmd: 'ls', cat: '', desc: 'x' }).length > 0);
check('新 cat 值不再报错', validateCommand({ id: 'a', cmd: 'ls', cat: 'mynewcat', desc: 'x', syntax: 'ls', args: [], examples: [], tags: [] }).length === 0);
check('缺 examples 报错', validateCommand({ id: 'a', cmd: 'ls', cat: 'linux', desc: 'x', syntax: 'ls', args: [], tags: [] }).length > 0);
check('合法条目零错误', validateCommand({
  id: 'ls', cmd: 'ls', cat: 'linux', desc: '列出目录内容',
  syntax: 'ls [-la] [path]', args: [{ name: '-l', desc: '长格式' }],
  examples: [{ cmd: 'ls -la', comment: '查看详细列表' }], tags: ['目录']
}).length === 0);

/* ---- parseCommandFile: 双格式归一化 ---- */
const arr = [{ id: 'a', cat: 'x' }];
const old1 = parseCommandFile(arr, 'a.json');
check('旧格式(数组) meta 为 null', old1.meta === null && old1.commands === arr);
const new1 = parseCommandFile({ cat: 'x', label: 'X 命令', order: 3, commands: arr }, 'b.json');
check('新格式(对象) 提取 meta', !!new1.meta && new1.meta.cat === 'x' && new1.meta.label === 'X 命令' && new1.meta.order === 3 && new1.meta.file === 'b.json' && new1.commands === arr);
check('parseCommandFile null 输入降级', JSON.stringify(parseCommandFile(null, 'n.json')) === '{"meta":null,"commands":[]}');
check('parseCommandFile 缺省 file 为 null', parseCommandFile({ cat: 'x' }).meta.file === null);
check('新格式缺 commands 降级为空数组', parseCommandFile({ cat: 'x' }, 'c.json').commands.length === 0);

/* ---- validateFileMeta ---- */
check('meta null 通过', validateFileMeta(null, []).length === 0);
check('meta 缺 cat 报错', validateFileMeta({ label: 'x' }, []).length > 0);
check('meta label 类型错报错', validateFileMeta({ cat: 'x', label: 1 }, []).length > 0);
check('meta order 类型错报错', validateFileMeta({ cat: 'x', order: '1' }, []).length > 0);
check('meta order NaN 报错', validateFileMeta({ cat: 'x', order: NaN }, []).length > 0);
check('命令 cat 与 meta 不一致报错', validateFileMeta({ cat: 'x' }, [{ id: 'a', cat: 'y' }]).length > 0);
check('合法 meta 零错误', validateFileMeta({ cat: 'x', label: 'X', order: 1 }, [{ id: 'a', cat: 'x' }]).length === 0);
check('meta 数字 0 不再直通', validateFileMeta(0, []).length > 0);
check('数组含 null 元素报错', validateFileMeta({ cat: 'x' }, [null]).length > 0);
check('null 元素不屏蔽后续不一致', validateFileMeta({ cat: 'x' }, [null, { id: 'a', cat: 'y' }]).length === 2);

/* ---- 内置库完整性(动态收集, 无硬编码白名单) ---- */
const builtin = loadBuiltinCommands(ROOT);
const all = builtin.commands;
check('命令总数 >= 500', all.length >= 500);
check('内置 meta 覆盖 13 个分类文件', builtin.categories.length === 13);
const legalCats = new Set(builtin.categories.map(m => m.cat));
const ids = new Set();
let dup = 0;
for (const c of all) { if (ids.has(c.id)) dup++; ids.add(c.id); }
check('id 全局唯一', dup === 0);
const invalid = all.filter(c => validateCommand(c).length > 0);
check('所有命令通过校验', invalid.length === 0);
check('所有命令 cat 都有 meta 声明', all.every(c => legalCats.has(c.cat)));
check('内置 13 类 order 为 1-13', builtin.categories.every(m => Number.isInteger(m.order) && m.order >= 1 && m.order <= 13));

/* ---- mergeCategories: 排序 + 覆盖 + 兜底 ---- */
const cats = mergeCategories(
  [{ cat: 'b', label: 'B', order: 2, file: 'b.json' }, { cat: 'a', label: 'A', order: 1, file: 'a.json' }, { cat: 'z', label: 'Zed', file: 'z.json' }],
  [{ cat: 'b', label: 'B 用户版', order: 2, file: 'b.json' }],
  [{ cat: 'b' }, { cat: 'm' }]
);
check('order 升序在前', cats[0].key === 'a' && cats[1].key === 'b');
check('同 key 用户 label 覆盖内置', cats[1].label === 'B 用户版');
check('无 order 按字母序追加', cats[2].key === 'm' && cats[3].key === 'z');
check('未声明 cat 兜底 label=key', cats[2].label === 'm');

/* ---- 用户目录扩展: 新分类文件 / 非法 JSON / 非法 meta ---- */
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-guide-test-'));
fs.writeFileSync(path.join(tmpDir, 'user.json'), JSON.stringify([
  { id: 'ls', cmd: 'ls', cat: 'linux', desc: '用户改写的 ls 描述', syntax: 'ls', args: [], examples: [{ cmd: 'ls', comment: 'x' }], tags: [] },
  { id: 'my-own', cmd: 'mycmd', cat: 'git', desc: '用户自定义新分类', syntax: 'mycmd', args: [], examples: [{ cmd: 'mycmd', comment: 'x' }], tags: [] }
]));
fs.writeFileSync(path.join(tmpDir, 'broken.json'), '{ not valid json');
fs.writeFileSync(path.join(tmpDir, 'newcat.json'), JSON.stringify({
  cat: 'git', label: 'git 命令', commands: [
    { id: 'git-st', cmd: 'git status', cat: 'git', desc: '看状态', syntax: 'git status', args: [], examples: [{ cmd: 'git status', comment: 'x' }], tags: [] }
  ]
}));
fs.writeFileSync(path.join(tmpDir, 'badmeta.json'), JSON.stringify({
  label: '缺 cat', commands: [
    { id: 'bm', cmd: 'bm', cat: 'bmcat', desc: 'x', syntax: 'bm', args: [], examples: [], tags: [] }
  ]
}));

const user = loadUserCommands(tmpDir);
check('用户目录非法 JSON 跳过不崩溃', user.commands.length === 4);
check('用户新分类 meta 收集', user.categories.some(m => m.cat === 'git' && m.label === 'git 命令'));
check('非法 meta 降级为无 meta(命令保留)', user.categories.every(m => m.cat) && user.commands.some(c => c.id === 'bm'));

const merged = mergeCommands(all, user.commands);
check('用户新增命令生效', merged.some(x => x.id === 'my-own'));
check('用户覆盖内置(id 相同取用户版)', merged.find(x => x.id === 'ls').desc === '用户改写的 ls 描述');
check('合并后无重复 id', new Set(merged.map(x => x.id)).size === merged.length);

const mergedCats = mergeCategories(builtin.categories, user.categories, merged);
check('用户新分类出现在芯片列表', mergedCats.some(c => c.key === 'git' && c.label === 'git 命令'));
check('非法 meta 的 cat 走兜底', mergedCats.some(c => c.key === 'bmcat' && c.label === 'bmcat'));
check('内置 13 类仍在', mergedCats.filter(c => legalCats.has(c.key)).length === 13);

/* ---- 内置库 failFast: 坏 JSON 应抛错而非静默跳过 ---- */
const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-guide-builtin-'));
fs.mkdirSync(path.join(tmp2, 'resources', 'commands'), { recursive: true });
fs.writeFileSync(path.join(tmp2, 'resources', 'commands', 'broken.json'), '{ not valid');
fs.writeFileSync(path.join(tmp2, 'resources', 'commands', 'ok.json'), JSON.stringify([
  { id: 'ok-1', cmd: 'ok', cat: 'okcat', desc: 'x', syntax: 'ok', args: [], examples: [], tags: [] }
]));
let builtinThrew = false;
try { loadBuiltinCommands(tmp2); } catch (e) { builtinThrew = true; }
check('内置库坏 JSON 抛错(failFast)', builtinThrew);

fs.rmSync(tmpDir, { recursive: true, force: true });
fs.rmSync(tmp2, { recursive: true, force: true });

console.log(fail === 0 ? '\n===== 全部通过 =====' : '\n===== 存在 ' + fail + ' 个失败 =====');
process.exit(fail === 0 ? 0 : 1);

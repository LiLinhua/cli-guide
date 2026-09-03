# 分类元数据数据化管理 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 分类元数据（key/显示名/顺序）内嵌进命令 JSON 文件头部，新增分类 JSON 文件或修改内容后重启应用即自动加载，无需改代码。

**Architecture:** `lib/commands.js` 统一解析「包裹对象」格式（兼容旧纯数组），返回 `{ commands, categories }`；主进程 `mergeCategories` 排序后经 IPC 下发 `[{ key, label }]`；渲染层删除 `CAT_LABELS` 硬编码直接渲染；web 构建复用同一加载器注入 `window.__CATEGORIES__`。

**Tech Stack:** Electron (无框架渲染层)、纯 Node 无头测试（手写断言脚本）、Web 单文件构建脚本。

**规格文档:** `docs/superpowers/specs/2026-09-03-category-metadata-design.md`

---

## 重要约束（本仓库特有）

1. **禁止自动 git 提交**：用户要求所有改动由本人 review 后提交。每个任务的最后一步是「向用户报告 diff 摘要」，**不执行 `git commit`**。全部任务完成、用户 review 通过后，由用户决定提交方式。
2. 测试为纯 Node 脚本（无框架）：`npm test` 串联执行，单测直接 `node test/<file>.test.js`。
3. 中间态约定：Task 2 完成后、Task 3 迁移前，`test/commands.test.js` 中 3 条内置库断言**预期 FAIL**（内置数据尚未迁移），这是 TDD 的红阶段；Task 3 让其转绿。

## 文件结构总览

| 文件 | 动作 | 职责 |
|---|---|---|
| `lib/commands.js` | 修改 | 纯函数解析/校验/合并（parseCommandFile、validateFileMeta、loadCommandDir、mergeCategories）；移除 CATS |
| `resources/commands/*.json` × 13 | 修改 | 迁移为 `{ cat, label, order, commands }` 包裹格式 |
| `main.js` | 修改 | IPC `commands:load` 下发 `{ commands, categories }` |
| `renderer/js/panel.js` | 修改 | 删 CAT_LABELS；renderCats 入参 `[{ key, label }]` |
| `renderer/js/main.js` | 修改 | 解构新 IPC 返回 |
| `web/cli-guide-web.js` | 修改 | shim loadCommands 返回新结构 |
| `scripts/build-web.js` | 修改 | 改用 lib 加载器；注入 `__CATEGORIES__` |
| `test/commands.test.js` | 重写 | 动态收集 cat；双格式/合并/排序/兜底用例 |
| `test/panel.test.js` | 修改 | renderCats 新入参 |
| `test/smoke.test.js` | 修改 | loadCommands 桩返回新结构 |
| `test/build-web.test.js` | 修改 | `__CATEGORIES__` 内联断言 |
| `scripts/migrate-command-files.js` | 临时创建→删除 | 一次性数据迁移脚本 |

---

### Task 1: lib/commands.js 纯函数层（validateCommand 放宽 + parseCommandFile + validateFileMeta）

**Files:**
- Modify: `lib/commands.js:6-20,51`
- Test: `test/commands.test.js:10-18`

- [ ] **Step 1: 更新 validateCommand 用例（写失败测试）**

`test/commands.test.js` 第 12 行 `check('非法 cat 报错', ...)` 替换为两条，并在「校验函数」段之后（第 18 行后）追加 parseCommandFile/validateFileMeta 用例段：

```js
check('空 cat 报错', validateCommand({ id: 'a', cmd: 'ls', cat: '', desc: 'x' }).length > 0);
check('新 cat 值不再报错', validateCommand({ id: 'a', cmd: 'ls', cat: 'mynewcat', desc: 'x', syntax: 'ls', args: [], examples: [], tags: [] }).length === 0);
```

```js
/* ---- 双格式归一化与 meta 校验 ---- */
const { validateFileMeta, parseCommandFile } = require('../lib/commands');
const arr = [{ id: 'a', cat: 'x' }];
const old1 = parseCommandFile(arr, 'a.json');
check('旧格式(数组) meta 为 null', old1.meta === null && old1.commands === arr);
const new1 = parseCommandFile({ cat: 'x', label: 'X 命令', order: 3, commands: arr }, 'b.json');
check('新格式(对象) 提取 meta', !!new1.meta && new1.meta.cat === 'x' && new1.meta.label === 'X 命令' && new1.meta.order === 3 && new1.meta.file === 'b.json' && new1.commands === arr);
check('meta null 通过', validateFileMeta(null, []).length === 0);
check('meta 缺 cat 报错', validateFileMeta({ label: 'x' }, []).length > 0);
check('meta label 类型错报错', validateFileMeta({ cat: 'x', label: 1 }, []).length > 0);
check('meta order 类型错报错', validateFileMeta({ cat: 'x', order: '1' }, []).length > 0);
check('命令 cat 与 meta 不一致报错', validateFileMeta({ cat: 'x' }, [{ id: 'a', cat: 'y' }]).length > 0);
check('合法 meta 零错误', validateFileMeta({ cat: 'x', label: 'X', order: 1 }, [{ id: 'a', cat: 'x' }]).length === 0);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node test/commands.test.js`
Expected: FAIL — `validateFileMeta is not a function`（TypeError，进程退出码 1）

- [ ] **Step 3: 实现纯函数层**

`lib/commands.js` 全量替换为：

```js
'use strict';
/* 命令库: 校验 / 双格式解析 / 内置读取 / 用户合并 (纯 Node, 可无头测试) */
const fs = require('fs');
const path = require('path');

function validateCommand(c) {
  const errs = [];
  if (!c || typeof c !== 'object') return ['not an object'];
  if (typeof c.id !== 'string' || !c.id) errs.push('id required');
  if (typeof c.cmd !== 'string' || !c.cmd) errs.push('cmd required');
  if (typeof c.cat !== 'string' || !c.cat) errs.push('cat required');
  if (typeof c.desc !== 'string' || !c.desc) errs.push('desc required');
  if (typeof c.syntax !== 'string' || !c.syntax) errs.push('syntax required');
  if (!Array.isArray(c.args)) errs.push('args must be array');
  if (!Array.isArray(c.examples)) errs.push('examples must be array');
  if (!Array.isArray(c.tags)) errs.push('tags must be array');
  return errs;
}

/* 分类文件 meta 校验: meta 为 null(旧格式纯数组)直接通过 */
function validateFileMeta(meta, commands) {
  if (!meta) return [];
  const errs = [];
  if (typeof meta.cat !== 'string' || !meta.cat) errs.push('meta.cat required');
  if (meta.label !== undefined && typeof meta.label !== 'string') errs.push('meta.label must be string');
  if (meta.order !== undefined && typeof meta.order !== 'number') errs.push('meta.order must be number');
  const bad = commands.find(c => !c || c.cat !== meta.cat);
  if (bad) errs.push('cat mismatch: ' + (bad.id || '?') + ' cat=' + bad.cat);
  return errs;
}

/* 文件内容归一化: 旧格式(纯数组) => meta:null; 新格式(包裹对象) => 提取 meta */
function parseCommandFile(raw, file) {
  if (Array.isArray(raw)) return { meta: null, commands: raw };
  const cmds = Array.isArray(raw && raw.commands) ? raw.commands : [];
  return { meta: { cat: raw.cat, label: raw.label, order: raw.order, file: file || null }, commands: cmds };
}

function loadBuiltinCommands(rootDir) {
  const dir = path.join(rootDir, 'resources', 'commands');
  const out = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
    const list = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const item of list) out.push(item);
  }
  return out;
}

function loadUserCommands(userDir) {
  const out = [];
  if (!fs.existsSync(userDir)) return out;
  for (const f of fs.readdirSync(userDir).filter(x => x.endsWith('.json'))) {
    try {
      const list = JSON.parse(fs.readFileSync(path.join(userDir, f), 'utf8'));
      for (const item of list) out.push(item);
    } catch (e) { /* 跳过非法 JSON, 不阻塞启动 */ }
  }
  return out;
}

function mergeCommands(builtin, user) {
  const map = new Map();
  for (const c of builtin) map.set(c.id, c);
  for (const c of user) map.set(c.id, c); // 用户同名 id 覆盖内置
  return [...map.values()];
}

module.exports = { validateCommand, validateFileMeta, parseCommandFile, loadBuiltinCommands, loadUserCommands, mergeCommands };
```

注意：`CATS` 常量与导出已删除；`loadBuiltinCommands/loadUserCommands/mergeCommands` 本任务保持旧行为（返回扁平数组），Task 2 再升级。

- [ ] **Step 4: 运行测试确认通过**

Run: `node test/commands.test.js`
Expected: 全部 PASS，退出码 0（内置库此时仍是旧格式纯数组，`loadBuiltinCommands` 旧行为正常）

- [ ] **Step 5: 向用户报告 diff 摘要（不提交）**

---

### Task 2: lib/commands.js 加载层 + commands.test.js 重写 + smoke 桩/渲染入口同步

**Files:**
- Modify: `lib/commands.js`（loadCommandDir/loadBuiltinCommands/loadUserCommands/mergeCategories + exports）
- Rewrite: `test/commands.test.js`
- Modify: `test/smoke.test.js:56-60`、`renderer/js/main.js:47-53`

- [ ] **Step 1: 重写 test/commands.test.js（写失败测试）**

全量替换为：

```js
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

/* ---- validateFileMeta ---- */
check('meta null 通过', validateFileMeta(null, []).length === 0);
check('meta 缺 cat 报错', validateFileMeta({ label: 'x' }, []).length > 0);
check('meta label 类型错报错', validateFileMeta({ cat: 'x', label: 1 }, []).length > 0);
check('meta order 类型错报错', validateFileMeta({ cat: 'x', order: '1' }, []).length > 0);
check('命令 cat 与 meta 不一致报错', validateFileMeta({ cat: 'x' }, [{ id: 'a', cat: 'y' }]).length > 0);
check('合法 meta 零错误', validateFileMeta({ cat: 'x', label: 'X', order: 1 }, [{ id: 'a', cat: 'x' }]).length === 0);

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

console.log(fail === 0 ? '\n===== 全部通过 =====' : '\n===== 存在 ' + fail + ' 个失败 =====');
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 2: 运行测试确认预期失败**

Run: `node test/commands.test.js`
Expected: FAIL — 恰好 3 条：「内置 meta 覆盖 13 个分类文件」「所有命令 cat 都有 meta 声明」「内置 13 类 order 为 1-13」（内置数据尚未迁移）。其余全部 PASS。

- [ ] **Step 3: 实现加载层**

`lib/commands.js` 中，删除旧的 `loadBuiltinCommands` 与 `loadUserCommands`（Task 1 版本），替换为：

```js
/* 目录读取 => { commands, categories }; failFast 用于内置库(随包分发, 坏数据应启动即暴露) */
function loadCommandDir(dir, opts) {
  const failFast = !!(opts && opts.failFast);
  const out = { commands: [], categories: [] };
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort()) {
    const p = path.join(dir, f);
    let raw;
    try { raw = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) {
      if (failFast) throw e;
      console.warn('[cli-guide] 跳过非法 JSON: ' + p);
      continue;
    }
    const parsed = parseCommandFile(raw, f);
    if (parsed.meta && validateFileMeta(parsed.meta, parsed.commands).length > 0) {
      console.warn('[cli-guide] meta 非法, 按无 meta 处理: ' + f + ' -> ' + validateFileMeta(parsed.meta, parsed.commands).join('; '));
      out.commands.push(...parsed.commands);
      continue;
    }
    if (parsed.meta) out.categories.push(parsed.meta);
    out.commands.push(...parsed.commands);
  }
  return out;
}

function loadBuiltinCommands(rootDir) {
  return loadCommandDir(path.join(rootDir, 'resources', 'commands'), { failFast: true });
}

function loadUserCommands(userDir) {
  return loadCommandDir(userDir);
}

/* 分类 meta 合并: 同 key 用户覆盖内置; 命令中未声明的 cat 兜底;
 * 排序: 有 order 升序(同 order 按 key 字母序) -> 无 order 按 key 字母序 */
function mergeCategories(builtinCats, userCats, allCommands) {
  const map = new Map();
  for (const m of builtinCats) map.set(m.cat, m);
  for (const m of userCats) map.set(m.cat, m);
  for (const c of allCommands) {
    if (!map.has(c.cat)) map.set(c.cat, { cat: c.cat, label: undefined, order: undefined, file: null });
  }
  const list = [...map.values()].map(m => ({ key: m.cat, label: m.label || m.cat, order: m.order }));
  const ordered = list.filter(x => typeof x.order === 'number')
    .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  const rest = list.filter(x => typeof x.order !== 'number')
    .sort((a, b) => a.key.localeCompare(b.key));
  return ordered.concat(rest).map(x => ({ key: x.key, label: x.label }));
}
```

`module.exports` 行替换为：

```js
module.exports = { validateCommand, validateFileMeta, parseCommandFile, loadBuiltinCommands, loadUserCommands, mergeCommands, mergeCategories };
```

- [ ] **Step 4: 运行 commands 测试（仍为预期 3 FAIL）**

Run: `node test/commands.test.js`
Expected: 与 Step 2 相同的 3 条 FAIL，其余 PASS

- [ ] **Step 5: 同步 smoke 桩与渲染入口解构（保证 smoke 全绿）**

`test/smoke.test.js` 第 56-60 行的 `loadCommands` 桩替换为：

```js
  loadCommands: async () => {
    const { loadBuiltinCommands, mergeCategories } = require('../lib/commands');
    const { commands, categories } = loadBuiltinCommands(ROOT);
    return { commands, categories: mergeCategories(categories, [], commands) };
  },
```

`renderer/js/main.js` 第 47-53 行替换为：

```js
      const { commands, categories } = await window.cliGuide.loadCommands();
      this.allCommands = commands;
      window.CommandStore.setData(commands);
      this.panel.setData(commands);
      this.panel.renderCats(categories);
      this.applyFilter('');
```

（此时 `renderCats` 收到的是 `[{key,label}]`，旧实现会把 chip 文本渲染成 `[object Object]`——smoke 测试的 DOM 桩不断言芯片文案所以不影响；Task 5 修渲染。）

- [ ] **Step 6: 运行 smoke 与 panel 测试确认通过**

Run: `node test/smoke.test.js && node test/panel.test.js`
Expected: 两个文件全部 PASS（panel.test.js 仍传 key 数组给旧 renderCats，不受影响）

- [ ] **Step 7: 向用户报告 diff 摘要（不提交）**

---

### Task 3: 迁移 13 个内置 JSON 为包裹格式

**Files:**
- Create→Delete: `scripts/migrate-command-files.js`（一次性脚本，跑完删除）
- Modify: `resources/commands/*.json` × 13

- [ ] **Step 1: 创建一次性迁移脚本**

创建 `scripts/migrate-command-files.js`：

```js
'use strict';
/* 一次性迁移: resources/commands/*.json 纯数组 -> 包裹对象格式, 跑完即删 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ORDER = ['linux', 'k8s', 'helm', 'vim', 'terminal', 'office', 'docker', 'kafka', 'mysql', 'postgres', 'redis', 'vscode', 'idea'];
const LABELS = {
  linux: 'linux 命令', k8s: 'k8s 命令', helm: 'helm 命令', vim: 'vim 命令',
  terminal: '终端快捷键', office: '办公常用', docker: 'docker 命令', kafka: 'kafka 命令',
  mysql: 'mysql 命令', postgres: 'postgres 命令', redis: 'redis 命令',
  vscode: 'VSCode 快捷键', idea: 'IDEA 快捷键'
};
const dir = path.join(ROOT, 'resources', 'commands');
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort()) {
  const p = path.join(dir, f);
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!Array.isArray(raw)) { console.log('skip (already wrapped): ' + f); continue; }
  const cat = raw[0].cat;
  const out = { cat, label: LABELS[cat] || cat, order: ORDER.indexOf(cat) + 1, commands: raw };
  fs.writeFileSync(p, JSON.stringify(out, null, 2) + '\n');
  console.log('migrated: ' + f + ' (cat=' + cat + ', order=' + out.order + ', ' + raw.length + ' 条)');
}
```

- [ ] **Step 2: 运行迁移脚本**

Run: `node scripts/migrate-command-files.js`
Expected: 输出 13 行 `migrated: <file> (cat=..., order=1..13, ... 条)`，无 skip 行

- [ ] **Step 3: 删除迁移脚本**

Run: `rm scripts/migrate-command-files.js`

- [ ] **Step 4: 抽查迁移结果**

Run: `head -8 resources/commands/docker.json && node -e "const {loadBuiltinCommands}=require('./lib/commands'); const b=loadBuiltinCommands('.'); console.log(b.categories.map(c=>c.order+':'+c.key).join(' '))"`
Expected: 文件头为 `{ "cat": "docker", "label": "docker 命令", "order": 7, ...`；命令行输出 `1:linux 2:k8s 3:helm 4:vim 5:terminal 6:office 7:docker 8:kafka 9:mysql 10:postgres 11:redis 12:vscode 13:idea`

- [ ] **Step 5: 运行 commands 测试确认全绿**

Run: `node test/commands.test.js`
Expected: 全部 PASS（Task 2 的 3 条红断言转绿）

- [ ] **Step 6: 向用户报告 diff 摘要（不提交）**

---

### Task 4: main.js IPC 下发新结构

**Files:**
- Modify: `main.js:7,134-138`

- [ ] **Step 1: 更新 require 与 IPC handler**

`main.js` 第 7 行替换为：

```js
const { loadBuiltinCommands, loadUserCommands, mergeCommands, mergeCategories } = require('./lib/commands');
```

第 134-138 行的 handler 替换为：

```js
ipcMain.handle('commands:load', () => {
  ensureUserData();
  const builtin = loadBuiltinCommands(__dirname);
  const user = loadUserCommands(USER_CMDS_DIR);
  const commands = mergeCommands(builtin.commands, user.commands);
  const categories = mergeCategories(builtin.categories, user.categories, commands);
  return { commands, categories };
});
```

- [ ] **Step 2: 语法检查**

Run: `node --check main.js`
Expected: 无输出，退出码 0

- [ ] **Step 3: 向用户报告 diff 摘要（不提交）**

---

### Task 5: 渲染层去硬编码（panel.js + panel.test.js）

**Files:**
- Modify: `renderer/js/panel.js:4-10,61-72`
- Modify: `test/panel.test.js:86-94`

- [ ] **Step 1: 更新 panel.test.js 断言（写失败测试）**

第 86 行 `const CATS13 = [...]` 替换为：

```js
/* renderCats 契约: [{ key, label }], 顺序即展示顺序 */
const CATS13 = [
  { key: 'linux', label: 'linux 命令' }, { key: 'k8s', label: 'k8s 命令' },
  { key: 'helm', label: 'helm 命令' }, { key: 'vim', label: 'vim 命令' },
  { key: 'terminal', label: '终端快捷键' }, { key: 'office', label: '办公常用' },
  { key: 'docker', label: 'docker 命令' }, { key: 'kafka', label: 'kafka 命令' },
  { key: 'mysql', label: 'mysql 命令' }, { key: 'postgres', label: 'postgres 命令' },
  { key: 'redis', label: 'redis 命令' }, { key: 'vscode', label: 'VSCode 快捷键' },
  { key: 'idea', label: 'IDEA 快捷键' }
];
```

第 91 行 chip 文案断言替换为（label 直渲染、key 进 dataset、回调传 key）：

```js
check('chip 文案用 label', els['cat-bar'].children[6].textContent === 'docker 命令' && els['cat-bar'].children[11].textContent === 'VSCode 快捷键');
check('chip dataset 与回调传 key', els['cat-bar'].children[6].dataset.cat === 'docker' && catClicks.length === 0);
```

（原 `check('chip 文案正确', ...)` 删除；`chip 点击触发 onCategory` 断言保留不变，其后再补 `catClicks[0] === 'helm'` 已有。）

- [ ] **Step 2: 运行测试确认失败**

Run: `node test/panel.test.js`
Expected: FAIL — 「chip 文案用 label」（旧 renderCats 渲染 `[object Object]`），其余 PASS

- [ ] **Step 3: 实现 panel.js 改造**

`renderer/js/panel.js`：删除第 4-10 行整个 `CAT_LABELS` 常量；`renderCats`（第 61-72 行）替换为：

```js
  Panel.prototype.renderCats = function (cats) {
    const self = this;
    this.catBar.innerHTML = '';
    for (const c of cats) {
      const chip = document.createElement('div');
      chip.className = 'cat-chip';
      chip.dataset.cat = c.key;
      chip.textContent = c.label;
      chip.addEventListener('click', () => { if (self.h.onCategory) self.h.onCategory(c.key); });
      this.catBar.appendChild(chip);
    }
  };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node test/panel.test.js && node test/smoke.test.js`
Expected: 两个文件全部 PASS

- [ ] **Step 5: 向用户报告 diff 摘要（不提交）**

---

### Task 6: web 链路（构建脚本 + shim + 断言）

**Files:**
- Modify: `scripts/build-web.js:2-6,47-55,66-72`
- Modify: `web/cli-guide-web.js:32`
- Modify: `test/build-web.test.js:44-49`

- [ ] **Step 1: 更新 build-web.test.js 断言（写失败测试）**

第 49 行 `check('Web 覆盖样式已注入', ...)` 之后追加：

```js
/* 7. 分类元数据内联 */
const mc = html.match(/window\.__CATEGORIES__ = (\[.*?\]);\n<\/script>/s);
check('__CATEGORIES__ 已内联', !!mc);
let cats = [];
if (mc) { try { cats = JSON.parse(mc[1]); } catch (e) { check('__CATEGORIES__ JSON 可解析', false); } }
check('13 个分类齐全且带 key/label', cats.length === 13 && cats.every(c => c.key && c.label));
check('分类顺序 linux 最前', cats[0] && cats[0].key === 'linux');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node test/build-web.test.js`
Expected: FAIL — 「__CATEGORIES__ 已内联」，其余 PASS

- [ ] **Step 3: 改造 build-web.js**

文件顶部 require 区（第 6 行 `const ROOT = ...` 之后）追加：

```js
const { loadBuiltinCommands, mergeCategories } = require('../lib/commands');
```

第 47-55 行「4. 注入内联命令数据」块替换为：

```js
  // 4. 注入内联命令数据 + web shim (位于首个脚本之前, 先于渲染层加载)
  const { commands, categories } = loadBuiltinCommands(ROOT);
  const cats = mergeCategories(categories, [], commands);
  const shim = inline(path.join(ROOT, 'web', 'cli-guide-web.js'));
  const inject = '<script>\nwindow.__COMMANDS__ = ' + JSON.stringify(commands) +
    ';\nwindow.__CATEGORIES__ = ' + JSON.stringify(cats) +
    ';\n</script>\n  <script>\n' + shim + '\n</script>\n  ';
  html = html.replace('<!-- three 的 UMD 构建先加载, pet.js 通过 window.THREE 使用 -->', inject + '<!-- three 的 UMD 构建先加载, pet.js 通过 window.THREE 使用 -->');
```

文件末尾 `require.main` 块（第 66-72 行）替换为：

```js
if (require.main === module) {
  const out = build();
  const { commands } = loadBuiltinCommands(ROOT);
  console.log('web build written: ' + out + ' (' + Math.round(fs.statSync(out).size / 1024) + ' KB, ' + commands.length + ' 条命令)');
}
```

- [ ] **Step 4: 更新 web shim**

`web/cli-guide-web.js` 第 32 行替换为：

```js
    loadCommands: () => Promise.resolve({ commands: window.__COMMANDS__ || [], categories: window.__CATEGORIES__ || [] }),
```

- [ ] **Step 5: 运行测试确认通过**

Run: `node test/build-web.test.js`
Expected: 全部 PASS

- [ ] **Step 6: 向用户报告 diff 摘要（不提交）**

---

### Task 7: 全量回归 + 手动验证

**Files:** 无新改动，验证任务

- [ ] **Step 1: 全量测试**

Run: `npm test`
Expected: 7 个测试文件全部「全部通过」，退出码 0

- [ ] **Step 2: web 产物构建**

Run: `npm run build:web`
Expected: 输出 `web build written: ... (xxx KB, 506 条命令)`（条数与迁移前一致）

- [ ] **Step 3: 客户端手动验证（需用户配合或代跑）**

1. `npm start` 启动 → 点击桌宠展开面板 → 13 个芯片顺序为 linux, k8s, helm, vim, terminal, office, docker, kafka, mysql, postgres, redis, vscode, idea
2. 点击「docker 命令」芯片 → 列表只剩 docker 命令 → 再点一次取消过滤
3. 托盘菜单「打开命令数据目录」→ 在 `~/.cli-guide/commands/` 新建 `git.json`：

```json
{
  "cat": "git",
  "label": "git 命令",
  "commands": [
    { "id": "git-status", "cmd": "git status", "cat": "git", "desc": "查看工作区状态",
      "syntax": "git status [-s]", "args": [{ "name": "-s", "desc": "简短输出" }],
      "examples": [{ "cmd": "git status", "comment": "查看状态" }], "tags": ["git"] }
  ]
}
```

4. 重启应用 → 末尾出现「git 命令」芯片 → 点击过滤出 git status
5. 把 `git.json` 的 `label` 改为「Git 命令」→ 重启 → 芯片文案更新
6. 删除 `git.json` → 重启 → 芯片消失，其余 13 类不受影响
7. 搜索/详情/复制按钮回归正常

- [ ] **Step 4: web 手动验证**

Run: 浏览器打开 `dist/cli-guide-web.html`
Expected: 13 类芯片正常、搜索与详情正常、`__CATEGORIES__` 驱动芯片文案

- [ ] **Step 5: 汇总全部变更，请用户 review 并决定提交**

---

## Self-Review 记录

- 规格覆盖：§2 数据格式→Task 1/3；§3 加载合并→Task 2；§4 IPC/渲染→Task 4/5；§5 Web→Task 6；§6 校验测试→各任务 TDD 步骤；§7 错误处理→Task 2 loadCommandDir；§8 范围外未引入。无遗漏。
- 占位符扫描：无 TBD/TODO；所有代码步骤给出完整代码。
- 类型一致性：`loadBuiltinCommands/loadUserCommands → { commands, categories }`；`mergeCategories(builtinCats, userCats, allCommands) → [{ key, label }]`；meta 字段 `{ cat, label, order, file }`——各任务一致。

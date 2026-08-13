# CLI-GUIDE 桌宠命令手册实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 macOS 常驻桌面的 3D 终端脸桌宠（Electron + Three.js），点击唤起命令搜索面板，快速检索 6 大分类约 350 条命令行用法，支持一键复制、全局快捷键、开机自启动。

**Architecture:** 单 BrowserWindow 状态机（compact 150×150 ↔ expanded 760×560）。主进程负责窗口/快捷键/自启动/托盘/文件 IO；渲染进程负责 Three.js 桌宠 + DOM 面板。纯逻辑（命令校验合并、搜索、窗口布局）抽为可无头测试的模块。

**Tech Stack:** Electron 43.x、Three.js 0.185.x、纯 Node 测试（无 jest/无 jsdom，DOM 手写桩，沿用 helm-game test/ 模式）。

**设计文档:** `docs/superpowers/specs/2026-08-13-cli-guide-pet-design.md`

**前置条件:** 已 `git init`（main 分支），设计文档已提交（commit a667afe）。工作目录 `/Users/lilinhua/Documents/study/k8s/cli-guide`。

---

## 文件结构总览

| 文件 | 职责 |
| --- | --- |
| `package.json` | 依赖与脚本（start / test） |
| `main.js` | Electron 主进程：窗口状态机、全局快捷键、自启动、Tray、单实例、IPC |
| `preload.js` | contextBridge 暴露 `window.cliGuide` API |
| `lib/commands.js` | 纯 Node：命令校验、内置库读取、用户目录合并（可测） |
| `lib/layout.js` | 纯函数：窗口布局计算与动画插值（可测） |
| `resources/commands/*.json` | 内置命令库 ×6 分类 |
| `renderer/index.html` | 渲染层页面骨架 |
| `renderer/css/style.css` | 黑客神秘科技风样式 |
| `renderer/js/commands.js` | 渲染层命令存储：分组、分类、索引 |
| `renderer/js/search.js` | 搜索算法（可测） |
| `renderer/js/pet.js` | Three.js 终端脸桌宠（WebGL 失败自动降级） |
| `renderer/js/panel.js` | 面板 UI：搜索框/分类/列表/详情/复制 |
| `renderer/js/main.js` | 渲染层入口：装配 + 拖拽 + 键盘 + IPC |
| `test/*.test.js` | 无头测试（Node 直接跑） |

**测试命令:** `npm test` 依次跑 commands / search / layout / panel / smoke 五个测试文件，全部 PASS 退出码 0。

**IPC 契约（preload 暴露的 API，全项目统一使用）:**

```js
window.cliGuide = {
  loadCommands()            // → Promise<Array<command>> 内置+用户合并后的全部命令
  getConfig()               // → Promise<{x,y,loginItem,hotkeyEnabled}>
  saveConfig(partial)       // → Promise<void>
  copyText(text)            // → Promise<void> 写剪贴板
  togglePanel()             // → Promise<void> 请求主进程展开/收起
  hidePanel()               // → Promise<void> 收起（Esc/失焦）
  dragMove(dx, dy)          // → Promise<void> 移动窗口（拖拽）
  setLoginItem(enabled)     // → Promise<boolean> 设置开机自启动，返回结果
  openDataDir()             // → Promise<void> 打开用户数据目录
  quit()                    // → Promise<void>
}
// 主进程 → 渲染进程广播：
// 'window-state' {state: 'compact'|'expanded'}
```

**命令数据格式（所有 JSON 统一遵循）:**

```json
{
  "id": "kubectl-get",
  "cmd": "kubectl get",
  "cat": "k8s",
  "desc": "查询资源列表",
  "syntax": "kubectl get <resource> [-n <ns>] [-A] [-o <fmt>]",
  "args": [{ "name": "-A", "desc": "查看所有命名空间" }],
  "examples": [{ "cmd": "kubectl get pods -A", "comment": "查看所有 Pod" }],
  "tags": ["查询", "pod", "列表"]
}
```

必需字段：`id`(string, 全局唯一)、`cmd`(string)、`cat`(string, 六分类之一)、`desc`(string)、`syntax`(string)、`args`(数组)、`examples`(数组, 至少 1 条)、`tags`(数组)。

---

### Task 1: 项目脚手架

**Files:**
- Create: `package.json`
- Create: 目录 `resources/commands/` `renderer/css/` `renderer/js/` `lib/` `test/`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "cli-guide",
  "version": "0.1.0",
  "description": "黑客风终端脸桌宠命令行手册",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "test": "node test/commands.test.js && node test/search.test.js && node test/layout.test.js && node test/panel.test.js && node test/smoke.test.js"
  },
  "devDependencies": {
    "electron": "^43.4.0"
  },
  "dependencies": {
    "three": "^0.185.1"
  }
}
```

- [ ] **Step 2: 安装依赖**

```bash
cd /Users/lilinhua/Documents/study/k8s/cli-guide
npm install
```

Expected: `added N packages`（electron 下载二进制较慢，耐心等待），`node_modules/` 出现。确认 `.gitignore` 已含 `node_modules/`（已存在）。

- [ ] **Step 3: 创建目录结构**

```bash
mkdir -p resources/commands renderer/css renderer/js lib test
```

- [ ] **Step 4: 验证依赖可加载**

```bash
node -e "const t=require('three'); console.log('three ok', t.REVISION)"
```

Expected: `three ok 185`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: 项目脚手架 (Electron + Three.js)"
```

---

### Task 2: 命令校验器 + linux 命令库（TDD）

**Files:**
- Create: `test/commands.test.js`
- Create: `lib/commands.js`（第一步只含 `validateCommand`）
- Create: `resources/commands/linux.json`

- [ ] **Step 1: 写失败测试 — 校验函数 + 内置库完整性**

`test/commands.test.js`（本任务先写校验部分，加载合并测试在 Task 5 追加）：

```js
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
check('六个分类文件都存在', ['linux','k8s','helm','vim','terminal','office'].every(c => all.some(x => x.cat === c)));
check('命令总数 >= 300', all.length >= 300);
const ids = new Set();
let dup = 0;
for (const c of all) { if (ids.has(c.id)) dup++; ids.add(c.id); }
check('id 全局唯一', dup === 0);
const invalid = all.filter(c => validateCommand(c).length > 0);
check('所有命令通过校验', invalid.length === 0);

console.log(fail === 0 ? '\n===== 全部通过 =====' : '\n===== 存在 ' + fail + ' 个失败 =====');
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 2: 运行确认失败**

```bash
cd /Users/lilinhua/Documents/study/k8s/cli-guide
npm test
```

Expected: `Cannot find module '../lib/commands'` → 失败（测试先行）。

- [ ] **Step 3: 实现校验函数**

`lib/commands.js`：

```js
'use strict';
/* 命令库: 校验 / 内置读取 / 用户合并 (纯 Node, 可无头测试) */
const fs = require('fs');
const path = require('path');

const CATS = ['linux', 'k8s', 'helm', 'vim', 'terminal', 'office'];

function validateCommand(c) {
  const errs = [];
  if (!c || typeof c !== 'object') return ['not an object'];
  if (typeof c.id !== 'string' || !c.id) errs.push('id required');
  if (typeof c.cmd !== 'string' || !c.cmd) errs.push('cmd required');
  if (!CATS.includes(c.cat)) errs.push('bad cat: ' + c.cat);
  if (typeof c.desc !== 'string' || !c.desc) errs.push('desc required');
  if (typeof c.syntax !== 'string' || !c.syntax) errs.push('syntax required');
  if (!Array.isArray(c.args)) errs.push('args must be array');
  if (!Array.isArray(c.examples) || c.examples.length === 0) errs.push('examples required (>=1)');
  if (!Array.isArray(c.tags)) errs.push('tags must be array');
  return errs;
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

module.exports = { validateCommand, loadBuiltinCommands, CATS };
```

- [ ] **Step 4: 创建 linux.json（12 条完整 + 25 条按清单补全）**

`resources/commands/linux.json` — 先写以下 12 条完整条目：

```json
[
  { "id": "ls", "cmd": "ls", "cat": "linux", "desc": "列出目录内容",
    "syntax": "ls [-l] [-a] [-h] [path]",
    "args": [ { "name": "-l", "desc": "长格式(权限/大小/时间)" }, { "name": "-a", "desc": "包含隐藏文件" }, { "name": "-h", "desc": "人类可读大小" } ],
    "examples": [ { "cmd": "ls -lah", "comment": "查看当前目录全部文件详情" } ],
    "tags": ["目录", "列表", "文件"] },
  { "id": "cd", "cmd": "cd", "cat": "linux", "desc": "切换工作目录",
    "syntax": "cd [dir]",
    "args": [ { "name": "..", "desc": "上一级" }, { "name": "~", "desc": "家目录" }, { "name": "-", "desc": "上一个目录" } ],
    "examples": [ { "cmd": "cd ~/projects && pwd", "comment": "进入目录并确认" } ],
    "tags": ["目录", "切换"] },
  { "id": "pwd", "cmd": "pwd", "cat": "linux", "desc": "打印当前工作目录",
    "syntax": "pwd", "args": [], "examples": [ { "cmd": "pwd", "comment": "输出绝对路径" } ], "tags": ["目录"] },
  { "id": "cp", "cmd": "cp", "cat": "linux", "desc": "复制文件或目录",
    "syntax": "cp [-r] source dest",
    "args": [ { "name": "-r", "desc": "递归复制目录" }, { "name": "-i", "desc": "覆盖前询问" } ],
    "examples": [ { "cmd": "cp -r build/ dist/", "comment": "递归复制目录" } ],
    "tags": ["复制", "文件"] },
  { "id": "mv", "cmd": "mv", "cat": "linux", "desc": "移动或重命名",
    "syntax": "mv source dest",
    "args": [ { "name": "-i", "desc": "覆盖前询问" }, { "name": "-n", "desc": "不覆盖已存在" } ],
    "examples": [ { "cmd": "mv old.txt new.txt", "comment": "重命名文件" } ],
    "tags": ["移动", "重命名"] },
  { "id": "rm", "cmd": "rm", "cat": "linux", "desc": "删除文件或目录",
    "syntax": "rm [-rf] target",
    "args": [ { "name": "-r", "desc": "递归删除目录" }, { "name": "-f", "desc": "强制不询问" } ],
    "examples": [ { "cmd": "rm -rf build/", "comment": "强制删除目录(慎用)" } ],
    "tags": ["删除"] },
  { "id": "mkdir", "cmd": "mkdir", "cat": "linux", "desc": "创建目录",
    "syntax": "mkdir [-p] dir",
    "args": [ { "name": "-p", "desc": "递归创建父目录" } ],
    "examples": [ { "cmd": "mkdir -p a/b/c", "comment": "一次创建多级目录" } ],
    "tags": ["目录", "创建"] },
  { "id": "touch", "cmd": "touch", "cat": "linux", "desc": "创建空文件或更新时间戳",
    "syntax": "touch file",
    "args": [], "examples": [ { "cmd": "touch .gitkeep", "comment": "创建占位空文件" } ],
    "tags": ["文件", "创建"] },
  { "id": "grep", "cmd": "grep", "cat": "linux", "desc": "按模式搜索文本",
    "syntax": "grep [-rin] pattern [file...]",
    "args": [ { "name": "-r", "desc": "递归目录" }, { "name": "-i", "desc": "忽略大小写" }, { "name": "-n", "desc": "显示行号" } ],
    "examples": [ { "cmd": "grep -rn 'TODO' src/", "comment": "递归搜索源码中的 TODO" } ],
    "tags": ["搜索", "文本"] },
  { "id": "find", "cmd": "find", "cat": "linux", "desc": "按条件查找文件",
    "syntax": "find path -name pattern",
    "args": [ { "name": "-name", "desc": "按名字(支持通配符)" }, { "name": "-type f/d", "desc": "按类型" }, { "name": "-exec", "desc": "对结果执行命令" } ],
    "examples": [ { "cmd": "find . -name '*.log' -type f", "comment": "找所有日志文件" } ],
    "tags": ["查找", "文件"] },
  { "id": "cat", "cmd": "cat", "cat": "linux", "desc": "查看/拼接文件内容",
    "syntax": "cat [-n] file",
    "args": [ { "name": "-n", "desc": "带行号" } ],
    "examples": [ { "cmd": "cat /etc/hosts", "comment": "查看 hosts 文件" } ],
    "tags": ["查看", "文件"] },
  { "id": "tail", "cmd": "tail", "cat": "linux", "desc": "查看文件末尾",
    "syntax": "tail [-f] [-n N] file",
    "args": [ { "name": "-f", "desc": "持续跟随新内容" }, { "name": "-n", "desc": "末尾 N 行" } ],
    "examples": [ { "cmd": "tail -f app.log", "comment": "实时跟踪日志" } ],
    "tags": ["日志", "查看"] }
]
```

**然后按同样结构补全以下 25 条**（cmd / desc / 关键参数 / 示例，格式照抄上面 12 条，id 用 cmd 去掉特殊字符）：

`head` 查看开头、`less` 分页查看、`more` 简单分页、`echo` 输出文本、`export` 设置环境变量、`env` 查看环境变量、`alias` 命令别名、`ps` 查看进程、`kill` 终止进程、`top` 实时进程监控、`df` 磁盘空间、`du` 目录占用、`free` 内存使用、`wget` 下载、`curl` 传输数据、`ssh` 远程登录、`scp` 远程复制、`rsync` 增量同步、`tar` 打包解包、`gzip` 压缩、`unzip` 解压、`history` 命令历史、`which` 定位可执行文件、`whoami` 当前用户、`sudo` 提权执行、`chmod` 修改权限、`chown` 修改属主、`ln` 软硬链接、`file` 文件类型、`stat` 文件详情、`sort` 排序、`uniq` 去重、`wc` 统计行数、`xargs` 参数传递、`tee` 同时输出到文件、`watch` 周期执行、`lsof` 打开的文件、`netstat` 网络连接、`ping` 连通性测试、`traceroute` 路由追踪、`nslookup` DNS 查询、`uptime` 运行时长、`uname` 系统信息、`date` 日期时间、`sleep` 休眠、`nohup` 后台运行、`jobs` 任务列表、`fg` 前台恢复、`bg` 后台运行、`cut` 按列截取、`tr` 字符替换、`seq` 序列生成

（上述清单每一条都要有完整 8 字段；linux.json 总计 60 条左右即可，`cat` 字段一律 `"linux"`。）

- [ ] **Step 5: 运行测试确认通过**

```bash
npm test
```

Expected: commands 部分全部 PASS，但 `test/search.test.js` 不存在会报错 → 本任务先临时只跑 commands：

```bash
node test/commands.test.js
```

Expected: 全部 PASS（注意此时只有 linux.json 一个文件，`loadBuiltinCommands` 只返回 linux 分类，六个分类断言会 FAIL——**这是预期**，Task 3/4 补齐分类后转绿）。

- [ ] **Step 6: Commit**

```bash
git add lib/commands.js resources/commands/linux.json test/commands.test.js
git commit -m "feat: 命令校验器 + linux 命令库(60条)"
```

---

### Task 3: terminal + office 命令库

**Files:**
- Create: `resources/commands/terminal.json`
- Create: `resources/commands/office.json`

- [ ] **Step 1: 创建 terminal.json（终端快捷键与操作，40 条左右）**

先写完整条目（结构同 Task 2 示例，`cat` 一律 `"terminal"`）：

```json
[
  { "id": "term-ctrl-c", "cmd": "Ctrl+C", "cat": "terminal", "desc": "中断当前命令",
    "syntax": "Ctrl+C", "args": [], "examples": [ { "cmd": "ping 8.8.8.8  →  Ctrl+C", "comment": "中断正在运行的命令" } ],
    "tags": ["中断", "快捷键"] },
  { "id": "term-ctrl-l", "cmd": "Ctrl+L", "cat": "terminal", "desc": "清屏",
    "syntax": "Ctrl+L", "args": [], "examples": [ { "cmd": "Ctrl+L", "comment": "等价 clear" } ],
    "tags": ["清屏", "快捷键"] },
  { "id": "term-ctrl-a", "cmd": "Ctrl+A", "cat": "terminal", "desc": "光标移到行首",
    "syntax": "Ctrl+A", "args": [], "examples": [], "tags": ["光标"] },
  { "id": "term-ctrl-e", "cmd": "Ctrl+E", "cat": "terminal", "desc": "光标移到行尾",
    "syntax": "Ctrl+E", "args": [], "examples": [], "tags": ["光标"] },
  { "id": "term-ctrl-u", "cmd": "Ctrl+U", "cat": "terminal", "desc": "删除光标前所有字符",
    "syntax": "Ctrl+U", "args": [], "examples": [], "tags": ["编辑"] },
  { "id": "term-ctrl-w", "cmd": "Ctrl+W", "cat": "terminal", "desc": "删除光标前一个词",
    "syntax": "Ctrl+W", "args": [], "examples": [], "tags": ["编辑"] },
  { "id": "term-ctrl-r", "cmd": "Ctrl+R", "cat": "terminal", "desc": "反向搜索命令历史",
    "syntax": "Ctrl+R", "args": [], "examples": [ { "cmd": "Ctrl+R  kubectl", "comment": "搜索历史中 kubectl 命令" } ],
    "tags": ["历史", "搜索"] },
  { "id": "term-ctrl-z", "cmd": "Ctrl+Z", "cat": "terminal", "desc": "挂起当前进程(可 fg 恢复)",
    "syntax": "Ctrl+Z  →  fg / bg", "args": [],
    "examples": [ { "cmd": "vim file.txt → Ctrl+Z → fg", "comment": "挂起后恢复" } ],
    "tags": ["进程", "挂起"] },
  { "id": "term-tab", "cmd": "Tab", "cat": "terminal", "desc": "命令/文件名自动补全",
    "syntax": "Tab (连按两次列出候选)", "args": [], "examples": [ { "cmd": "kube[TAB] → kubectl", "comment": "命令补全" } ],
    "tags": ["补全"] },
  { "id": "term-double-bang", "cmd": "!!", "cat": "terminal", "desc": "执行上一条命令",
    "syntax": "!!", "args": [], "examples": [ { "cmd": "sudo !!", "comment": "给上一条命令加 sudo" } ],
    "tags": ["历史"] },
  { "id": "term-cmd-t", "cmd": "Cmd+T", "cat": "terminal", "desc": "新建标签页",
    "syntax": "Cmd+T", "args": [], "examples": [], "tags": ["iTerm", "标签"] },
  { "id": "term-cmd-d", "cmd": "Cmd+D", "cat": "terminal", "desc": "垂直分屏",
    "syntax": "Cmd+D", "args": [], "examples": [ { "cmd": "Cmd+D 后 Cmd+[ / Cmd+]", "comment": "分屏间切换" } ],
    "tags": ["iTerm", "分屏"] },
  { "id": "term-cmd-arrow", "cmd": "Cmd+←/→", "cat": "terminal", "desc": "切换相邻标签页",
    "syntax": "Cmd+← / Cmd+→", "args": [], "examples": [], "tags": ["iTerm", "标签"] },
  { "id": "term-cmd-f", "cmd": "Cmd+F", "cat": "terminal", "desc": "在终端输出中查找",
    "syntax": "Cmd+F", "args": [], "examples": [], "tags": ["iTerm", "查找"] },
  { "id": "term-cmd-shift-d", "cmd": "Cmd+Shift+D", "cat": "terminal", "desc": "水平分屏",
    "syntax": "Cmd+Shift+D", "args": [], "examples": [], "tags": ["iTerm", "分屏"] },
  { "id": "term-cmd-num", "cmd": "Cmd+1..9", "cat": "terminal", "desc": "跳转到第 N 个标签页",
    "syntax": "Cmd+1 ～ Cmd+9", "args": [], "examples": [], "tags": ["iTerm", "标签"] },
  { "id": "term-cmd-w", "cmd": "Cmd+W", "cat": "terminal", "desc": "关闭当前标签页",
    "syntax": "Cmd+W", "args": [], "examples": [], "tags": ["标签", "关闭"] },
  { "id": "term-cmd-shift-t", "cmd": "Cmd+Shift+T", "cat": "terminal", "desc": "恢复最近关闭的标签",
    "syntax": "Cmd+Shift+T", "args": [], "examples": [], "tags": ["标签"] },
  { "id": "term-cmd-c-v", "cmd": "Cmd+C / Cmd+V", "cat": "terminal", "desc": "复制/粘贴(选中即复制需开启)",
    "syntax": "Cmd+C / Cmd+V", "args": [], "examples": [], "tags": ["复制", "粘贴"] }
]
```

**然后按同样结构补全以下 20 条**（`cat` 一律 `"terminal"`，examples 可为空数组但其余字段齐全）：

`Ctrl+D` 退出 shell、`Ctrl+K` 删到行尾、`Ctrl+Y` 粘贴删除区、`Ctrl+P/N` 上/下历史、`Alt+←/→` 按词移动、`Cmd+Shift+I` 全屏、`Cmd+;` 自动补全历史、`Cmd+Shift+H` 历史面板、`Cmd+Shift+E` 时间戳、`Cmd+Opt+E` 全屏所有标签、`Cmd+Opt+←/→` 切换窗口、`Cmd+Shift+F` 全屏查找、`Cmd+K` 清屏(iTerm)、`Cmd+Opt+D` 打开新窗口、`Cmd+Shift+W` 关闭窗口、`clear` 清屏命令、`Ctrl+Opt+Cmd+V` 粘贴历史(iTerm)、`Cmd+Shift+Enter` 最大化当前标签(iTerm)、`Opt+Cmd+1/2` 切分屏窗格、`Cmd+Shift+J` 分割窗格焦点(iTerm)

- [ ] **Step 2: 创建 office.json（git + docker + macOS 快捷键 + tmux，50 条左右）**

先写完整条目（`cat` 一律 `"office"`）：

```json
[
  { "id": "git-add", "cmd": "git add", "cat": "office", "desc": "暂存文件变更",
    "syntax": "git add <path>", "args": [ { "name": "-p", "desc": "交互式暂存部分" } ],
    "examples": [ { "cmd": "git add -A && git status", "comment": "暂存全部并查看状态" } ],
    "tags": ["git", "暂存"] },
  { "id": "git-commit", "cmd": "git commit", "cat": "office", "desc": "提交暂存内容",
    "syntax": "git commit -m \"msg\"",
    "args": [ { "name": "-m", "desc": "提交信息" }, { "name": "--amend", "desc": "修改上一次提交" } ],
    "examples": [ { "cmd": "git commit -m \"fix: bug\"", "comment": "常规提交" } ],
    "tags": ["git", "提交"] },
  { "id": "git-push", "cmd": "git push", "cat": "office", "desc": "推送提交到远程",
    "syntax": "git push [remote] [branch]",
    "args": [ { "name": "-u", "desc": "设置上游分支" }, { "name": "--force-with-lease", "desc": "安全强推" } ],
    "examples": [ { "cmd": "git push -u origin main", "comment": "首次推送并设上游" } ],
    "tags": ["git", "远程"] },
  { "id": "git-pull", "cmd": "git pull", "cat": "office", "desc": "拉取并合并远程变更",
    "syntax": "git pull", "args": [ { "name": "--rebase", "desc": "用 rebase 合并" } ],
    "examples": [ { "cmd": "git pull --rebase", "comment": "线性历史拉取" } ],
    "tags": ["git", "远程"] },
  { "id": "git-status", "cmd": "git status", "cat": "office", "desc": "查看工作区状态",
    "syntax": "git status", "args": [ { "name": "-s", "desc": "简短输出" } ],
    "examples": [ { "cmd": "git status -s", "comment": "简短状态" } ],
    "tags": ["git"] },
  { "id": "git-log", "cmd": "git log", "cat": "office", "desc": "查看提交历史",
    "syntax": "git log [--oneline] [--graph]",
    "args": [ { "name": "--oneline", "desc": "单行显示" }, { "name": "-p", "desc": "显示差异" } ],
    "examples": [ { "cmd": "git log --oneline --graph", "comment": "图形化历史" } ],
    "tags": ["git", "历史"] },
  { "id": "git-branch", "cmd": "git branch", "cat": "office", "desc": "管理分支",
    "syntax": "git branch [-a] [name]",
    "args": [ { "name": "-a", "desc": "包含远程分支" }, { "name": "-d", "desc": "删除分支" } ],
    "examples": [ { "cmd": "git branch -a", "comment": "列出所有分支" } ],
    "tags": ["git", "分支"] },
  { "id": "git-checkout", "cmd": "git checkout", "cat": "office", "desc": "切换分支/恢复文件",
    "syntax": "git checkout <branch|file>",
    "args": [ { "name": "-b", "desc": "新建并切换" } ],
    "examples": [ { "cmd": "git checkout -b feat/new", "comment": "新建分支并切换" } ],
    "tags": ["git", "分支"] },
  { "id": "git-merge", "cmd": "git merge", "cat": "office", "desc": "合并分支",
    "syntax": "git merge <branch>",
    "args": [ { "name": "--no-ff", "desc": "保留合并记录" } ],
    "examples": [ { "cmd": "git merge feat/new", "comment": "合并特性分支" } ],
    "tags": ["git", "合并"] },
  { "id": "git-rebase", "cmd": "git rebase", "cat": "office", "desc": "变基提交",
    "syntax": "git rebase <branch>",
    "args": [ { "name": "-i", "desc": "交互式变基" } ],
    "examples": [ { "cmd": "git rebase -i HEAD~3", "comment": "整理最近 3 个提交" } ],
    "tags": ["git", "变基"] },
  { "id": "git-stash", "cmd": "git stash", "cat": "office", "desc": "暂存工作区改动",
    "syntax": "git stash [pop|list]",
    "args": [ { "name": "pop", "desc": "恢复并删除" }, { "name": "list", "desc": "查看列表" } ],
    "examples": [ { "cmd": "git stash && git pull && git stash pop", "comment": "保存改动拉取再恢复" } ],
    "tags": ["git", "暂存"] },
  { "id": "git-diff", "cmd": "git diff", "cat": "office", "desc": "查看未暂存差异",
    "syntax": "git diff [file]",
    "args": [ { "name": "--staged", "desc": "已暂存差异" } ],
    "examples": [ { "cmd": "git diff --staged", "comment": "检查将提交的内容" } ],
    "tags": ["git", "差异"] },
  { "id": "git-clone", "cmd": "git clone", "cat": "office", "desc": "克隆远程仓库",
    "syntax": "git clone <url> [dir]",
    "args": [ { "name": "--depth 1", "desc": "浅克隆" } ],
    "examples": [ { "cmd": "git clone --depth 1 https://github.com/x/y.git", "comment": "快速浅克隆" } ],
    "tags": ["git", "远程"] },
  { "id": "docker-run", "cmd": "docker run", "cat": "office", "desc": "运行容器",
    "syntax": "docker run [-it] [-d] [-p 端口映射] [--rm] image [cmd]",
    "args": [ { "name": "-it", "desc": "交互终端" }, { "name": "-d", "desc": "后台运行" }, { "name": "-p", "desc": "端口映射" } ],
    "examples": [ { "cmd": "docker run -it --rm ubuntu bash", "comment": "临时交互容器" } ],
    "tags": ["docker", "容器"] },
  { "id": "docker-ps", "cmd": "docker ps", "cat": "office", "desc": "列出容器",
    "syntax": "docker ps [-a]",
    "args": [ { "name": "-a", "desc": "含已停止" } ],
    "examples": [ { "cmd": "docker ps -a", "comment": "查看全部容器" } ],
    "tags": ["docker", "容器"] },
  { "id": "docker-images", "cmd": "docker images", "cat": "office", "desc": "列出镜像",
    "syntax": "docker images", "args": [], "examples": [], "tags": ["docker", "镜像"] },
  { "id": "docker-build", "cmd": "docker build", "cat": "office", "desc": "构建镜像",
    "syntax": "docker build -t <name> .",
    "args": [ { "name": "-t", "desc": "镜像标签" } ],
    "examples": [ { "cmd": "docker build -t myapp:v1 .", "comment": "构建并打标签" } ],
    "tags": ["docker", "镜像"] },
  { "id": "docker-exec", "cmd": "docker exec", "cat": "office", "desc": "进入运行中容器",
    "syntax": "docker exec -it <container> bash",
    "args": [ { "name": "-it", "desc": "交互终端" } ],
    "examples": [ { "cmd": "docker exec -it myapp bash", "comment": "进入容器调试" } ],
    "tags": ["docker", "容器"] },
  { "id": "docker-logs", "cmd": "docker logs", "cat": "office", "desc": "查看容器日志",
    "syntax": "docker logs [-f] <container>",
    "args": [ { "name": "-f", "desc": "持续跟踪" } ],
    "examples": [ { "cmd": "docker logs -f myapp", "comment": "跟踪日志" } ],
    "tags": ["docker", "日志"] },
  { "id": "docker-compose-up", "cmd": "docker compose up", "cat": "office", "desc": "启动 compose 服务",
    "syntax": "docker compose up [-d]",
    "args": [ { "name": "-d", "desc": "后台运行" }, { "name": "--build", "desc": "先构建" } ],
    "examples": [ { "cmd": "docker compose up -d --build", "comment": "构建并后台启动" } ],
    "tags": ["docker", "compose"] },
  { "id": "mac-shot-full", "cmd": "Cmd+Shift+3", "cat": "office", "desc": "全屏截图",
    "syntax": "Cmd+Shift+3", "args": [], "examples": [], "tags": ["macOS", "截图"] },
  { "id": "mac-shot-area", "cmd": "Cmd+Shift+4", "cat": "office", "desc": "区域截图",
    "syntax": "Cmd+Shift+4 (再按空格可截窗口)", "args": [], "examples": [], "tags": ["macOS", "截图"] },
  { "id": "mac-shot-record", "cmd": "Cmd+Shift+5", "cat": "office", "desc": "录屏/截图工具栏",
    "syntax": "Cmd+Shift+5", "args": [], "examples": [], "tags": ["macOS", "录屏"] },
  { "id": "mac-spotlight", "cmd": "Cmd+Space", "cat": "office", "desc": "Spotlight 全局搜索",
    "syntax": "Cmd+Space", "args": [], "examples": [], "tags": ["macOS", "搜索"] },
  { "id": "mac-switch-app", "cmd": "Cmd+Tab", "cat": "office", "desc": "切换应用",
    "syntax": "Cmd+Tab (加 Shift 反向)", "args": [], "examples": [], "tags": ["macOS"] },
  { "id": "mac-force-quit", "cmd": "Cmd+Opt+Esc", "cat": "office", "desc": "强制退出应用",
    "syntax": "Cmd+Opt+Esc", "args": [], "examples": [], "tags": ["macOS"] },
  { "id": "mac-minimize", "cmd": "Cmd+M", "cat": "office", "desc": "最小化窗口",
    "syntax": "Cmd+M", "args": [], "examples": [], "tags": ["macOS"] },
  { "id": "mac-hide", "cmd": "Cmd+H", "cat": "office", "desc": "隐藏当前应用",
    "syntax": "Cmd+H (Cmd+Opt+H 隐藏其他)", "args": [], "examples": [], "tags": ["macOS"] },
  { "id": "mac-lock", "cmd": "Cmd+Ctrl+Q", "cat": "office", "desc": "锁定屏幕",
    "syntax": "Cmd+Ctrl+Q", "args": [], "examples": [], "tags": ["macOS", "锁屏"] },
  { "id": "tmux-new", "cmd": "tmux new", "cat": "office", "desc": "新建 tmux 会话",
    "syntax": "tmux new -s <name>",
    "args": [ { "name": "-s", "desc": "会话名" } ],
    "examples": [ { "cmd": "tmux new -s dev", "comment": "创建 dev 会话" } ],
    "tags": ["tmux", "会话"] },
  { "id": "tmux-detach", "cmd": "Ctrl+B D", "cat": "office", "desc": "分离会话(保持运行)",
    "syntax": "Ctrl+B 然后 D", "args": [], "examples": [], "tags": ["tmux"] },
  { "id": "tmux-attach", "cmd": "tmux attach", "cat": "office", "desc": "重新连接会话",
    "syntax": "tmux attach -t <name>", "args": [ { "name": "-t", "desc": "会话名" } ],
    "examples": [ { "cmd": "tmux attach -t dev", "comment": "恢复 dev 会话" } ],
    "tags": ["tmux", "会话"] },
  { "id": "tmux-split-v", "cmd": "Ctrl+B %", "cat": "office", "desc": "垂直分屏",
    "syntax": "Ctrl+B 然后 %", "args": [], "examples": [], "tags": ["tmux", "分屏"] },
  { "id": "tmux-split-h", "cmd": "Ctrl+B \"", "cat": "office", "desc": "水平分屏",
    "syntax": "Ctrl+B 然后 \"", "args": [], "examples": [], "tags": ["tmux", "分屏"] },
  { "id": "tmux-new-win", "cmd": "Ctrl+B C", "cat": "office", "desc": "新建窗口",
    "syntax": "Ctrl+B 然后 C", "args": [], "examples": [], "tags": ["tmux", "窗口"] },
  { "id": "tmux-switch", "cmd": "Ctrl+B N/P", "cat": "office", "desc": "切换窗口",
    "syntax": "Ctrl+B 然后 N(下一个) / P(上一个)", "args": [], "examples": [], "tags": ["tmux", "窗口"] }
]
```

**然后按同样结构补全以下 12 条**（`cat` 一律 `"office"`）：

`git remote` 管理远程、`git tag` 标签、`git cherry-pick` 挑提交、`git reset` 回退、`git show` 查看提交、`docker stop` 停止容器、`docker rm` 删除容器、`docker rmi` 删除镜像、`docker pull` 拉镜像、`docker network` 网络管理、`docker volume` 卷管理、`docker compose down` 停止服务

- [ ] **Step 3: 运行测试**

```bash
node test/commands.test.js
```

Expected: 六个分类断言仍 FAIL（缺 k8s/helm/vim）—— 无需惊慌，Task 4 补齐。

- [ ] **Step 4: Commit**

```bash
git add resources/commands/terminal.json resources/commands/office.json
git commit -m "feat: terminal + office 命令库"
```

---

### Task 4: k8s + helm + vim 命令库

**Files:**
- Create: `resources/commands/k8s.json`
- Create: `resources/commands/helm.json`
- Create: `resources/commands/vim.json`

- [ ] **Step 1: 创建 k8s.json（kubectl，45 条左右）**

参考 `/Users/lilinhua/Documents/study/k8s/k8s-game/js/questions.js` 提炼。先写完整条目（`cat` 一律 `"k8s"`）：

```json
[
  { "id": "kubectl-get", "cmd": "kubectl get", "cat": "k8s", "desc": "查询资源列表",
    "syntax": "kubectl get <resource> [-n <ns>] [-A] [-o <fmt>]",
    "args": [ { "name": "-A", "desc": "所有命名空间" }, { "name": "-n", "desc": "指定命名空间" }, { "name": "-o wide/yaml/json", "desc": "输出格式" } ],
    "examples": [ { "cmd": "kubectl get pods -A", "comment": "查看所有 Pod" }, { "cmd": "kubectl get all -o wide", "comment": "查看全部资源详情" } ],
    "tags": ["查询", "pod"] },
  { "id": "kubectl-describe", "cmd": "kubectl describe", "cat": "k8s", "desc": "查看资源详细信息与事件",
    "syntax": "kubectl describe <resource> <name> [-n <ns>]",
    "args": [ { "name": "-n", "desc": "命名空间" } ],
    "examples": [ { "cmd": "kubectl describe pod my-pod", "comment": "定位 Pod 异常原因" } ],
    "tags": ["排查", "事件"] },
  { "id": "kubectl-logs", "cmd": "kubectl logs", "cat": "k8s", "desc": "查看容器日志",
    "syntax": "kubectl logs <pod> [-f] [-c <container>]",
    "args": [ { "name": "-f", "desc": "持续跟随" }, { "name": "-c", "desc": "指定容器" }, { "name": "--previous", "desc": "上次崩溃日志" } ],
    "examples": [ { "cmd": "kubectl logs -f --previous my-pod", "comment": "查看崩溃前日志" } ],
    "tags": ["日志", "排查"] },
  { "id": "kubectl-exec", "cmd": "kubectl exec", "cat": "k8s", "desc": "进入容器执行命令",
    "syntax": "kubectl exec -it <pod> -- <cmd>",
    "args": [ { "name": "-it", "desc": "交互终端" }, { "name": "--", "desc": "其后为容器内命令" } ],
    "examples": [ { "cmd": "kubectl exec -it my-pod -- bash", "comment": "进入容器 shell" } ],
    "tags": ["调试", "容器"] },
  { "id": "kubectl-apply", "cmd": "kubectl apply", "cat": "k8s", "desc": "声明式创建/更新资源",
    "syntax": "kubectl apply -f <file|dir>",
    "args": [ { "name": "-f", "desc": "YAML 文件或目录" }, { "name": "-k", "desc": "kustomize 目录" } ],
    "examples": [ { "cmd": "kubectl apply -f deploy.yaml", "comment": "应用清单" } ],
    "tags": ["声明式", "yaml"] },
  { "id": "kubectl-create", "cmd": "kubectl create", "cat": "k8s", "desc": "命令式创建资源",
    "syntax": "kubectl create deployment <name> --image=<img>",
    "args": [ { "name": "--image", "desc": "镜像" }, { "name": "--replicas", "desc": "副本数" } ],
    "examples": [ { "cmd": "kubectl create deployment nginx --image=nginx", "comment": "快速创建 Deployment" } ],
    "tags": ["创建"] },
  { "id": "kubectl-delete", "cmd": "kubectl delete", "cat": "k8s", "desc": "删除资源",
    "syntax": "kubectl delete <resource> <name> [-f file]",
    "args": [ { "name": "-f", "desc": "按文件删除" }, { "name": "--grace-period=0 --force", "desc": "强制删除" } ],
    "examples": [ { "cmd": "kubectl delete pod my-pod", "comment": "删除 Pod(Deployment 会重建)" } ],
    "tags": ["删除"] },
  { "id": "kubectl-get-nodes", "cmd": "kubectl get nodes", "cat": "k8s", "desc": "查看集群节点状态",
    "syntax": "kubectl get nodes",
    "args": [ { "name": "-o wide", "desc": "查看 IP/版本" } ],
    "examples": [ { "cmd": "kubectl get nodes -o wide", "comment": "节点详情" } ],
    "tags": ["节点"] },
  { "id": "kubectl-cluster-info", "cmd": "kubectl cluster-info", "cat": "k8s", "desc": "查看集群信息",
    "syntax": "kubectl cluster-info", "args": [],
    "examples": [ { "cmd": "kubectl cluster-info dump", "comment": "导出全量集群信息" } ],
    "tags": ["集群"] },
  { "id": "kubectl-scale", "cmd": "kubectl scale", "cat": "k8s", "desc": "扩缩容副本",
    "syntax": "kubectl scale deploy <name> --replicas=<n>",
    "args": [ { "name": "--replicas", "desc": "目标副本数" } ],
    "examples": [ { "cmd": "kubectl scale deploy nginx --replicas=5", "comment": "扩容到 5 副本" } ],
    "tags": ["扩容", "deployment"] },
  { "id": "kubectl-rollout", "cmd": "kubectl rollout", "cat": "k8s", "desc": "管理发布",
    "syntax": "kubectl rollout <status|restart|undo> deploy <name>",
    "args": [ { "name": "status", "desc": "发布状态" }, { "name": "restart", "desc": "重启发布" }, { "name": "undo", "desc": "回滚到上一版" } ],
    "examples": [ { "cmd": "kubectl rollout undo deploy nginx", "comment": "回滚发布" } ],
    "tags": ["发布", "回滚"] },
  { "id": "kubectl-port-forward", "cmd": "kubectl port-forward", "cat": "k8s", "desc": "端口转发到本地",
    "syntax": "kubectl port-forward <pod> <local>:<remote>",
    "args": [],
    "examples": [ { "cmd": "kubectl port-forward svc/web 8080:80", "comment": "本地访问集群服务" } ],
    "tags": ["转发", "调试"] },
  { "id": "kubectl-explain", "cmd": "kubectl explain", "cat": "k8s", "desc": "查看资源字段说明",
    "syntax": "kubectl explain <resource>[.field]",
    "args": [],
    "examples": [ { "cmd": "kubectl explain pod.spec.containers", "comment": "查看容器字段" } ],
    "tags": ["文档", "字段"] },
  { "id": "kubectl-top", "cmd": "kubectl top", "cat": "k8s", "desc": "查看资源占用",
    "syntax": "kubectl top <pod|node> [-A]",
    "args": [ { "name": "-A", "desc": "所有命名空间" } ],
    "examples": [ { "cmd": "kubectl top pod -A", "comment": "所有 Pod 资源占用" } ],
    "tags": ["监控", "资源"] },
  { "id": "kubectl-edit", "cmd": "kubectl edit", "cat": "k8s", "desc": "编辑线上资源",
    "syntax": "kubectl edit <resource> <name>",
    "args": [],
    "examples": [ { "cmd": "kubectl edit deploy nginx", "comment": "编辑 Deployment" } ],
    "tags": ["编辑"] }
]
```

**然后按同样结构补全以下 30 条**（`cat` 一律 `"k8s"`，从 k8s-game 题库提炼）：

`kubectl get ns` 命名空间、`kubectl create ns` 创建命名空间、`kubectl get svc` 服务、`kubectl get cm` 配置映射、`kubectl get secret` 密钥、`kubectl get pvc` 存储卷、`kubectl get ingress` 入口、`kubectl get events` 事件、`kubectl get deploy` 部署、`kubectl get rs` 副本集、`kubectl get ds` 守护集、`kubectl get sts` 状态集、`kubectl get cronjob` 定时任务、`kubectl get all` 全部资源、`kubectl run` 临时 Pod、`kubectl expose` 暴露服务、`kubectl label` 打标签、`kubectl annotate` 注解、`kubectl patch` 局部更新、`kubectl replace` 替换资源、`kubectl drain` 排空节点、`kubectl cordon` 节点不可调度、`kubectl uncordon` 恢复调度、`kubectl taint` 污点、`kubectl config use-context` 切换上下文、`kubectl config get-contexts` 上下文列表、`kubectl version` 版本、`kubectl api-resources` 资源列表、`kubectl wait` 等待条件、`kubectl kustomize` 渲染 kustomize

- [ ] **Step 2: 创建 helm.json（40 条左右）**

参考 `/Users/lilinhua/Documents/study/k8s/helm-game/js/questions.js` 提炼。先写完整条目（`cat` 一律 `"helm"`）：

```json
[
  { "id": "helm-install", "cmd": "helm install", "cat": "helm", "desc": "安装 chart",
    "syntax": "helm install <name> <chart> [-n <ns>] [--values f.yaml]",
    "args": [ { "name": "--values/-f", "desc": "指定 values 文件" }, { "name": "--set", "desc": "覆盖参数" }, { "name": "-n", "desc": "命名空间" } ],
    "examples": [ { "cmd": "helm install myapp ./myapp -f prod.yaml", "comment": "带配置安装" } ],
    "tags": ["安装"] },
  { "id": "helm-upgrade", "cmd": "helm upgrade", "cat": "helm", "desc": "升级 release",
    "syntax": "helm upgrade <release> <chart> [--values f.yaml]",
    "args": [ { "name": "--values/-f", "desc": "新配置" }, { "name": "--set", "desc": "覆盖参数" } ],
    "examples": [ { "cmd": "helm upgrade myapp ./myapp --set image.tag=v2", "comment": "升级镜像版本" } ],
    "tags": ["升级"] },
  { "id": "helm-rollback", "cmd": "helm rollback", "cat": "helm", "desc": "回滚 release",
    "syntax": "helm rollback <release> <revision>",
    "args": [ { "name": "revision", "desc": "目标版本号" } ],
    "examples": [ { "cmd": "helm rollback myapp 1", "comment": "回滚到第 1 版" } ],
    "tags": ["回滚"] },
  { "id": "helm-uninstall", "cmd": "helm uninstall", "cat": "helm", "desc": "卸载 release",
    "syntax": "helm uninstall <release> [-n <ns>]",
    "args": [ { "name": "-n", "desc": "命名空间" } ],
    "examples": [ { "cmd": "helm uninstall myapp", "comment": "卸载应用" } ],
    "tags": ["卸载"] },
  { "id": "helm-list", "cmd": "helm list", "cat": "helm", "desc": "列出 release",
    "syntax": "helm list [-A] [-n <ns>]",
    "args": [ { "name": "-A", "desc": "所有命名空间" } ],
    "examples": [ { "cmd": "helm list -A", "comment": "查看全部 release" } ],
    "tags": ["列表"] },
  { "id": "helm-status", "cmd": "helm status", "cat": "helm", "desc": "查看 release 状态",
    "syntax": "helm status <release>",
    "args": [],
    "examples": [ { "cmd": "helm status myapp", "comment": "查看部署状态" } ],
    "tags": ["状态"] },
  { "id": "helm-repo-add", "cmd": "helm repo add", "cat": "helm", "desc": "添加仓库",
    "syntax": "helm repo add <name> <url>",
    "args": [],
    "examples": [ { "cmd": "helm repo add bitnami https://charts.bitnami.com/bitnami", "comment": "添加 bitnami 仓库" } ],
    "tags": ["仓库"] },
  { "id": "helm-repo-update", "cmd": "helm repo update", "cat": "helm", "desc": "更新仓库索引",
    "syntax": "helm repo update",
    "args": [],
    "examples": [ { "cmd": "helm repo update", "comment": "刷新仓库缓存" } ],
    "tags": ["仓库"] },
  { "id": "helm-search", "cmd": "helm search", "cat": "helm", "desc": "搜索 chart",
    "syntax": "helm search repo <keyword>",
    "args": [],
    "examples": [ { "cmd": "helm search repo nginx", "comment": "搜仓库里的 nginx chart" } ],
    "tags": ["搜索"] },
  { "id": "helm-create", "cmd": "helm create", "cat": "helm", "desc": "创建 chart 骨架",
    "syntax": "helm create <name>",
    "args": [],
    "examples": [ { "cmd": "helm create myapp && ls myapp", "comment": "生成标准目录" } ],
    "tags": ["创建"] },
  { "id": "helm-template", "cmd": "helm template", "cat": "helm", "desc": "本地渲染模板(不部署)",
    "syntax": "helm template <name> <chart>",
    "args": [ { "name": "-f", "desc": "values 文件" } ],
    "examples": [ { "cmd": "helm template myapp ./myapp | less", "comment": "预览渲染结果" } ],
    "tags": ["渲染", "调试"] },
  { "id": "helm-lint", "cmd": "helm lint", "cat": "helm", "desc": "检查 chart 规范",
    "syntax": "helm lint <chart>",
    "args": [],
    "examples": [ { "cmd": "helm lint ./myapp", "comment": "发布前检查" } ],
    "tags": ["检查"] },
  { "id": "helm-get-values", "cmd": "helm get values", "cat": "helm", "desc": "查看 release 配置",
    "syntax": "helm get values <release>",
    "args": [ { "name": "-a", "desc": "含默认值" } ],
    "examples": [ { "cmd": "helm get values myapp", "comment": "看实际生效配置" } ],
    "tags": ["配置"] },
  { "id": "helm-history", "cmd": "helm history", "cat": "helm", "desc": "查看发布历史",
    "syntax": "helm history <release>",
    "args": [],
    "examples": [ { "cmd": "helm history myapp", "comment": "查看各版本记录" } ],
    "tags": ["历史"] }
]
```

**然后按同样结构补全以下 26 条**（`cat` 一律 `"helm"`，从 helm-game 题库提炼）：

`helm repo list` 仓库列表、`helm repo remove` 移除仓库、`helm show values` 查看默认值、`helm show chart` 查看元信息、`helm pull` 下载 chart、`helm package` 打包 chart、`helm push` 推送 chart、`helm version` 版本、`helm env` 环境变量、`helm plugin list` 插件、`helm completion` 自动补全、`helm test` 运行测试、`helm dependency list` 依赖列表、`helm dependency update` 更新依赖、`helm dependency build` 构建依赖、`helm get manifest` 查看清单、`helm get hooks` 查看钩子、`helm get notes` 查看提示、`helm upgrade --install` 安装或升级、`helm upgrade --atomic` 原子升级、`helm upgrade --reuse-values` 复用配置、`helm diff` (插件) 对比差异、`helm secrets` (插件) 加密配置、`helm registry login` 登录仓库、`helm chart save/export` OCI 保存导出、`helm search hub` 搜 hub

- [ ] **Step 3: 创建 vim.json（40 条左右）**

先写完整条目（`cat` 一律 `"vim"`）：

```json
[
  { "id": "vim-insert", "cmd": "i / a / o", "cat": "vim", "desc": "进入插入模式",
    "syntax": "i=光标前插入  a=光标后插入  o=下方新行插入",
    "args": [ { "name": "I", "desc": "行首插入" }, { "name": "A", "desc": "行尾插入" }, { "name": "O", "desc": "上方新行插入" } ],
    "examples": [ { "cmd": "按 i 后直接输入", "comment": "插入文本" } ],
    "tags": ["模式", "插入"] },
  { "id": "vim-esc", "cmd": "Esc", "cat": "vim", "desc": "返回普通模式",
    "syntax": "Esc (或 Ctrl+[)", "args": [], "examples": [], "tags": ["模式"] },
  { "id": "vim-hjkl", "cmd": "h j k l", "cat": "vim", "desc": "光标移动",
    "syntax": "h=左 j=下 k=上 l=右",
    "args": [ { "name": "w/b", "desc": "按词前进/后退" }, { "name": "0/$", "desc": "行首/行尾" }, { "name": "gg/G", "desc": "文件头/尾" } ],
    "examples": [ { "cmd": "5j", "comment": "下移 5 行(数字前缀)" } ],
    "tags": ["移动"] },
  { "id": "vim-dd", "cmd": "dd", "cat": "vim", "desc": "删除当前行",
    "syntax": "dd (d+方向 删除区域)",
    "args": [ { "name": "dw", "desc": "删一个词" }, { "name": "d$", "desc": "删到行尾" } ],
    "examples": [ { "cmd": "3dd", "comment": "删除 3 行" } ],
    "tags": ["删除"] },
  { "id": "vim-yy", "cmd": "yy", "cat": "vim", "desc": "复制当前行",
    "syntax": "yy (y+方向 复制区域)",
    "args": [ { "name": "yw", "desc": "复制一个词" } ],
    "examples": [ { "cmd": "yy 然后 p", "comment": "复制粘贴一行" } ],
    "tags": ["复制"] },
  { "id": "vim-p", "cmd": "p / P", "cat": "vim", "desc": "粘贴",
    "syntax": "p=光标后粘贴  P=光标前粘贴",
    "args": [], "examples": [], "tags": ["粘贴"] },
  { "id": "vim-u", "cmd": "u / Ctrl+R", "cat": "vim", "desc": "撤销 / 重做",
    "syntax": "u=撤销  Ctrl+R=重做",
    "args": [], "examples": [], "tags": ["撤销"] },
  { "id": "vim-search", "cmd": "/ pattern", "cat": "vim", "desc": "搜索",
    "syntax": "/<pattern> 回车, n=下一个 N=上一个",
    "args": [ { "name": "?", "desc": "反向搜索" }, { "name": "*", "desc": "搜当前词" } ],
    "examples": [ { "cmd": "/TODO", "comment": "查找 TODO" } ],
    "tags": ["搜索"] },
  { "id": "vim-substitute", "cmd": ":s / :%s", "cat": "vim", "desc": "替换",
    "syntax": ":s/old/new/g     :%s/old/new/g",
    "args": [ { "name": "g", "desc": "行内全部" }, { "name": "c", "desc": "逐个确认" }, { "name": "i", "desc": "忽略大小写" } ],
    "examples": [ { "cmd": ":%s/foo/bar/gc", "comment": "全文替换并确认" } ],
    "tags": ["替换"] },
  { "id": "vim-save", "cmd": ":w", "cat": "vim", "desc": "保存文件",
    "syntax": ":w", "args": [], "examples": [], "tags": ["保存"] },
  { "id": "vim-quit", "cmd": ":q", "cat": "vim", "desc": "退出",
    "syntax": ":q=退出  :q!=强制退出  :wq=保存退出",
    "args": [ { "name": ":wq", "desc": "保存并退出" }, { "name": ":x", "desc": "同 :wq" } ],
    "examples": [ { "cmd": ":wq", "comment": "保存退出" } ],
    "tags": ["退出"] },
  { "id": "vim-visual", "cmd": "v / V / Ctrl+V", "cat": "vim", "desc": "可视模式选择",
    "syntax": "v=字符  V=行  Ctrl+V=块",
    "args": [],
    "examples": [ { "cmd": "Ctrl+V 选择多列后 I 批量插入", "comment": "列编辑" } ],
    "tags": ["选择"] },
  { "id": "vim-split", "cmd": ":sp / :vsp", "cat": "vim", "desc": "分屏",
    "syntax": ":sp=水平分屏  :vsp=垂直分屏",
    "args": [ { "name": "Ctrl+W 方向键", "desc": "切换屏" }, { "name": "Ctrl+W q", "desc": "关闭屏" } ],
    "examples": [ { "cmd": ":vsp other.txt", "comment": "垂直分屏打开文件" } ],
    "tags": ["分屏"] },
  { "id": "vim-buffer", "cmd": ":e / :bn / :bd", "cat": "vim", "desc": "多文件操作",
    "syntax": ":e <file>=打开  :bn/:bp=下一个/上一个  :bd=关闭缓冲区",
    "args": [], "examples": [], "tags": ["多文件"] },
  { "id": "vim-gg-g", "cmd": "gg / G", "cat": "vim", "desc": "跳转文件首/尾",
    "syntax": "gg=首行  G=末行  <N>G=第 N 行",
    "args": [], "examples": [ { "cmd": "42G", "comment": "跳到第 42 行" } ],
    "tags": ["跳转"] }
]
```

**然后按同样结构补全以下 25 条**（`cat` 一律 `"vim"`）：

`x` 删除字符、`r` 替换字符、`c` 修改(cw/cc/c$)、`>> / <<` 缩进、`~` 大小写切换、`. `重复上次操作、`; / ,` 重复搜索方向、`Ctrl+O / Ctrl+I` 跳转历史、`%` 括号匹配、`f<char>` 行内跳到字符、`diw` 删词内、`ci\"` 改引号内、`:noh` 取消高亮、`:set number` 行号、`:set relativenumber` 相对行号、`:syntax on` 高亮语法、`:set expandtab` 空格缩进、`:set paste` 粘贴模式、`:map` 自定义映射、`:noremap` 无递归映射、`:!<cmd>` 执行外部命令、`:r !<cmd>` 插入命令输出、`Ctrl+V + I` 列插入、`q + 字母` 录制宏、`@ + 字母` 回放宏、`:e!` 放弃修改重载、`:set hlsearch` 搜索高亮

（补全时如 `examples` 无合适内容可留空数组，但 `id/cmd/cat/desc/syntax/args/tags` 必须齐全。）

- [ ] **Step 4: 运行完整测试**

```bash
npm test
```

Expected: commands 测试全部 PASS（六个分类齐全、id 唯一、总数 ≥300）。后续 search/layout/panel/smoke 文件尚不存在会报错——**属预期**，依次在 Task 5~12 创建后转绿。

- [ ] **Step 5: Commit**

```bash
git add resources/commands/k8s.json resources/commands/helm.json resources/commands/vim.json
git commit -m "feat: k8s + helm + vim 命令库, 数据层测试全绿"
```

---

### Task 5: 命令加载与用户合并（TDD）

**Files:**
- Modify: `test/commands.test.js`（追加合并测试）
- Modify: `lib/commands.js`（追加加载/合并函数）

- [ ] **Step 1: 追加失败测试**

在 `test/commands.test.js` 的 `process.exit` 之前追加：

```js
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
```

- [ ] **Step 2: 运行确认失败**

```bash
node test/commands.test.js
```

Expected: `loadUserCommands is not a function` → FAIL。

- [ ] **Step 3: 实现加载/合并**

在 `lib/commands.js` 末尾追加：

```js
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

module.exports = { validateCommand, loadBuiltinCommands, loadUserCommands, mergeCommands, CATS };
```

注意：把 `module.exports` 行从原来的 `{ validateCommand, loadBuiltinCommands, CATS }` 改为上面的完整导出（用 SearchReplace 替换原行）。

- [ ] **Step 4: 运行确认通过**

```bash
node test/commands.test.js
```

Expected: 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add lib/commands.js test/commands.test.js
git commit -m "feat: 命令库用户扩展合并(同名覆盖+容错)"
```

---

### Task 6: 搜索算法（TDD）

**Files:**
- Create: `test/search.test.js`
- Create: `renderer/js/search.js`

- [ ] **Step 1: 写失败测试**

`test/search.test.js`：

```js
'use strict';
const { searchCommands } = require('../renderer/js/search');

let fail = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name); if (!cond) fail++; };

const DATA = [
  { id: 'kubectl-get', cmd: 'kubectl get', cat: 'k8s', desc: '查询资源列表', tags: ['查询', 'pod'] },
  { id: 'kubectl-logs', cmd: 'kubectl logs', cat: 'k8s', desc: '查看日志', tags: ['日志'] },
  { id: 'ls', cmd: 'ls', cat: 'linux', desc: '列出目录', tags: ['目录'] },
  { id: 'grep', cmd: 'grep', cat: 'linux', desc: '搜索文本', tags: ['搜索'] },
  { id: 'vim-search', cmd: '/ pattern', cat: 'vim', desc: '搜索', tags: ['搜索'] }
];

/* 基础: 大小写不敏感子串 */
let r = searchCommands(DATA, 'kubectl');
check('命令名子串匹配', r.length === 2 && r.every(x => x.item.cat === 'k8s'));
r = searchCommands(DATA, 'KUBECTL');
check('大小写不敏感', r.length === 2);

/* 关键词: tags / desc */
r = searchCommands(DATA, '日志');
check('描述匹配', r.length === 1 && r[0].item.id === 'kubectl-logs');
r = searchCommands(DATA, 'pod');
check('标签匹配', r.some(x => x.item.id === 'kubectl-get'));

/* 空输入: 返回全部 */
r = searchCommands(DATA, '');
check('空输入返回全部', r.length === DATA.length);

/* 分类过滤 */
r = searchCommands(DATA, '', { cat: 'linux' });
check('分类过滤', r.length === 2 && r.every(x => x.item.cat === 'linux'));
r = searchCommands(DATA, '搜索', { cat: 'vim' });
check('分类+关键词叠加', r.length === 1 && r[0].item.id === 'vim-search');

/* 优先级: cmd 命中排前 */
r = searchCommands(DATA, '搜索');
check('cmd 命中优先于 desc', r[0].item.id === 'grep' && r[1].item.id === 'vim-search');

/* 高亮区间 */
r = searchCommands(DATA, 'get');
check('返回命中位置', r[0].hitStart === 7 && r[0].hitEnd === 10);

console.log(fail === 0 ? '\n===== 全部通过 =====' : '\n===== 存在 ' + fail + ' 个失败 =====');
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 2: 运行确认失败**

```bash
node test/search.test.js
```

Expected: `Cannot find module '../renderer/js/search'` → FAIL。

- [ ] **Step 3: 实现搜索**

`renderer/js/search.js`：

```js
'use strict';
/* 搜索: cmd/desc/tags 大小写不敏感子串匹配, cmd 命中优先 */
function searchCommands(list, query, opts) {
  const q = (query || '').trim().toLowerCase();
  const cat = opts && opts.cat;
  const out = [];
  for (const item of list) {
    if (cat && item.cat !== cat) continue;
    if (!q) { out.push({ item, field: '', hitStart: 0, hitEnd: 0 }); continue; }
    const cmd = item.cmd.toLowerCase();
    const ci = cmd.indexOf(q);
    if (ci !== -1) { out.push({ item, field: 'cmd', hitStart: ci, hitEnd: ci + q.length }); continue; }
    if ((item.desc || '').toLowerCase().includes(q)) { out.push({ item, field: 'desc', hitStart: 0, hitEnd: 0 }); continue; }
    if ((item.tags || []).some(t => t.toLowerCase().includes(q))) { out.push({ item, field: 'tag', hitStart: 0, hitEnd: 0 }); continue; }
  }
  const rank = { cmd: 0, desc: 1, tag: 2 };
  out.sort((a, b) => rank[a.field] - rank[b.field]);
  return out;
}

module.exports = { searchCommands };
```

- [ ] **Step 4: 运行确认通过**

```bash
node test/search.test.js
```

Expected: 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add renderer/js/search.js test/search.test.js
git commit -m "feat: 搜索算法(子串匹配/优先级/分类过滤)"
```

---

### Task 7: 窗口布局纯函数（TDD）

**Files:**
- Create: `test/layout.test.js`
- Create: `lib/layout.js`

- [ ] **Step 1: 写失败测试**

`test/layout.test.js`：

```js
'use strict';
const { defaultCompactBounds, computeExpandedBounds, interpolate } = require('../lib/layout');

let fail = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name); if (!cond) fail++; };

/* 默认位置: 屏幕右下角上方, 留 20px 边距 */
const wa = { x: 0, y: 0, width: 1440, height: 900 };
const cb = defaultCompactBounds(wa);
check('默认停靠右下角', cb.x === 1440 - 150 - 20 && cb.y === 900 - 150 - 20 && cb.width === 150 && cb.height === 150);

/* 展开: 面板 610 宽(760-150), 桌宠 150 在左侧 */
const eb = computeExpandedBounds(cb, wa, { width: 760, height: 560 });
check('展开宽度正确', eb.width === 760 && eb.height === 560);
check('桌宠区在左, 面板在右', eb.x + 150 <= wa.x + wa.width && eb.x + 760 <= wa.x + wa.width + 0.01);

/* 靠右时向左展开: 保持右边缘对齐 */
check('右边缘对齐(向左展开)', eb.x + eb.width === cb.x + cb.width);

/* 靠底部时向上展开: 保持底部对齐 */
check('底边缘对齐(向上展开)', eb.y + eb.height === cb.y + cb.height);

/* 屏幕太小: 钳制到工作区 */
const small = { x: 0, y: 0, width: 400, height: 300 };
const eb2 = computeExpandedBounds(cb, small, { width: 760, height: 560 });
check('小屏钳制不越界', eb2.x >= 0 && eb2.y >= 0 && eb2.x + eb2.width <= 400 && eb2.y + eb2.height <= 300);

/* 插值 */
const v = interpolate(0, 100, 0.5);
check('线性插值中点', v === 50);
const eased = interpolate(0, 100, 0.5, 'easeOutCubic');
check('缓动插值', eased > 50 && eased <= 100);

console.log(fail === 0 ? '\n===== 全部通过 =====' : '\n===== 存在 ' + fail + ' 个失败 =====');
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 2: 运行确认失败**

```bash
node test/layout.test.js
```

Expected: `Cannot find module '../lib/layout'` → FAIL。

- [ ] **Step 3: 实现布局函数**

`lib/layout.js`：

```js
'use strict';
/* 窗口布局纯函数 (可无头测试) */
const PET_W = 150, PET_H = 150, MARGIN = 20;

function defaultCompactBounds(workArea) {
  return {
    x: workArea.x + workArea.width - PET_W - MARGIN,
    y: workArea.y + workArea.height - PET_H - MARGIN,
    width: PET_W, height: PET_H
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function computeExpandedBounds(compact, workArea, panelSize) {
  let x = compact.x + compact.width - panelSize.width;  // 右边缘对齐(向左展开)
  let y = compact.y + compact.height - panelSize.height; // 底边缘对齐(向上展开)
  x = clamp(x, workArea.x, workArea.x + workArea.width - panelSize.width);
  y = clamp(y, workArea.y, workArea.y + workArea.height - panelSize.height);
  return { x, y, width: panelSize.width, height: panelSize.height };
}

function interpolate(from, to, t, easing) {
  if (easing === 'easeOutCubic') t = 1 - Math.pow(1 - t, 3);
  return from + (to - from) * t;
}

module.exports = { defaultCompactBounds, computeExpandedBounds, interpolate, PET_W, PET_H, MARGIN };
```

- [ ] **Step 4: 运行确认通过**

```bash
node test/layout.test.js
```

Expected: 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add lib/layout.js test/layout.test.js
git commit -m "feat: 窗口布局计算(展开方向翻转/小屏钳制/缓动)"
```

---

### Task 8: 渲染层静态骨架（index.html + style.css）

**Files:**
- Create: `renderer/index.html`
- Create: `renderer/css/style.css`

- [ ] **Step 1: 创建 index.html**

`renderer/index.html`（布局：`#pet-root` 桌宠容器在左 150×150，`#panel-root` 面板在右，初始仅显示桌宠）：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' file:; img-src 'self' data:">
  <title>CLI-GUIDE</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="app">
    <div id="pet-root"><div id="pet-fallback" class="hidden"></div></div>
    <div id="panel-root" class="hidden">
      <div class="panel">
        <div class="panel-head">
          <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
          <span class="panel-title">&gt; CLI_GUIDE</span>
          <span class="panel-hint">Esc 收起 · Cmd+Shift+C 唤起</span>
        </div>
        <div class="search-row">
          <span class="search-prefix">❯</span>
          <input id="search-input" type="text" placeholder="输入关键词搜索命令..." autocomplete="off" spellcheck="false">
          <span id="search-cursor" class="cursor"></span>
        </div>
        <div id="cat-bar" class="cat-bar"></div>
        <div class="panel-body">
          <div id="list-col" class="list-col">
            <div id="result-list" class="result-list"></div>
            <div id="list-status" class="list-status"></div>
          </div>
          <div id="detail-col" class="detail-col">
            <div id="detail-empty" class="detail-empty">⬡ 选中左侧命令查看详情</div>
            <div id="detail-content" class="detail-content hidden"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <!-- three 的 UMD 构建先加载, pet.js 通过 window.THREE 使用 -->
  <script src="../node_modules/three/build/three.min.js"></script>
  <script src="js/commands.js"></script>
  <script src="js/search.js"></script>
  <script src="js/panel.js"></script>
  <script src="js/pet.js"></script>
  <script src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 style.css（黑客神秘科技风）**

`renderer/css/style.css`：

```css
/* ============ CLI-GUIDE 黑客神秘科技风 ============ */
:root {
  --bg: #050a14;
  --bg-panel: rgba(6, 12, 20, .94);
  --green: #00ff88;
  --cyan: #00e5ff;
  --amber: #ffaa55;
  --text: #9fdcc0;
  --text-dim: #4a7a62;
  --border: rgba(0, 255, 136, .35);
  --font-mono: 'SF Mono', Menlo, Monaco, Consolas, monospace;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
body {
  font-family: var(--font-mono);
  color: var(--text);
  -webkit-user-select: none;
  user-select: none;
}
#app { position: relative; width: 100%; height: 100%; }
.hidden { display: none !important; }

/* ---- 桌宠区 ---- */
#pet-root {
  position: absolute; left: 0; top: 0;
  width: 150px; height: 150px;
  cursor: grab;
}
#pet-root.dragging { cursor: grabbing; }
#pet-fallback {
  width: 100%; height: 100%;
  border: 2px solid var(--green);
  border-radius: 14px;
  background: var(--bg);
  box-shadow: 0 0 24px rgba(0, 255, 136, .4), inset 0 0 20px rgba(0, 255, 136, .08);
  position: relative;
  animation: pet-bob 3s ease-in-out infinite;
}
#pet-fallback::before {           /* traffic lights */
  content: '● ● ●';
  position: absolute; top: 8px; left: 10px;
  color: #3a6; font-size: 6px; letter-spacing: 3px;
}
#pet-fallback::after {            /* 字符流 */
  content: '0101 1010 1100';
  position: absolute; left: 10px; top: 38px;
  color: var(--green); font-size: 9px; letter-spacing: 1px;
  opacity: .7; animation: pet-stream 2s steps(8) infinite;
}
@keyframes pet-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes pet-stream { 0% { opacity: .2; } 50% { opacity: .9; } 100% { opacity: .2; } }

/* ---- 面板 ---- */
#panel-root { position: absolute; left: 150px; top: 0; width: calc(100% - 150px); height: 100%; }
.panel {
  height: 100%;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 0 12px 12px 0;
  box-shadow: 0 0 30px rgba(0, 255, 136, .25), inset 0 0 40px rgba(0, 255, 136, .03);
  backdrop-filter: blur(10px);
  display: flex; flex-direction: column;
}
.panel-head {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0, 255, 136, .25);
}
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot.r { background: #ff5f56; box-shadow: 0 0 6px #ff5f56; }
.dot.y { background: #ffbd2e; box-shadow: 0 0 6px #ffbd2e; }
.dot.g { background: #27c93f; box-shadow: 0 0 6px #27c93f; }
.panel-title { color: var(--green); letter-spacing: 2px; font-size: 12px; font-weight: bold; }
.panel-hint { margin-left: auto; color: var(--text-dim); font-size: 9px; letter-spacing: 1px; }

.search-row {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(0, 255, 136, .25);
}
.search-prefix { color: var(--amber); font-size: 14px; }
#search-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--green); font-family: var(--font-mono); font-size: 14px;
  caret-color: transparent;
}
#search-input::placeholder { color: var(--text-dim); }
.cursor {
  width: 8px; height: 16px; background: var(--green);
  box-shadow: 0 0 8px var(--green);
  animation: cursor-blink 1s step-end infinite;
}
@keyframes cursor-blink { 50% { opacity: 0; } }

.cat-bar {
  display: flex; gap: 6px; flex-wrap: wrap;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(0, 255, 136, .2);
}
.cat-chip {
  padding: 3px 12px;
  border: 1px solid rgba(0, 255, 136, .3); border-radius: 20px;
  color: var(--text); font-size: 10px; letter-spacing: 1px;
  cursor: pointer; transition: all .15s;
}
.cat-chip:hover { border-color: var(--green); color: var(--green); box-shadow: 0 0 8px rgba(0,255,136,.3); }
.cat-chip.active {
  background: rgba(0, 255, 136, .15);
  border-color: var(--green); color: var(--green);
  box-shadow: 0 0 12px rgba(0, 255, 136, .4);
}

.panel-body { flex: 1; display: flex; min-height: 0; }
.list-col {
  width: 42%; min-width: 220px;
  border-right: 1px solid rgba(0, 255, 136, .2);
  display: flex; flex-direction: column; min-height: 0;
}
.result-list { flex: 1; overflow-y: auto; min-height: 0; }
.result-item {
  padding: 8px 14px; cursor: pointer;
  display: flex; align-items: baseline; gap: 8px;
  border-bottom: 1px solid rgba(0, 255, 136, .06);
  transition: background .12s;
}
.result-item:hover { background: rgba(0, 255, 136, .06); }
.result-item.active {
  background: rgba(0, 255, 136, .14);
  box-shadow: inset 3px 0 0 var(--green);
}
.result-item .cmd-name { color: #c9f5e0; font-size: 12px; }
.result-item .cmd-desc { color: var(--text-dim); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.result-item .cmd-tag { margin-left: auto; color: var(--amber); font-size: 9px; white-space: nowrap; }
.result-item .hl { color: var(--amber); }
.list-status { padding: 8px 14px; color: var(--text-dim); font-size: 10px; }

.detail-col { flex: 1; overflow-y: auto; padding: 14px 18px; }
.detail-empty { color: var(--text-dim); font-size: 11px; text-align: center; margin-top: 40px; letter-spacing: 1px; }
.detail-title { color: var(--green); font-size: 16px; font-weight: bold; margin-bottom: 4px; }
.detail-desc { color: var(--text); font-size: 11px; margin-bottom: 12px; }
.detail-section { color: var(--cyan); font-size: 10px; letter-spacing: 2px; margin: 14px 0 6px; }
.syntax-box {
  background: rgba(0, 255, 136, .07);
  border: 1px solid rgba(0, 255, 136, .3);
  border-radius: 6px; padding: 8px 12px;
  color: var(--green); font-size: 12px;
}
.syntax-box .arg { color: var(--amber); }
.arg-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.arg-table td { padding: 4px 8px; border-bottom: 1px solid rgba(0, 255, 136, .08); vertical-align: top; }
.arg-table td:first-child { color: var(--cyan); white-space: nowrap; }
.ex-box {
  background: #03070c;
  border: 1px solid rgba(0, 255, 136, .2);
  border-radius: 6px; padding: 10px 12px;
  font-size: 11px; line-height: 1.8;
}
.ex-box .ex-cmd { color: #bfe8d4; }
.ex-box .ex-comment { color: var(--text-dim); }
.copy-btn {
  display: inline-block; margin-top: 12px;
  padding: 6px 18px;
  border: 1px solid var(--green); border-radius: 4px;
  color: var(--green); font-size: 11px; letter-spacing: 1px;
  cursor: pointer; transition: all .15s;
  background: transparent;
}
.copy-btn:hover { background: rgba(0, 255, 136, .15); box-shadow: 0 0 12px rgba(0, 255, 136, .4); }
.copy-btn.copied { background: var(--green); color: #050a14; }

/* 滚动条 */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(0, 255, 136, .25); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(0, 255, 136, .5); }
```

- [ ] **Step 3: 手动预览**

```bash
cd /Users/lilinhua/Documents/study/k8s/cli-guide
npx electron . 2>/dev/null &
```

此时 main.js 不存在会报错——**预期**。本任务只需确认 CSS/HTML 语法无问题（用浏览器直接打开 index.html 预览静态效果即可，脚本缺失不影响视觉检查）。预览后关闭。

- [ ] **Step 4: Commit**

```bash
git add renderer/index.html renderer/css/style.css
git commit -m "feat: 渲染层静态骨架(黑客风样式)"
```

---

### Task 9: 3D 桌宠 pet.js（含 WebGL 降级）

**Files:**
- Create: `test/panel.test.js` 无关——pet 的测试并入 Task 12 smoke
- Create: `renderer/js/pet.js`

- [ ] **Step 1: 实现 pet.js**

`renderer/js/pet.js`（终端脸：主体盒子 + traffic lights + CanvasTexture 字符流 + 眼睛；WebGL 不可用自动降级为 CSS 桌宠）：

```js
'use strict';
/* 3D 终端脸桌宠: Three.js 程序化建模, WebGL 失败自动降级 CSS */
(function () {
  // 浏览器环境由 index.html 先加载 three.min.js (window.THREE); Node 测试用 require
  const THREE = (typeof require !== 'undefined') ? require('three') : window.THREE;

  function Pet(container) {
    this.container = container;
    this.fallback = false;
    this.onClick = null;      // 单击回调
    this.onDragStart = null;  // 拖拽开始回调 (dx,dy 由调用方管理)
    this._down = null;
    this._moved = false;
    this._bindEvents();
  }

  /* ---------- 生命周期 ---------- */
  Pet.prototype.init = function () {
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    this.container.appendChild(canvas);
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (e) {
      this.fallback = true;
      canvas.remove();
      this._showFallback();
      return;
    }
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(150, 150, false);
    const el = this.renderer.domElement;
    el.style.cursor = 'grab';
    el.style.pointerEvents = 'none'; // 鼠标事件由容器层处理(拖拽/点击判定)
    this._buildScene();
    this._raf = requestAnimationFrame(this._loop.bind(this));
  };

  Pet.prototype._showFallback = function () {
    const fb = document.getElementById('pet-fallback');
    if (fb) fb.classList.remove('hidden');
  };

  /* ---------- 场景搭建 ---------- */
  Pet.prototype._buildScene = function () {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 0.4, 5.2);
    this.camera.lookAt(0, 0, 0);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    // 主体: 终端窗口盒子
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 1.5, 0.35),
      new THREE.MeshBasicMaterial({ color: 0x0a0f14 })
    );
    this.group.add(body);
    // 边框线
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(body.geometry),
      new THREE.LineBasicMaterial({ color: 0x00ff88 })
    );
    this.group.add(edges);

    // 屏幕: 字符流贴图
    const sCanvas = document.createElement('canvas');
    sCanvas.width = 96; sCanvas.height = 64;
    this.sCtx = sCanvas.getContext('2d');
    this._initStream();
    this.screenTex = new THREE.CanvasTexture(sCanvas);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.2),
      new THREE.MeshBasicMaterial({ map: this.screenTex, transparent: true })
    );
    screen.position.z = 0.19;
    this.group.add(screen);

    // 眼睛
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    this.eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.06), eyeMat);
    this.eyeL.position.set(-0.5, 0.05, 0.2);
    this.eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.06), eyeMat);
    this.eyeR.position.set(0.5, 0.05, 0.2);
    this.group.add(this.eyeL, this.eyeR);

    // traffic lights
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x27c93f });
    const dotGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const dots = [0xff5f56, 0xffbd2e, 0x27c93f];
    dots.forEach((c, i) => {
      const m = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: c }));
      m.position.set(-0.72 + i * 0.18, 0.72, 0.2);
      this.group.add(m);
    });

    // 辉光 sprite
    const gCanvas = document.createElement('canvas');
    gCanvas.width = gCanvas.height = 64;
    const g = gCanvas.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,255,136,.5)');
    grad.addColorStop(1, 'rgba(0,255,136,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(gCanvas), transparent: true, depthWrite: false
    }));
    glow.scale.set(3.4, 2.6, 1);
    this.group.add(glow);

    // 点击惊吓
    this._shock = 0;
  };

  /* ---------- Matrix 字符流 ---------- */
  Pet.prototype._initStream = function () {
    this.cols = [];
    for (let i = 0; i < 20; i++) {
      this.cols.push({ head: Math.floor(Math.random() * 64), speed: 0.3 + Math.random() * 0.8 });
    }
    this._chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@%&';
  };
  Pet.prototype._drawStream = function () {
    const c = this.sCtx, w = 96, h = 64;
    c.clearRect(0, 0, w, h);
    c.font = '7px monospace';
    for (let i = 0; i < this.cols.length; i++) {
      const col = this.cols[i];
      col.head = (col.head + col.speed) % (h + 10);
      const x = i * 5;
      for (let j = 0; j < 4; j++) {
        const y = col.head - j * 7;
        if (y < 0 || y > h) continue;
        c.fillStyle = j === 0 ? '#7dffc0' : 'rgba(0,255,136,' + (0.6 - j * 0.13) + ')';
        c.fillText(this._chars[(Math.random() * this._chars.length) | 0], x, y);
      }
    }
    if (this.screenTex) this.screenTex.needsUpdate = true;
  };

  /* ---------- 动画循环 ---------- */
  Pet.prototype._loop = function (ts) {
    if (this._raf) this._raf = requestAnimationFrame(this._loop.bind(this));
    if (this.fallback) return;
    const t = ts / 1000;
    this.group.position.y = Math.sin(t * 1.2) * 0.12;          // 悬浮
    const breathe = 1 + Math.sin(t * 1.6) * 0.02;
    this.group.scale.setScalar(breathe);                        // 呼吸
    const blink = (t % 2.7) > 2.62 ? 0.12 : 1;                  // 眨眼
    this.eyeL.scale.y = blink; this.eyeR.scale.y = blink;
    if (this._shock > 0) {                                      // 点击惊吓
      this._shock -= 0.06;
      this.group.scale.setScalar(breathe * (1 + this._shock * 0.5));
    }
    this.group.rotation.y = Math.sin(t * 0.5) * 0.12;
    this._drawStream();
    this.renderer.render(this.scene, this.camera);
  };

  /* ---------- 鼠标交互: 拖拽 + 单击判定 ---------- */
  Pet.prototype._bindEvents = function () {
    const el = this.container;
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this._down = { x: e.screenX, y: e.screenY, t: Date.now() };
      this._moved = false;
      el.classList.add('dragging');
    });
    document.addEventListener('mousemove', (e) => {
      if (!this._down) return;
      const dx = e.screenX - this._down.x;
      const dy = e.screenY - this._down.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) {
        this._moved = true;
        if (this.onDragStart) this.onDragStart(dx, dy);
        this._down = { x: e.screenX, y: e.screenY, t: this._down.t };
      }
    });
    document.addEventListener('mouseup', () => {
      if (!this._down) return;
      const wasClick = !this._moved && (Date.now() - this._down.t < 350);
      this._down = null;
      el.classList.remove('dragging');
      if (wasClick && this.onClick) {
        this._shock = 1;
        this.onClick();
      }
    });
  };

  Pet.prototype.destroy = function () {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this.renderer) this.renderer.dispose();
  };

  if (typeof module !== 'undefined') module.exports = { Pet };
  window.Pet = window.Pet || { Pet };
})();
```

注意：`renderer/js/search.js` 用了 CommonJS `module.exports`（Task 6），浏览器端通过 `<script>` 加载时无 `module`——**兼容处理**：所有 renderer 文件统一用 `if (typeof module !== 'undefined') module.exports = ...` + 挂 `window`。**把 search.js 末尾的导出行改为**：

```js
if (typeof module !== 'undefined') { module.exports = { searchCommands }; }
window.searchCommands = searchCommands;
```

- [ ] **Step 2: 无头快速验证（Node 环境 require 不崩溃）**

```bash
node -e "
const THREE = require('three');
const { Pet } = require('./renderer/js/pet.js');
console.log('pet.js 模块加载 OK, Pet 类型:', typeof Pet);
"
```

Expected: `pet.js 模块加载 OK`。此时不调用 init（无 DOM），仅验证模块可加载。

- [ ] **Step 3: Commit**

```bash
git add renderer/js/pet.js renderer/js/search.js
git commit -m "feat: 3D 终端脸桌宠(字符流/眨眼/拖拽/降级)"
```

---

### Task 10: 面板 UI panel.js（TDD 无头）

**Files:**
- Create: `test/panel.test.js`
- Create: `renderer/js/panel.js`

- [ ] **Step 1: 写失败测试（含最小 DOM 桩）**

`test/panel.test.js`：

```js
'use strict';
/* 无头测试: 手写 DOM 桩, 验证 panel 渲染逻辑 */
const path = require('path');
const ROOT = path.join(__dirname, '..');

let fail = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name); if (!cond) fail++; };

/* ---- DOM 桩 ---- */
class FakeEl {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.dataset = {};
    this.style = {}; this._html = ''; this._text = '';
    this._cls = new Set(); this._listeners = {};
    this.value = '';
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; this.children.length = 0; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = v; }
  appendChild(c) { this.children.push(c); return c; }
  remove() {}
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  dispatch(t, ev) { (this._listeners[t] || []).forEach(fn => fn(ev)); }
  get classList() {
    return {
      add: (...c) => c.forEach(x => this._cls.add(x)),
      remove: (...c) => c.forEach(x => this._cls.delete(x)),
      contains: c => this._cls.has(c),
      toggle: (c, f) => f === undefined ? (this._cls.has(c) ? this._cls.delete(c) : this._cls.add(c)) : (f ? this._cls.add(c) : this._cls.delete(c))
    };
  }
  querySelector(sel) {
    const key = 'q:' + sel;
    if (!this._childMap) this._childMap = new Map();
    if (!this._childMap.has(key)) this._childMap.set(key, new FakeEl('div'));
    return this._childMap.get(key);
  }
  querySelectorAll() { return []; }
  closest() { return null; }
}
const els = {};
global.document = {
  getElementById: id => els[id] || (els[id] = new FakeEl('div')),
  createElement: t => new FakeEl(t),
  querySelector: s => new FakeEl('div'),
  addEventListener() {}, removeEventListener() {}
};

/* ---- 加载 panel ---- */
const { Panel } = require(path.join(ROOT, 'renderer/js/panel.js'));

const ITEMS = [
  { id: 'a', cmd: 'kubectl get', cat: 'k8s', desc: '查询列表', syntax: 'kubectl get <r>', args: [{ name: '-A', desc: '全部' }], examples: [{ cmd: 'kubectl get pods', comment: '看 pod' }], tags: [] },
  { id: 'b', cmd: 'ls', cat: 'linux', desc: '列目录', syntax: 'ls [-la]', args: [], examples: [{ cmd: 'ls -la', comment: '详情' }], tags: [] }
];

let copied = null;
const panel = new Panel('panel-root', { onCopy: c => { copied = c; } });
panel.setData(ITEMS);
panel.renderList(ITEMS, '');
check('列表渲染两条', els['result-list'].innerHTML.includes('kubectl get') && els['result-list'].innerHTML.includes('ls'));
check('状态显示条数', els['list-status']._text.includes('2'));

panel.renderList(ITEMS, 'kubectl');
check('搜索高亮包含 <span class="hl">', els['result-list'].innerHTML.includes('class="hl"'));

panel.showDetail(ITEMS[0]);
const dc = els['detail-content'];
check('详情渲染语法', dc.innerHTML.includes('kubectl get') && dc.innerHTML.includes('-A'));
check('详情渲染示例', dc.innerHTML.includes('kubectl get pods'));
check('详情区可见', !dc.classList.contains('hidden'));

/* 点击复制按钮 */
const btn = els['detail-content'].querySelector('.copy-btn');
btn.dispatch('click', {});
check('复制回调触发', copied && copied.id === 'a');

/* 空搜索提示 */
panel.renderList([], 'xyz');
check('无结果提示', els['list-status']._text.includes('无结果'));

console.log(fail === 0 ? '\n===== 全部通过 =====' : '\n===== 存在 ' + fail + ' 个失败 =====');
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 2: 运行确认失败**

```bash
node test/panel.test.js
```

Expected: `Cannot find module '../renderer/js/panel.js'` → FAIL。

- [ ] **Step 3: 实现 panel.js**

`renderer/js/panel.js`：

```js
'use strict';
/* 面板 UI: 搜索框/分类/列表/详情/复制 (渲染层, 无框架) */
(function () {
  const CAT_LABELS = {
    linux: 'linux 命令', k8s: 'k8s 命令', helm: 'helm 命令',
    vim: 'vim 命令', terminal: '终端快捷键', office: '办公常用'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function Panel(rootId, handlers) {
    this.h = handlers || {};
    this.root = document.getElementById(rootId);
    this.searchInput = document.getElementById('search-input');
    this.catBar = document.getElementById('cat-bar');
    this.listEl = document.getElementById('result-list');
    this.statusEl = document.getElementById('list-status');
    this.detailContent = document.getElementById('detail-content');
    this.detailEmpty = document.getElementById('detail-empty');
    this.activeCat = '';
    this.items = [];
    this.activeId = '';
    this._bind();
  }

  Panel.prototype._bind = function () {
    const self = this;
    this.searchInput.addEventListener('input', () => {
      if (self.h.onSearch) self.h.onSearch(this.searchInput.value);
    });
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (self.h.onArrow) self.h.onArrow(e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Enter') {
        if (self.h.onEnter) self.h.onEnter();
      }
    });
  };

  Panel.prototype.setData = function (items) { this.items = items; };

  Panel.prototype.renderCats = function (cats) {
    const self = this;
    this.catBar.innerHTML = '';
    for (const c of cats) {
      const chip = document.createElement('div');
      chip.className = 'cat-chip';
      chip.dataset.cat = c;
      chip.textContent = CAT_LABELS[c] || c;
      chip.addEventListener('click', () => { if (self.h.onCategory) self.h.onCategory(c); });
      this.catBar.appendChild(chip);
    }
  };

  Panel.prototype.setActiveCat = function (cat) {
    this.activeCat = cat;
    const chips = this.catBar.querySelectorAll('.cat-chip');
    chips.forEach((chip, i) => {
      const isActive = this.catBar.children[i] && this.catBar.children[i].dataset.cat === cat;
      chip.classList.toggle('active', !!isActive);
    });
  };

  Panel.prototype.renderList = function (results, query) {
    const q = (query || '').trim().toLowerCase();
    this.listEl.innerHTML = '';
    if (results.length === 0) {
      this.statusEl.textContent = q ? '▸ 无结果: ' + q : '';
      return;
    }
    this.statusEl.textContent = '▸ ' + results.length + ' 条命令';
    const self = this;
    for (const r of results) {
      const div = document.createElement('div');
      div.className = 'result-item';
      if (r.item.id === this.activeId) div.classList.add('active');
      let name = esc(r.item.cmd);
      if (q && r.field === 'cmd') {
        name = esc(r.item.cmd.slice(0, r.hitStart)) +
          '<span class="hl">' + esc(r.item.cmd.slice(r.hitStart, r.hitEnd)) + '</span>' +
          esc(r.item.cmd.slice(r.hitEnd));
      }
      div.innerHTML =
        '<span class="cmd-name">' + name + '</span>' +
        '<span class="cmd-desc">' + esc(r.item.desc) + '</span>' +
        '<span class="cmd-tag">' + esc(r.item.cat) + '</span>';
      div.addEventListener('click', () => { if (self.h.onSelect) self.h.onSelect(r.item); });
      this.listEl.appendChild(div);
    }
  };

  Panel.prototype.showDetail = function (item) {
    this.activeId = item.id;
    this.detailEmpty.classList.add('hidden');
    this.detailContent.classList.remove('hidden');
    const syntax = esc(item.syntax).replace(/&lt;([^&]+)&gt;/g, '<span class="arg">&lt;$1&gt;</span>');
    let argsHtml = '';
    if (item.args && item.args.length) {
      argsHtml = '<div class="detail-section">// 参数</div><table class="arg-table">' +
        item.args.map(a => '<tr><td>' + esc(a.name) + '</td><td>' + esc(a.desc || '') + '</td></tr>').join('') +
        '</table>';
    }
    const exHtml = '<div class="detail-section">// 示例</div><div class="ex-box">' +
      item.examples.map(e =>
        '<div class="ex-cmd">$ ' + esc(e.cmd) + '</div>' +
        (e.comment ? '<div class="ex-comment">  # ' + esc(e.comment) + '</div>' : '')
      ).join('') + '</div>';
    const self = this;
    this.detailContent.innerHTML =
      '<div class="detail-title">' + esc(item.cmd) + '</div>' +
      '<div class="detail-desc">' + esc(item.desc) + '</div>' +
      '<div class="detail-section">// 语法</div>' +
      '<div class="syntax-box">' + syntax + '</div>' +
      argsHtml + exHtml +
      '<button class="copy-btn">⧉ 复制命令</button>';
    this.detailContent.querySelector('.copy-btn').addEventListener('click', () => {
      const btn = self.detailContent.querySelector('.copy-btn');
      btn.classList.add('copied');
      btn.textContent = '✓ 已复制';
      setTimeout(() => { btn.classList.remove('copied'); btn.textContent = '⧉ 复制命令'; }, 1200);
      if (self.h.onCopy) self.h.onCopy(item);
    });
  };

  Panel.prototype.clearDetail = function () {
    this.activeId = '';
    this.detailContent.classList.add('hidden');
    this.detailEmpty.classList.remove('hidden');
  };

  if (typeof module !== 'undefined') module.exports = { Panel };
  window.Panel = window.Panel || { Panel };
})();
```

- [ ] **Step 4: 运行确认通过**

```bash
node test/panel.test.js
```

Expected: 全部 PASS。注意测试中 `setActiveCat`/`renderCats` 未直接调用，由 smoke 覆盖。

- [ ] **Step 5: Commit**

```bash
git add renderer/js/panel.js test/panel.test.js
git commit -m "feat: 面板 UI(列表/详情/高亮/复制)"
```

---

### Task 11: 主进程 main.js + preload.js

**Files:**
- Create: `main.js`
- Create: `preload.js`

- [ ] **Step 1: 创建 preload.js**

`preload.js`：

```js
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cliGuide', {
  loadCommands: () => ipcRenderer.invoke('commands:load'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (partial) => ipcRenderer.invoke('config:save', partial),
  copyText: (text) => ipcRenderer.invoke('clipboard:copy', text),
  togglePanel: () => ipcRenderer.invoke('panel:toggle'),
  hidePanel: () => ipcRenderer.invoke('panel:hide'),
  dragMove: (dx, dy) => ipcRenderer.invoke('window:drag-move', dx, dy),
  setLoginItem: (enabled) => ipcRenderer.invoke('login:set', enabled),
  openDataDir: () => ipcRenderer.invoke('data:open-dir'),
  quit: () => ipcRenderer.invoke('app:quit'),
  onWindowState: (cb) => ipcRenderer.on('window:state', (_e, state) => cb(state))
});
```

- [ ] **Step 2: 生成托盘图标（纯 Node 脚本，无外部依赖）**

Create: `scripts/gen-tray-icon.js`（16×16 矩阵绿方块 PNG 编码器）：

```js
'use strict';
/* 生成 16x16 矩阵绿托盘图标 (标准 PNG 编码, 无外部依赖) */
const zlib = require('zlib');
const fs = require('fs');
const W = 16, H = 16;
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0; // filter: none
  for (let x = 0; x < W; x++) {
    const o = y * (W * 4 + 1) + 1 + x * 4;
    const on = x >= 2 && x < 14 && y >= 2 && y < 14;
    raw[o] = 0; raw[o + 1] = on ? 255 : 0; raw[o + 2] = on ? 136 : 0; raw[o + 3] = on ? 255 : 0;
  }
}
function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0))
]);
fs.writeFileSync('resources/tray.png', png);
console.log('tray icon written: resources/tray.png');
```

运行：

```bash
node scripts/gen-tray-icon.js && file resources/tray.png
```

Expected: `tray icon written` + `resources/tray.png: PNG image data, 16 x 16`

- [ ] **Step 3: 创建 main.js**

`main.js`：

```js
'use strict';
/* CLI-GUIDE 主进程: 窗口状态机/全局快捷键/自启动/Tray/单实例/IPC */
const { app, BrowserWindow, globalShortcut, Tray, Menu, clipboard, ipcMain, screen, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { loadBuiltinCommands, loadUserCommands, mergeCommands, validateCommand } = require('./lib/commands');
const { defaultCompactBounds, computeExpandedBounds, interpolate, PET_W, PET_H } = require('./lib/layout');

const USER_DIR = path.join(os.homedir(), '.cli-guide');
const CONFIG_FILE = path.join(USER_DIR, 'config.json');
const USER_CMDS_DIR = path.join(USER_DIR, 'commands');
const PANEL_W = 760, PANEL_H = 560;
const HOTKEY = 'CommandOrControl+Shift+C';

let win = null;
let tray = null;
let state = 'compact';
let animTimer = null;

/* ---------- 配置 ---------- */
function loadConfig() {
  try { return Object.assign({ loginItem: false, hotkeyEnabled: true }, JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))); }
  catch (e) { return { loginItem: false, hotkeyEnabled: true }; }
}
function saveConfig(cfg) {
  fs.mkdirSync(USER_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

/* ---------- 用户数据目录初始化(首次复制内置库) ---------- */
function ensureUserData() {
  fs.mkdirSync(USER_CMDS_DIR, { recursive: true });
  const builtinDir = path.join(__dirname, 'resources', 'commands');
  for (const f of fs.readdirSync(builtinDir).filter(x => x.endsWith('.json'))) {
    const target = path.join(USER_CMDS_DIR, f);
    if (!fs.existsSync(target)) fs.copyFileSync(path.join(builtinDir, f), target);
  }
}

/* ---------- 窗口 ---------- */
function createWindow() {
  const cfg = loadConfig();
  const wa = screen.getPrimaryDisplay().workArea;
  const bounds = (cfg.x != null && cfg.y != null)
    ? { x: cfg.x, y: cfg.y, width: PET_W, height: PET_H }
    : defaultCompactBounds(wa);

  win = new BrowserWindow({
    ...bounds,
    frame: false, transparent: true, resizable: false, movable: true,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.on('blur', () => { if (state === 'expanded') collapse(); });
  win.on('closed', () => { win = null; });
}

/* ---------- 窗口状态机 ---------- */
function expand() {
  if (!win || state === 'expanded') return;
  state = 'expanded';
  const wa = screen.getDisplayMatching(win.getBounds()).workArea;
  const from = win.getBounds();
  const to = computeExpandedBounds(from, wa, { width: PANEL_W, height: PANEL_H });
  animateBounds(from, to, 220, () => {
    if (win) win.setBounds(to);
    broadcast();
  });
}
function collapse() {
  if (!win || state === 'compact') return;
  state = 'compact';
  const from = win.getBounds();
  const to = { x: from.x + from.width - PET_W, y: from.y + from.height - PET_H, width: PET_W, height: PET_H };
  animateBounds(from, to, 200, () => {
    if (win) win.setBounds(to);
    saveConfig({ ...loadConfig(), x: to.x, y: to.y });
    broadcast();
  });
}
function toggle() { (state === 'compact') ? expand() : collapse(); }
function animateBounds(from, to, ms, done) {
  if (animTimer) clearInterval(animTimer);
  const t0 = Date.now();
  animTimer = setInterval(() => {
    const t = Math.min(1, (Date.now() - t0) / ms);
    const e = interpolate(0, 1, t, 'easeOutCubic');
    if (win) win.setBounds({
      x: Math.round(interpolate(from.x, to.x, e)),
      y: Math.round(interpolate(from.y, to.y, e)),
      width: Math.round(interpolate(from.width, to.width, e)),
      height: Math.round(interpolate(from.height, to.height, e))
    });
    if (t >= 1) { clearInterval(animTimer); animTimer = null; if (done) done(); }
  }, 16);
}
function broadcast() { if (win) win.webContents.send('window:state', state); }

/* ---------- IPC ---------- */
ipcMain.handle('commands:load', () => {
  ensureUserData();
  const all = mergeCommands(loadBuiltinCommands(__dirname), loadUserCommands(USER_CMDS_DIR));
  return all;
});
ipcMain.handle('config:get', () => loadConfig());
ipcMain.handle('config:save', (_e, partial) => saveConfig({ ...loadConfig(), ...partial }));
ipcMain.handle('clipboard:copy', (_e, text) => clipboard.writeText(String(text)));
ipcMain.handle('panel:toggle', () => toggle());
ipcMain.handle('panel:hide', () => collapse());
ipcMain.handle('window:drag-move', (_e, dx, dy) => {
  if (!win) return;
  const b = win.getBounds();
  win.setPosition(Math.round(b.x + dx), Math.round(b.y + dy));
});
ipcMain.handle('login:set', (_e, enabled) => setLoginItem(enabled));
ipcMain.handle('data:open-dir', () => { ensureUserData(); shell.openPath(USER_CMDS_DIR); });
ipcMain.handle('app:quit', () => app.quit());

/* ---------- 全局快捷键 ---------- */
function setupHotkey() {
  const cfg = loadConfig();
  if (!cfg.hotkeyEnabled) return;
  try { globalShortcut.register(HOTKEY, toggle); } catch (e) { /* 注册失败静默 */ }
}

/* ---------- 托盘 ---------- */
function setupTray() {
  tray = new Tray(path.join(__dirname, 'resources', 'tray.png'));
  tray.setToolTip('CLI-GUIDE 命令手册');
  const refresh = () => {
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '▸ 展开 / 收起面板', click: () => toggle() },
      { type: 'separator' },
      {
        label: '开机自启动', type: 'checkbox', checked: loadConfig().loginItem,
        click: (item) => { setLoginItem(item.checked); refresh(); }
      },
      { label: '打开命令数据目录', click: () => shell.openPath(USER_CMDS_DIR) },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ]));
  };
  refresh();
}

/* ---------- 开机自启动(IPC 与 Tray 共用) ---------- */
function setLoginItem(enabled) {
  const ok = !!enabled;
  app.setLoginItemSettings({ openAtLogin: ok });
  saveConfig({ ...loadConfig(), loginItem: ok });
  return ok;
}

/* ---------- 单实例 ---------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { toggle(); win.focus(); } });
  app.whenReady().then(() => {
    app.dock.hide(); // 常驻工具类应用, 不占 Dock
    ensureUserData();
    createWindow();
    setupHotkey();
    setupTray();
  });
  app.on('window-all-closed', () => { /* 常驻, 不退出 */ });
  app.on('will-quit', () => globalShortcut.unregisterAll());
}
```

注意：`setLoginItem` 定义在托盘之后、IPC 段之前（函数声明提升，实际顺序无关）。IPC 段与 Tray 共用同一实现，无重复注册。

- [ ] **Step 4: 语法检查**

```bash
node --check main.js && node --check preload.js && node --check lib/commands.js && node --check lib/layout.js
```

Expected: 无输出（语法通过）。

- [ ] **Step 5: 手动启动验证**

```bash
cd /Users/lilinhua/Documents/study/k8s/cli-guide
npm start
```

Expected: 屏幕右下角出现终端脸桌宠（CSS 降级或 3D）；单击展开面板；Esc 收起；Cmd+Shift+C 切换；托盘图标出现。若 GUI 环境不可用，跳过本步，留待最终手动清单。

- [ ] **Step 6: Commit**

```bash
mkdir -p scripts
node scripts/gen-tray-icon.js
git add main.js preload.js scripts/gen-tray-icon.js resources/tray.png
git commit -m "feat: 主进程(窗口状态机/快捷键/自启动/托盘/IPC)"
```

---

### Task 12: 渲染层入口 + 全链路 smoke 测试

**Files:**
- Create: `renderer/js/main.js`
- Create: `test/smoke.test.js`

- [ ] **Step 1: 实现渲染层入口**

`renderer/js/main.js`：

```js
'use strict';
/* 渲染层入口: 装配桌宠/面板/数据/搜索 + 拖拽与键盘 */
(function () {
  const { Pet } = window.Pet;
  const { Panel } = window.Panel;

  const Main = {
    panel: null,
    pet: null,
    allCommands: [],
    results: [],
    activeIndex: 0,
    expanded: false,

    async init() {
      this.search = typeof window.searchCommands === 'function'
        ? window.searchCommands
        : null;

      this.panel = new Panel('panel-root', {
        onSearch: q => this.applyFilter(q),
        onSelect: item => this.panel.showDetail(item),
        onCopy: item => window.cliGuide.copyText(item.cmd),
        onArrow: dir => this.moveActive(dir),
        onEnter: () => this.copyActive(),
        onCategory: c => this.toggleCat(c)
      });
      this.pet = new Pet(document.getElementById('pet-root'));
      this.pet.onClick = () => window.cliGuide.togglePanel();
      this.pet.onDragStart = (dx, dy) => window.cliGuide.dragMove(dx, dy);
      this.pet.init();
      this.query = '';

      window.cliGuide.onWindowState((st) => this.setState(st));

      const data = await window.cliGuide.loadCommands();
      this.allCommands = data;
      window.CommandStore.setData(data);
      const cats = [...new Set(data.map(c => c.cat))];
      this.panel.setData(data);
      this.panel.renderCats(cats);
      this.applyFilter('');

      // Esc 收起
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.expanded) window.cliGuide.hidePanel();
      });
    },

    setState(st) {
      this.expanded = st === 'expanded';
      document.getElementById('panel-root').classList.toggle('hidden', !this.expanded);
      if (this.expanded) {
        const input = document.getElementById('search-input');
        input.focus();
        input.select();
      }
    },

    applyFilter(q) {
      this.query = q;
      this.results = this.search(this.allCommands, q, { cat: this.panel.activeCat });
      this.activeIndex = 0;
      this.panel.renderList(this.results, q);
      if (this.results.length) this.panel.showDetail(this.results[0].item);
      else this.panel.clearDetail();
    },

    moveActive(dir) {
      if (!this.results.length) return;
      this.activeIndex = (this.activeIndex + dir + this.results.length) % this.results.length;
      this.panel.showDetail(this.results[this.activeIndex].item);
      this.panel.renderList(this.results, this.query);
    },

    copyActive() {
      if (this.results[this.activeIndex]) window.cliGuide.copyText(this.results[this.activeIndex].item.cmd);
    },

    toggleCat(cat) {
      const next = this.panel.activeCat === cat ? '' : cat;
      this.panel.setActiveCat(next);
      this.applyFilter(this.query);
    }
  };

  window.Main = Main;
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => Main.init());
  }
  if (typeof module !== 'undefined') module.exports = { Main };
})();
```

- [ ] **Step 2: 写 smoke 测试（全链路：数据→搜索→面板→复制）**

`test/smoke.test.js`：

```js
'use strict';
/* 全链路冒烟: 桩 window.cliGuide + DOM, 验证 数据加载→搜索→面板→复制 */
const path = require('path');
const ROOT = path.join(__dirname, '..');

let fail = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name); if (!cond) fail++; };

/* ---- DOM 桩(同 panel.test.js 的最小版) ---- */
class FakeEl {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.dataset = {};
    this.style = {}; this._html = ''; this._text = ''; this.value = '';
    this._cls = new Set(); this._listeners = {};
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; this.children.length = 0; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = v; }
  appendChild(c) { this.children.push(c); return c; }
  remove() {}
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  dispatch(t, ev) { (this._listeners[t] || []).forEach(fn => fn(ev)); }
  focus() {} select() {}
  get classList() {
    return {
      add: (...c) => c.forEach(x => this._cls.add(x)),
      remove: (...c) => c.forEach(x => this._cls.delete(x)),
      contains: c => this._cls.has(c),
      toggle: (c, f) => f === undefined ? (this._cls.has(c) ? this._cls.delete(c) : this._cls.add(c)) : (f ? this._cls.add(c) : this._cls.delete(c))
    };
  }
  querySelector(sel) {
    const key = 'q:' + sel;
    if (!this._childMap) this._childMap = new Map();
    if (!this._childMap.has(key)) this._childMap.set(key, new FakeEl('div'));
    return this._childMap.get(key);
  }
  querySelectorAll() { return []; }
}
const els = {};
global.document = {
  getElementById: id => els[id] || (els[id] = new FakeEl('div')),
  createElement: t => new FakeEl(t),
  querySelector: s => new FakeEl('div'),
  addEventListener() {}, removeEventListener() {},
  body: new FakeEl('body')
};
global.window = global;
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};

/* ---- 桩 cliGuide ---- */
let copiedText = '';
global.cliGuide = {
  loadCommands: async () => {
    const { loadBuiltinCommands } = require('../lib/commands');
    return loadBuiltinCommands(ROOT);
  },
  copyText: async (t) => { copiedText = t; },
  togglePanel: async () => {}, hidePanel: async () => {}, dragMove: async () => {},
  onWindowState: (cb) => { global.__stateCb = cb; }
};

/* ---- 加载渲染层模块 ---- */
require(path.join(ROOT, 'renderer/js/search.js'));
require(path.join(ROOT, 'renderer/js/commands.js'));
require(path.join(ROOT, 'renderer/js/panel.js'));
require(path.join(ROOT, 'renderer/js/pet.js'));

/* ---- 运行入口(DOMContentLoaded 不会触发, 手动调用) ---- */
const { Main } = require(path.join(ROOT, 'renderer/js/main.js'));

(async () => {
  await Main.init();

  check('命令库加载(>=300 条)', Main.allCommands.length >= 300);
  check('CommandStore 数据入口可用', window.CommandStore.getAll().length >= 300);
  check('六个分类入口渲染', els['cat-bar'].children.length === 6);
  check('初始列表非空', Main.results.length === Main.allCommands.length);
  check('默认选中第一条', Main.activeIndex === 0 && Main.results[0] !== undefined);

  /* 搜索 */
  Main.applyFilter('kubectl');
  check('搜索 kubectl 命中', Main.results.length > 0 && Main.results.every(r => r.item.cmd.includes('kubectl') || (r.item.desc || '').includes('kubectl')));
  const firstId = Main.results[0].item.id;

  /* 分类过滤(先清空关键词, 否则 vim 分类搜 kubectl 为空) */
  Main.applyFilter('');
  Main.toggleCat('vim');
  check('分类过滤 vim', Main.results.length > 0 && Main.results.every(r => r.item.cat === 'vim'));
  Main.toggleCat('vim'); // 取消限定

  /* 键盘导航 + 复制 */
  Main.moveActive(1);
  check('方向键切换详情', Main.results[Main.activeIndex] && Main.activeIndex === 1);
  Main.copyActive();
  check('Enter 复制当前命令', copiedText === Main.results[1].item.cmd);

  /* 窗口状态广播 */
  global.__stateCb('expanded');
  check('展开时面板可见', !els['panel-root'].classList.contains('hidden'));
  global.__stateCb('compact');
  check('收起时面板隐藏', els['panel-root'].classList.contains('hidden'));

  /* pet 降级模式 */
  check('无 WebGL 环境 pet 降级', Main.pet.fallback === true);
  check('降级 CSS 桌宠显示', els['pet-fallback'] && !els['pet-fallback'].classList.contains('hidden'));

  /* 恢复搜索状态 */
  Main.applyFilter('kubectl');
  check('再次搜索 kubectl 正常', Main.results[0].item.id === firstId);

  console.log(fail === 0 ? '\n===== 全部通过 =====' : '\n===== 存在 ' + fail + ' 个失败 =====');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('SMOKE ERROR:', e); process.exit(1); });
```

注意：smoke 中 `Main.init()` 内部 `new Pet(...)` 会 `document.createElement('canvas')` 并 `getContext('2d')`——FakeEl 没有 getContext。**修正**：FakeEl 增加 `getContext() { return new Proxy({}, { get: () => () => {} }); }`，且 `Pet.init` 中 WebGLRenderer 构造会抛错进入 fallback（符合预期断言）。同时 `renderer/js/commands.js` 本任务需创建（Task 12 依赖它，但 smoke 只 require 它——它负责分类数据整理）。创建最小实现：

`renderer/js/commands.js`：

```js
'use strict';
/* 渲染层命令数据整理: 分类/索引 (数据由主进程经 IPC 提供) */
(function () {
  const CommandStore = {
    data: [],
    setData(list) { this.data = list; },
    getAll() { return this.data; },
    getCategories() { return [...new Set(this.data.map(c => c.cat))]; },
    getByCategory(cat) { return this.data.filter(c => c.cat === cat); }
  };
  if (typeof module !== 'undefined') module.exports = { CommandStore };
  window.CommandStore = window.CommandStore || { CommandStore };
})();
```

- [ ] **Step 3: 运行全部测试**

```bash
cd /Users/lilinhua/Documents/study/k8s/cli-guide
npm test
```

Expected: 五个测试文件全部 PASS，退出码 0。若 panel.test.js 或 smoke 有断言失败，按报错信息修复（常见问题：`querySelectorAll` 桩返回空数组导致 `setActiveCat` 空操作——可接受；`renderList` 中 `this.catBar.children[i].dataset.cat` 在桩下 children 为空——`setActiveCat` 仅在真实 DOM 生效，测试断言不依赖它）。

- [ ] **Step 4: Commit**

```bash
git add renderer/js/commands.js renderer/js/main.js test/smoke.test.js
git commit -m "feat: 渲染层装配 + 全链路冒烟测试"
```

---

### Task 13: README + 手动验证清单 + 收尾

**Files:**
- Create: `README.md`
- Modify: `package.json`（如有需要）

- [ ] **Step 1: 创建 README.md**

`README.md`（内容参考 helm-game README 风格，包含：项目简介、功能特性、安装运行、命令数据自定义、快捷键、项目结构、测试方法、常见问题）：

```markdown
# 👾 CLI-GUIDE — 黑客风终端脸桌宠命令行手册

> 一个常驻 macOS 桌面的 3D 终端脸桌宠: 点击唤起命令搜索面板,
> 快速检索 linux / k8s / helm / vim / 终端快捷键 / 办公常用 的常见用法, 一键复制。

![风格](docs-preview.png) <!-- 可自行替换为截图 -->

## ✨ 功能

- **3D 桌宠**: Three.js 渲染的"终端脸"——Matrix 字符流面部、发光方块眼睛、眨眼/浮动/点击惊吓动画
- **点击即查**: 单击桌宠弹出命令面板, 宽面板左右分栏, 悬停即见详情
- **实时搜索**: 命令名/描述/关键词模糊匹配, 命中高亮, ↑↓ 选择, Enter 复制
- **六分类**: linux / k8s / helm / vim / 终端快捷键 / 办公常用(git·docker·macOS·tmux), 共 350+ 条
- **自定义命令库**: 内置库首次启动复制到 `~/.cli-guide/commands/`, 直接编辑 JSON 即可增删改
- **全局快捷键**: `Cmd+Shift+C` 任意焦点唤起/收起
- **开机自启动**: 托盘菜单一键开关(默认关闭)
- **黑客神秘科技风**: 矩阵绿霓虹 / 深黑蓝底 / 扫描线 / 字符流动效

## 🚀 运行

```bash
npm install
npm start
```

## 🧪 测试

```bash
npm test
# commands / search / layout / panel / smoke 五个无头测试
```

## 📁 项目结构

(列出 main.js / preload.js / lib/ / resources/commands/ / renderer/ / test/ 职责)

## ⌨️ 操作

| 操作 | 效果 |
| --- | --- |
| 单击桌宠 / Cmd+Shift+C | 展开 / 收起面板 |
| 拖拽桌宠 | 移动位置(自动记忆) |
| Esc / 点击面板外 | 收起 |
| ↑↓ / Enter | 列表导航 / 复制命令 |
| 点击分类 chip | 限定分类搜索(再点取消) |

## 🛠 自定义命令

编辑 `~/.cli-guide/commands/*.json`, 字段说明见 docs。同名 id 覆盖内置。
```

- [ ] **Step 2: 手动验证清单（逐项勾选）**

```bash
npm start
```

| # | 验证项 | 预期 |
| --- | --- | --- |
| 1 | 启动后右下角出现桌宠 | 透明背景, 无边框 |
| 2 | 桌宠动画 | 浮动/眨眼/字符流 |
| 3 | 单击桌宠 | 窗口向左展开, 面板出现 |
| 4 | 搜索 kubectl | 列表实时过滤 + 高亮 |
| 5 | 点击左侧命令 | 右侧详情: 语法/参数/示例 |
| 6 | 点击 ⧉ 复制 | 剪贴板写入, 按钮变 ✓ |
| 7 | 点击分类 chip | 列表限定分类 |
| 8 | ↑↓ + Enter | 切换详情 + 复制 |
| 9 | Esc / 点击窗外 | 面板收起, 位置记忆 |
| 10 | Cmd+Shift+C | 任意焦点唤起/收起 |
| 11 | 拖拽桌宠 | 窗口跟随移动 |
| 12 | 托盘 → 开机自启动 | 开关生效(重启验证) |
| 13 | 编辑 ~/.cli-guide/commands/ 某 JSON 加一条 | 重启后搜索到新命令 |
| 14 | 再次启动应用 | 单实例, 聚焦已有窗口 |

- [ ] **Step 3: 最终提交**

```bash
git add README.md
git commit -m "docs: README + 使用说明"
git log --oneline
```

Expected: 13 个提交（Task 1~13 各一个）。

- [ ] **Step 4: 收尾自检**

```bash
npm test
node --check main.js && node --check preload.js
```

Expected: 全部 PASS / 无语法错误。确认 `.superpowers/`、`node_modules/` 未被 git 跟踪（`.gitignore` 已覆盖）。

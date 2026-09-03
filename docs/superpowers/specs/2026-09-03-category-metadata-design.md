# 分类元数据数据化管理 设计文档

日期：2026-09-03
状态：已与用户确认设计，待实施

## 1. 背景与目标

分类芯片的显示名（`docker 命令`/`办公常用`/`VSCode 快捷键` 等）硬编码在 `renderer/js/panel.js:4-10` 的 `CAT_LABELS`，分类白名单硬编码在 `lib/commands.js:6` 的 `CATS`。新增一个命令分类需要改两处代码。

目标：分类元数据（key、显示名、顺序）纳入命令 JSON 数据文件管理。用户在 `~/.cli-guide/commands/` 下新增分类 JSON 文件或修改文件内容后，重启应用即自动加载全部命令与分类，无需改代码。

### 已确认的决策

| 决策点 | 结论 |
|---|---|
| 编辑位置 | 仅 `~/.cli-guide/commands/`（用户数据目录，托盘菜单可打开）；命令本体重启加载现状已满足，无需动同步策略 |
| 元数据形态 | 内嵌在各分类 JSON 文件头部（包裹对象格式） |
| 芯片排序 | `meta.order` 升序；缺 `order` 的按文件名字母序追加末尾 |
| 实现路径 | 加载器统一解析并下发 `{ commands, categories }`；IPC 与 web 构建同步 |

### 现状要点（探索结论）

- 命令本体已是数据驱动：客户端 `loadBuiltinCommands`（lib/commands.js:22-30）与 web 构建（scripts/build-web.js:49-52）都遍历 `resources/commands/*.json` 全部文件。
- 渲染层分类 key 已从数据推导（renderer/js/main.js:50 `[...new Set(data.map(c => c.cat))]`）。
- 首次启动把内置 JSON 拷贝到 `~/.cli-guide/commands/`（仅当目标不存在，main.js:40）；加载时用户目录同 id 命令覆盖内置（lib/commands.js:44-49）。本设计不改此合并策略。

## 2. 数据格式

### 2.1 新格式（包裹对象）

内置 13 个文件全部迁移为：

```json
{
  "cat": "docker",
  "label": "docker 命令",
  "order": 7,
  "commands": [
    { "id": "docker-run", "cmd": "docker run", "cat": "docker", "...": "..." }
  ]
}
```

字段约定：

- `cat`（string，必填）：分类 key，须与文件内每条命令的 `cat` 字段一致。
- `label`（string，可选）：芯片显示名；缺省回退显示 `cat` 原文。
- `order`（number，可选）：芯片排序权重；缺省视为排在所有有 `order` 的分类之后。
- `commands`（array，必填）：原命令数组，条目结构不变。

现有 13 类的 `order` 编号 1-13，按当前 `CATS` 顺序（linux=1, k8s=2, helm=3, vim=4, terminal=5, office=6, docker=7, kafka=8, mysql=9, postgres=10, redis=11, vscode=12, idea=13），保持现状视觉不变。

### 2.2 旧格式兼容（纯数组）

纯数组文件视为旧格式：`{ meta: null, commands: 数组 }`。命令照常加载；无 meta 声明时，显示名与顺序由其他来源（内置 meta / 兜底规则）补齐。用户目录 `~/.cli-guide/commands/` 里已有的 13 个旧格式拷贝无需迁移、无需手工处理。

## 3. 加载与合并（lib/commands.js）

- `parseCommandFile(raw)`：JSON 解析后的统一归一化。`Array.isArray(raw)` → `{ meta: null, commands: raw }`；对象 → `{ meta: { cat, label, order, file }, commands: raw.commands }`。
- `loadBuiltinCommands(dir)` 返回值升级为 `{ commands, categories }`；解析失败保持现状（抛错，随包分发的可信数据 fail fast）。
- `loadUserCommands(dir)` 返回值升级为 `{ commands, categories }`；非法 JSON 跳过（现状）；**meta 非法**（cat 缺失/类型错/与命令不一致）时该文件按无 meta 处理，命令照常加载，`console.warn` 提示，不阻塞启动。
- `mergeCommands(builtin, user)`：不变（同 id 用户覆盖内置）。
- 新增 `mergeCategories(builtin, user)`：按 key 合并，用户声明覆盖内置；排序规则 = 有 `order` 升序在前，无 `order` 的按 key 字母序追加；`order` 相同的按 key 字母序。
- 兜底：合并后的命令数据中存在、但任何 meta 都未声明的 cat，视为无 `order`，与无 `order` 的声明合并后统一按 key 字母序排在末尾，形态为 `{ key, label: key }`，保证芯片永不丢失。
- 移除 `CATS` 硬编码导出。

## 4. IPC 与渲染层

- main.js `commands:load`（main.js:134-138）返回 `{ commands, categories }`；categories 为主进程排好序的 `[{ key, label }]`，渲染层零排序逻辑。
- renderer/js/panel.js：删除 `CAT_LABELS`（panel.js:4-10）；`renderCats(cats)` 入参从 key 字符串数组改为 `[{ key, label }]`，芯片文本用 `label`；点击回调仍传 `key`，`toggleCat`/搜索过滤逻辑不变。
- renderer/js/main.js init（main.js:47-52）：`const { commands, categories } = await window.cliGuide.loadCommands()`，`renderCats(categories)`。
- preload.js：透传，不改。

## 5. Web 版同步

- scripts/build-web.js：按同样解析规则处理目录，注入 `window.__COMMANDS__`（命令扁平数组，保持不变）与新增 `window.__CATEGORIES__`（已排序 `[{ key, label }]`）。
- web/cli-guide-web.js shim：`loadCommands` 返回 `{ commands: window.__COMMANDS__, categories: window.__CATEGORIES__ }`，与客户端返回结构一致。

## 6. 校验与测试

- `validateCommand`：cat 校验从 `CATS` 白名单改为「非空字符串」；其余字段校验不变。
- 新增 `validateFileMeta(meta, commands)`：meta 存在时校验 cat 非空、与全部命令条目的 cat 一致、label 为字符串（可缺省）、order 为数字（可缺省）。
- test/commands.test.js：全量校验改为动态收集合法 cat（读目录所有文件的 meta 与命令）；新增用例——新格式解析、旧数组格式兼容、`mergeCategories` 排序（order 缺省字母序追加）、未声明 cat 兜底、label 回退、非法 meta 降级。
- test/panel.test.js：`renderCats` 断言改为 `[{ key, label }]` 入参与 label 文本渲染。
- test/smoke.test.js：IPC 桩 `loadCommands` 返回新结构。
- test/build-web.test.js：新增断言 `window.__CATEGORIES__` 已内联且 13 类齐全。

## 7. 错误处理

- 用户目录非法 JSON：跳过该文件（现状）。
- 用户目录 meta 非法：按无 meta 处理，命令照常加载，`console.warn`，不阻塞启动。
- 内置文件解析失败：抛错（现状，fail fast）。
- 未声明 cat 的命令：自动追加兜底芯片（见 §3）。

## 8. 范围外（明确不做）

- 图标/颜色/描述等扩展 meta 字段。
- 运行中热重载、文件系统监听（重启生效即可）。
- 内置库与用户目录的版本同步策略（本设计不改 `ensureUserData` 行为）。

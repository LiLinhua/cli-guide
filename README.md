# 👾 CLI-GUIDE — 黑客风终端脸桌宠命令行手册

> 一个常驻桌面的 3D 终端脸桌宠（支持 **macOS / Windows**）: 点击唤起命令搜索面板,
> 快速检索 **14 大分类 695 条命令 · 4622 个示例**常用命令/快捷键用法, 一键复制。

## ✨ 功能

- **3D 桌宠**: Three.js 渲染的"终端脸"——Matrix 字符流面部、发光方块眼睛、眨眼/浮动/点击惊吓动画；无 WebGL 自动降级 CSS 版本
- **点击即查**: 单击桌宠弹出命令面板, 宽面板左右分栏, 左侧列表右侧详情
- **实时搜索**: 命令名/描述/标签模糊匹配, 命中高亮, ↑↓ 选择, Enter 复制
- **示例丰富**: 每条命令 2-7 个示例, 按命令参数逐项覆盖单用/组合/管道/进阶用法, 即查即用
- **14 大分类**:
  - 系统运维: `linux` / `docker` / `kafka` / `mysql` / `postgres` / `redis`
  - 云原生: `k8s` / `helm`
  - 前端开发: `前端命令` (npm/pnpm/vite/next/nuxt/vue/tsc/eslint/tailwind/vitest/playwright...)
  - 编辑器: `vim` / `VSCode 快捷键` / `IDEA 快捷键`
  - 其他: `终端快捷键` / `办公常用(git·macOS·tmux)`
- **自定义命令库**: 内置库首次启动复制到 `~/.cli-guide/commands/`, 直接编辑 JSON 即可增删改
- **全局快捷键**: `Cmd+Shift+C`（macOS）/ `Ctrl+Shift+C`（Windows）任意焦点唤起/收起
- **开机自启动**: 托盘菜单一键开关(默认关闭)
- **黑客神秘科技风**: 矩阵绿霓虹 / 深黑蓝底 / 扫描线 / 字符流动效

## 🚀 运行

### 客户端版 (Electron, 推荐)

```bash
npm install
npm start
```

- `npm install` 使用 `registry.npmmirror.com`，并通过 `postinstall`（`scripts/ensure-electron.js`）从国内镜像拉取 Electron 二进制，适合受限网络
- 首次启动后命令数据会自动复制到 `~/.cli-guide/commands/`（14 个 JSON 文件；Windows 为 `%USERPROFILE%\.cli-guide\commands\`）

### Web 版 (浏览器, 零安装)

> 适合无法安装应用的受限环境：构建为**单个 HTML 文件**，用浏览器直接打开即可体验全部功能（桌宠 3D/面板/搜索/分类/复制），与客户端版共用同一份命令数据与渲染层代码。

```bash
npm run build:web
# 生成 dist/cli-guide-web.html (1202 KB, 695 条命令 · 4622 示例)
```

然后**双击 `dist/cli-guide-web.html`** 用 Chrome / Edge / Safari 打开即可。

Web 版与客户端版的差异：

| 能力 | 客户端版 | Web 版 |
| --- | --- | --- |
| 3D 桌宠 / 面板 / 搜索 / 复制 | ✅ | ✅ (面板常驻居中, 无桌宠) |
| 全局快捷键 Cmd/Ctrl+Shift+C | ✅ (任意焦点) | ✅ (页面内焦点) |
| 开机自启动 / 托盘 | ✅ | ✅ 自启动 (Chrome 应用模式, 见下方) / ❌ 托盘 |
| 窗口拖动 / 位置记忆 | ✅ (系统级) | ❌ (固定居中) |
| 自定义命令库 | ✅ `~/.cli-guide/commands/` | ❌ (内置库, 与客户端一致) |

> ⚠️ Web 版复制命令依赖浏览器剪贴板权限；若被拦截会自动降级为传统复制方式。

### Web 版桌面常驻 (Chrome 应用模式 + 开机自启动)

> **适用场景**: 公司电脑被终端管控软件(如云壳)拦截自研 Electron 应用时, 客户端版无法运行。
> 此方案用 Chrome 的"应用窗口模式"把 Web 版包装成独立桌面窗口——走 Chrome 进程不受管控,
> 面板常驻屏幕居中, 且支持开机自启动。

**1. 构建 Web 版**

```bash
npm run build:web
# 生成 dist/cli-guide-web.html
```

**2. 创建启动器**(一次性, 生成 `~/Applications/CLI-GUIDE-Web.app`)

> ⚠️ 注意: 此启动器是 **Web 版启动器**(AppleScript 轻量壳, 内部仅调用 Chrome 应用模式打开 Web 版 HTML),
> 与 Electron 客户端安装包(`/Applications/CLI-GUIDE.app`)完全无关, **无需安装客户端**即可使用。

```bash
mkdir -p ~/Applications
osacompile -o ~/Applications/CLI-GUIDE-Web.app -e 'do shell script "open -na \"/Applications/Google Chrome.app\" --args --app=\"file://<项目绝对路径>/dist/cli-guide-web.html\" --user-data-dir=\"$HOME/.cli-guide/chrome-profile\" --window-size=900,700"'
```

把 `<项目绝对路径>` 替换为实际路径(如 `/Users/xxx/Documents/study/k8s/cli-guide`)。

**3. 手动启动**(任选其一)

| 方式 | 操作 |
| --- | --- |
| Spotlight | `Cmd+Space` → 输入 `CLI-GUIDE-Web` → 回车 |
| 双击 | Finder 前往 `~/Applications` → 双击 `CLI-GUIDE-Web` |
| 终端别名 | `cli-guide`(可自行写入 `~/.zshrc`) |
| 终端命令 | 见下方完整命令 |

**4. 开机自启动**(登录项)

- **GUI**: 系统设置 → 通用 → 登录项 → "登录时打开" → `+` → 选择 `~/Applications/CLI-GUIDE-Web.app`
- **命令行**: `osascript -e 'tell application "System Events" to make login item at end with properties {path:"/Users/<用户名>/Applications/CLI-GUIDE-Web.app", hidden:false}'`

**5. 完整启动命令与参数说明**

```bash
open -na "/Applications/Google Chrome.app" --args \
  --app="file://<项目绝对路径>/dist/cli-guide-web.html" \
  --user-data-dir="$HOME/.cli-guide/chrome-profile" \
  --window-size=900,700
```

- `--app=file://...` → 无地址栏独立窗口(Web 版面板常驻居中, 无桌宠)
- `--user-data-dir=...` → 独立 Chrome profile, 与日常浏览器互不影响(**必带**, 否则会合并进已运行的 Chrome 导致 `--app` 失效)
- `--window-size=900,700` → 窗口尺寸, 面板最大 880×640 自适应居中

**常驻模式交互**: 面板常驻屏幕居中, 无桌宠; `Esc` 不收起; `Cmd/Ctrl+Shift+C` 切换面板显示/隐藏。

## 📦 打包安装包

`npm run dist` 会按**当前系统**打包（Windows 上打 Windows，macOS 上打 macOS）。也可显式指定平台：

```bash
# 当前系统
npm run dist

# 仅 Windows（需在 Windows 上执行）
npm run dist:win
# 产物:
#   release/CLI-GUIDE Setup <版本>.exe   NSIS 安装包（可改安装目录）
#   release/CLI-GUIDE <版本>.exe         绿色免安装版

# 仅 macOS（需在 macOS 上执行）
npm run dist:mac
# 产物:
#   release/CLI-GUIDE-<版本>-arm64.dmg
#   release/CLI-GUIDE-<版本>-arm64-mac.zip
```

**Windows**

- **Setup exe**: 双击安装，可自选安装目录，并创建桌面/开始菜单快捷方式
- **便携 exe**: 免安装，双击即用
- 未做代码签名时，SmartScreen 可能提示未知应用：选「仍要运行」即可
- 默认打 **x64**

**macOS**

- **dmg**: 双击挂载后把 CLI-GUIDE 拖入 Applications 即可
- **zip**: 解压即得 CLI-GUIDE.app，同样拖入 Applications
- 应用未做代码签名，首次打开若被 Gatekeeper 拦截：**右键 → 打开**，或执行 `xattr -cr /Applications/CLI-GUIDE.app`
- 默认打 **arm64**（Apple Silicon）；Intel Mac 用 `npx electron-builder --mac --x64`

**通用说明**

- 构建配置在 `package.json` 的 `build` 字段；macOS 图标为 `build/icon.icns`，Windows 图标为 `resources/icon-1024.png`
- **受限网络友好**: 已配置 `electronDist` 复用本地 Electron 二进制；`ensure-electron.js` 默认走 npmmirror

## 🧪 测试

```bash
npm test
# commands / search / layout / panel / smoke / build-web 六个无头测试, 全绿
```

## 📁 项目结构

| 路径 | 职责 |
| --- | --- |
| `main.js` | Electron 主进程: 窗口状态机/全局快捷键/开机自启动/托盘/单实例/IPC |
| `preload.js` | contextBridge 暴露 `window.cliGuide` API |
| `lib/commands.js` | 命令数据层: 双格式解析(数组/带分类元数据对象)/内置库加载/用户库合并/校验/分类元数据合并 |
| `lib/layout.js` | 窗口布局: 展开方向翻转/小屏钳制/缓动插值 |
| `resources/commands/*.json` | 14 个分类内置命令库 (695 条命令 · 4622 示例) |
| `renderer/index.html` | 页面骨架 (桌宠区 + 面板区) |
| `renderer/css/style.css` | 黑客风样式 |
| `renderer/js/pet.js` | 3D 终端脸桌宠 (Three.js, 降级 CSS) |
| `renderer/js/panel.js` | 面板 UI: 搜索框/分类 chip/列表/详情/复制 |
| `renderer/js/search.js` | 搜索算法: 子串匹配/优先级/分类过滤 |
| `renderer/js/commands.js` | 渲染层数据整理 (CommandStore) |
| `renderer/js/main.js` | 渲染层入口: 装配各模块 + 交互 |
| `test/` | 六个无头测试 (纯 Node, 无框架) |
| `web/cli-guide-web.js` | Web 版 cliGuide shim (替代 Electron IPC) |
| `scripts/gen-tray-icon.js` | 生成托盘图标 (纯 Node, 无外部依赖) |
| `scripts/ensure-electron.js` | postinstall: 从 npmmirror 下载 Electron 二进制 |
| `scripts/build-web.js` | 构建单文件 Web 版 → `dist/cli-guide-web.html` |
| `.npmrc` | npm 源：`registry.npmmirror.com` |

## ⌨️ 操作

| 操作 | 效果 |
| --- | --- |
| 单击桌宠 / Cmd+Shift+C（macOS）/ Ctrl+Shift+C（Windows） | 展开 / 收起面板 |
| 右键桌宠 | 弹出右键菜单(展开/收起、隐身、开机自启动、数据目录、退出), 面板展开时同样可用 |
| 拖拽桌宠 | 移动位置(自动记忆) |
| Esc / 点击面板外 | 收起 |
| 点击面板左上角红点 | 收起面板 |
| 点击面板左上角绿点 | 放大 / 还原命令窗口 |
| ↑↓ / Enter | 列表导航 / 复制命令 |
| 点击分类 chip | 限定分类搜索(再点取消) |

## 🛠 自定义命令

编辑 `~/.cli-guide/commands/*.json`, 支持两种格式, 修改后重启应用生效:

**格式一: 补充命令**(JSON 数组, 向已有分类追加或按 `id` 覆盖内置):

```json
[
  {
    "id": "my-ls", "cmd": "ls -lh", "cat": "linux", "desc": "人类可读大小列目录",
    "syntax": "ls [-lh] [path]", "args": [{ "name": "-h", "desc": "容量单位" }],
    "examples": [{ "cmd": "ls -lh", "comment": "查看当前目录" }], "tags": ["目录"]
  }
]
```

字段: `id`(全局唯一, 同名覆盖内置) / `cmd` / `cat`(所属分类 key) / `desc` / `syntax` / `args`(`{name, desc}` 数组) / `examples`(`{cmd, comment}` 数组) / `tags`(数组)。

**格式二: 新增分类**(JSON 对象, 重启后自动出现新分类 chip):

```json
{
  "cat": "git",
  "label": "git 命令",
  "order": 14,
  "commands": [
    {
      "id": "git-status", "cmd": "git status", "cat": "git", "desc": "查看工作区状态",
      "syntax": "git status [-s]", "args": [{ "name": "-s", "desc": "简短输出" }],
      "examples": [{ "cmd": "git status", "comment": "查看状态" }], "tags": ["git"]
    }
  ]
}
```

字段: `cat`(分类 key, 唯一) / `label`(chip 显示文案, 缺省显示 `cat` 值) / `order`(chip 排序序号, 缺省排在末尾按名称排序) / `commands`(格式同上, 条目 `cat` 需与本文件 `cat` 一致)。

> ⚠️ **升级提示**: 内置库只在首次启动时复制到用户目录, 之后以用户目录为准。应用升级后如需获取内置库修正(如快捷键勘误), 删除 `~/.cli-guide/commands/` 下对应 JSON 文件, 重启后自动重新复制。

## ❓ 常见问题

- **桌宠没有 3D 效果?** 显卡不支持 WebGL 时自动降级为 CSS 终端脸, 功能不变。
- **找不到托盘图标?** macOS 在菜单栏右上角；Windows 在任务栏托盘（可能收纳在 `^` 中），绿色方块图标。
- **开机自启动后没生效?** macOS 首次会询问辅助功能权限, 在 系统设置 → 隐私与安全性 中允许；Windows 可在托盘菜单开关，或到「设置 → 应用 → 启动」中确认。
- **Windows 安装被拦截?** 未签名安装包触发 SmartScreen 时选「更多信息 → 仍要运行」。
- **`npm install` 很慢?** 确认使用项目内 `.npmrc`（npmmirror）；Electron 由 `postinstall` 拉镜像，勿手动改回 GitHub 直连。

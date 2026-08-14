# 👾 CLI-GUIDE — 黑客风终端脸桌宠命令行手册

> 一个常驻 macOS 桌面的 3D 终端脸桌宠: 点击唤起命令搜索面板,
> 快速检索 **13 大分类 505 条命令 · 2129 个示例**常用命令/快捷键用法, 一键复制。

## ✨ 功能

- **3D 桌宠**: Three.js 渲染的"终端脸"——Matrix 字符流面部、发光方块眼睛、眨眼/浮动/点击惊吓动画；无 WebGL 自动降级 CSS 版本
- **点击即查**: 单击桌宠弹出命令面板, 宽面板左右分栏, 左侧列表右侧详情
- **实时搜索**: 命令名/描述/标签模糊匹配, 命中高亮, ↑↓ 选择, Enter 复制
- **示例丰富**: 每条命令 2-7 个示例, 按命令参数逐项覆盖单用/组合/管道/进阶用法, 即查即用
- **13 大分类**:
  - 系统运维: `linux` / `docker` / `kafka` / `mysql` / `postgres` / `redis`
  - 云原生: `k8s` / `helm`
  - 编辑器: `vim` / `VSCode 快捷键` / `IDEA 快捷键`
  - 其他: `终端快捷键` / `办公常用(git·macOS·tmux)`
- **自定义命令库**: 内置库首次启动复制到 `~/.cli-guide/commands/`, 直接编辑 JSON 即可增删改
- **全局快捷键**: `Cmd+Shift+C` 任意焦点唤起/收起
- **开机自启动**: 托盘菜单一键开关(默认关闭)
- **黑客神秘科技风**: 矩阵绿霓虹 / 深黑蓝底 / 扫描线 / 字符流动效

## 🚀 运行

### 客户端版 (Electron, 推荐)

```bash
npm install
npm start
```

首次启动后命令数据会自动复制到 `~/.cli-guide/commands/`（13 个 JSON 文件）。

### Web 版 (浏览器, 零安装)

> 适合无法安装应用的受限环境：构建为**单个 HTML 文件**，用浏览器直接打开即可体验全部功能（桌宠 3D/面板/搜索/分类/复制），与客户端版共用同一份命令数据与渲染层代码。

```bash
npm run build:web
# 生成 dist/cli-guide-web.html (927 KB, 505 条命令 · 2129 示例)
```

然后**双击 `dist/cli-guide-web.html`** 用 Chrome / Edge / Safari 打开即可。

Web 版与客户端版的差异：

| 能力 | 客户端版 | Web 版 |
| --- | --- | --- |
| 3D 桌宠 / 面板 / 搜索 / 复制 | ✅ | ✅ (面板常驻居中, 无桌宠) |
| 全局快捷键 Cmd+Shift+C | ✅ (任意焦点) | ✅ (页面内焦点) |
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

## 📦 打包 macOS 安装包

```bash
npm run dist
# 产物: release/CLI-GUIDE-<版本>-arm64.dmg (推荐) + release/CLI-GUIDE-<版本>-arm64-mac.zip
```

- **dmg**: 双击挂载后把 CLI-GUIDE 拖入 Applications 即可（自动打开安装目录视图）
- **zip**: 解压即得 CLI-GUIDE.app，同样拖入 Applications
- 应用未做代码签名（个人开发者证书），首次打开若被 Gatekeeper 拦截：**右键 → 打开**，或终端执行 `xattr -cr /Applications/CLI-GUIDE.app` 解除隔离
- 默认打 **arm64**（Apple Silicon M 系列）；Intel Mac 需指定 `npx electron-builder --mac --x64`
- 构建配置在 `package.json` 的 `build` 字段；应用图标由 `scripts/gen-app-icon.js` 生成（终端脸风格，可自定义后重新生成 icns）
- **受限网络友好**: 已配置 `electronDist` 复用本地 Electron 二进制，打包全程不下载网络依赖

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
| `lib/commands.js` | 命令数据层: 内置库加载/用户库合并/校验/CATS 分类定义 |
| `lib/layout.js` | 窗口布局: 展开方向翻转/小屏钳制/缓动插值 |
| `resources/commands/*.json` | 13 个分类内置命令库 (505 条命令 · 2129 示例) |
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
| `scripts/build-web.js` | 构建单文件 Web 版 → `dist/cli-guide-web.html` |

## ⌨️ 操作

| 操作 | 效果 |
| --- | --- |
| 单击桌宠 / Cmd+Shift+C | 展开 / 收起面板 |
| 拖拽桌宠 | 移动位置(自动记忆) |
| Esc / 点击面板外 | 收起 |
| ↑↓ / Enter | 列表导航 / 复制命令 |
| 点击分类 chip | 限定分类搜索(再点取消) |

## 🛠 自定义命令

编辑 `~/.cli-guide/commands/*.json`, 字段: `id`(唯一) / `cmd`(命令或快捷键) / `cat`(分类) / `desc` / `syntax` / `args` / `examples` / `tags`。`examples` 为 `{cmd, comment}` 对象数组, 内置库每条命令已按 `args` 参数覆盖 2-7 个示例(单参数/组合/管道/进阶用法)。同名 id 覆盖内置。修改后重启应用生效。

> ⚠️ **升级提示**: 内置库只在首次启动时复制到用户目录, 之后以用户目录为准。应用升级后如需获取内置库修正(如快捷键勘误), 删除 `~/.cli-guide/commands/` 下对应 JSON 文件, 重启后自动重新复制。

## ❓ 常见问题

- **桌宠没有 3D 效果?** 显卡不支持 WebGL 时自动降级为 CSS 终端脸, 功能不变。
- **找不到托盘图标?** 状态栏(菜单栏)右上角, 绿色方块图标。
- **开机自启动后没生效?** macOS 首次会询问辅助功能权限, 在 系统设置 → 隐私与安全性 中允许。

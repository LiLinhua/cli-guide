# 👾 CLI-GUIDE — 黑客风终端脸桌宠命令行手册

> 一个常驻 macOS 桌面的 3D 终端脸桌宠: 点击唤起命令搜索面板,
> 快速检索 **13 大分类 505 条**常用命令/快捷键用法, 一键复制。

## ✨ 功能

- **3D 桌宠**: Three.js 渲染的"终端脸"——Matrix 字符流面部、发光方块眼睛、眨眼/浮动/点击惊吓动画；无 WebGL 自动降级 CSS 版本
- **点击即查**: 单击桌宠弹出命令面板, 宽面板左右分栏, 左侧列表右侧详情
- **实时搜索**: 命令名/描述/标签模糊匹配, 命中高亮, ↑↓ 选择, Enter 复制
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
# 生成 dist/cli-guide-web.html (809 KB, 505 条命令)
```

然后**双击 `dist/cli-guide-web.html`** 用 Chrome / Edge / Safari 打开即可。

Web 版与客户端版的差异：

| 能力 | 客户端版 | Web 版 |
| --- | --- | --- |
| 3D 桌宠 / 面板 / 搜索 / 复制 | ✅ | ✅ |
| 全局快捷键 Cmd+Shift+C | ✅ (任意焦点) | ✅ (页面内焦点) |
| 开机自启动 / 托盘 | ✅ | ❌ (浏览器无此能力) |
| 窗口拖动 / 位置记忆 | ✅ (系统级) | ✅ (页面内拖动, 刷新复位) |
| 自定义命令库 | ✅ `~/.cli-guide/commands/` | ❌ (内置库, 与客户端一致) |

> ⚠️ Web 版复制命令依赖浏览器剪贴板权限；若被拦截会自动降级为传统复制方式。

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
| `resources/commands/*.json` | 13 个分类内置命令库 (505 条) |
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

编辑 `~/.cli-guide/commands/*.json`, 字段: `id`(唯一) / `cmd`(命令或快捷键) / `cat`(分类) / `desc` / `syntax` / `args` / `examples` / `tags`。同名 id 覆盖内置。修改后重启应用生效。

> ⚠️ **升级提示**: 内置库只在首次启动时复制到用户目录, 之后以用户目录为准。应用升级后如需获取内置库修正(如快捷键勘误), 删除 `~/.cli-guide/commands/` 下对应 JSON 文件, 重启后自动重新复制。

## ❓ 常见问题

- **桌宠没有 3D 效果?** 显卡不支持 WebGL 时自动降级为 CSS 终端脸, 功能不变。
- **找不到托盘图标?** 状态栏(菜单栏)右上角, 绿色方块图标。
- **开机自启动后没生效?** macOS 首次会询问辅助功能权限, 在 系统设置 → 隐私与安全性 中允许。

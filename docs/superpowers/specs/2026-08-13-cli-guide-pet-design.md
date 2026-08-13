# CLI-GUIDE 设计 — 黑客风终端脸桌宠命令手册

> 日期：2026-08-13
> 状态：已确认
> 目标：macOS 桌面上一个以 3D 桌宠形式常驻的命令行手册指南客户端

## 背景与目标

开发者经常记不住命令行用法。本应用以"终端脸"3D 桌宠形式常驻 macOS 桌面，点击唤起命令搜索面板，快速检索 linux / k8s / helm / vim / 终端快捷键 / 办公常用 / docker / kafka / mysql / postgres / redis / VSCode 快捷键 / IDEA 快捷键等开发常用命令的常见用法，支持一键复制。整体风格为黑客神秘科技风（矩阵绿霓虹 + 深黑蓝底）。

## 关键决策（已与用户确认）

| 决策点 | 选择 |
| --- | --- |
| 技术栈 | Electron + Three.js |
| 桌宠形态 | D · 终端脸（终端窗口形状，字符流面部 + 发光方块眼睛） |
| 交互方式 | A · 悬浮面板（桌宠旁弹出命令入口面板） |
| 命令详情布局 | B · 宽面板左右分栏（左列表 + 右详情） |
| 数据源 | 内置命令库 + 用户可扩展（~/.cli-guide/commands/） |
| 命令分类 | 13 类：linux / k8s / helm / vim / 终端快捷键 / 办公常用（git、macOS 快捷键、iTerm、tmux）/ docker（含 docker compose）/ kafka / mysql / postgres / redis / VSCode 快捷键 / IDEA 快捷键 |
| 全局快捷键 | 需要，Cmd+Shift+C 唤起/收起 |
| 开机自启动 | 支持配置，默认关闭，托盘/设置中开关 |
| 窗口架构 | 单 BrowserWindow 扩展（compact 150×150 ↔ expanded 760×560） |

## 1. 总体架构

- **主进程（main.js）**：窗口管理、全局快捷键、开机自启动、托盘菜单、单实例锁、命令库文件读写
- **渲染进程**：Three.js 3D 桌宠（pet.js）+ DOM 面板 UI（panel.js）
- **preload.js**：contextBridge 安全暴露 IPC（命令库读取/合并、config 读写、剪贴板、窗口控制）
- **单 BrowserWindow**：无边框（frame: false）、透明（transparent: true）、置顶（alwaysOnTop: 'screen-saver'）、可拖拽
- **窗口状态机**：
  - `compact` 态：150×150，仅桌宠，默认停靠屏幕右下角上方，位置记忆于 config
  - `expanded` 态：760×560，桌宠移至左侧，右侧展开面板，带弹性过渡动画
  - 展开方向智能翻转：靠近右边缘向左展开，靠近底部向上展开，保证面板完整可见
- **点击穿透**：compact 态下桌面其他区域不受影响（透明区域不拦截鼠标）；桌宠本体可拖拽移动窗口

## 2. 桌宠 3D — "终端脸"

- **主体**：圆角扁平盒子模拟终端窗口 + 顶部三个发光圆点（红黄绿 traffic lights），程序化几何体建模，零外部模型依赖
- **面部**：CanvasTexture 动态绘制字符流（Matrix 效果），两个绿色发光方块作为"眼睛"
- **动画**（requestAnimationFrame 驱动）：
  - 悬浮浮动（sin 位移 + 呼吸缩放）
  - 眨眼（眼睛 scaleY 周期性压缩）
  - 眼睛跟随鼠标方向微转
  - 闲置打字（字符流速度变化）
  - 点击"惊吓"弹跳反馈
- **渲染**：自发光材质（MeshBasicMaterial，矩阵绿 #00ff88）+ 辉光 sprite（TextureLoader 生成径向渐变），不使用后处理保持轻量

## 3. 交互流程

- **唤起**：单击桌宠 / 全局快捷键 Cmd+Shift+C（任意焦点下）
- **面板结构**：
  - 标题栏：红黄绿圆点 + `> CLI_GUIDE` 字样
  - 搜索框：`❯` 前缀 + 闪烁光标
  - 分类入口：linux / k8s / helm / vim / 终端快捷键 / 办公 / docker / kafka / mysql / postgres / redis / VSCode / IDEA（13 个，可换行展示）
  - 左右分栏：左 = 搜索结果列表（命令名 + 一句话描述 + 难度/常用标签），右 = 详情预览
- **搜索**：实时过滤（命令名 / 描述 / 关键词模糊匹配，命中高亮），`↑↓` 选择，`Enter` 复制命令到剪贴板。搜索框默认全局搜索（跨全部 13 个分类）；点击分类入口后结果限定该分类，可在分类内叠加关键词继续过滤；再次点击同一分类取消限定
- **详情**：语法高亮（命令绿 / 参数琥珀 / 注释暗）、参数说明列表、使用示例代码块、⧉ 一键复制按钮
- **收起**：Esc / 再次点击桌宠 / 点击窗外失焦

## 4. 数据层

- **内置命令库**：`resources/commands/` 下按分类 13 个 JSON（linux / k8s / helm / vim / terminal / office / docker / kafka / mysql / postgres / redis / vscode / idea），每类 20~80 条，总量约 550 条
- **k8s / helm** 数据从现有 k8s-game、helm-game 题库提炼补充
- **数据格式**：
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
- **用户扩展**：首次启动复制内置库到 `~/.cli-guide/commands/`，用户可编辑增删改；启动时合并（用户文件覆盖同名 id）
- **搜索实现**：内存过滤（小数据量无需索引库），对 cmd/desc/tags 做大小写不敏感子串匹配

## 5. 系统集成

- **开机自启动**：`app.setLoginItemSettings`，开关存 `~/.cli-guide/config.json`，默认关闭
- **全局快捷键**：`globalShortcut.register('CommandOrControl+Shift+C')`，注册失败时提示用户
- **托盘菜单（Tray）**：展开面板、开机自启动开关（勾选态）、打开数据目录、关于、退出
- **单实例锁**：`app.requestSingleInstanceLock`，二次启动时聚焦已有实例
- **配置**：`~/.cli-guide/config.json` 保存窗口位置、自启动开关、全局快捷键启用状态

## 6. 视觉风格 — 黑客神秘科技

- **配色**：深黑蓝底 #050a14、矩阵绿 #00ff88 主色、青色 #00e5ff 点缀、琥珀 #ffaa55 警告/参数色、灰绿文字 #9fdcc0
- **字体**：等宽字体栈（Menlo, 'SF Mono', monospace），标题加字距大写
- **效果**：扫描线 + 网格背景（CSS 渐变实现）、霓虹描边 + 外发光、字符流/打字机动效
- **面板**：半透明毛玻璃（backdrop-filter: blur）+ 霓虹边框（box-shadow 发光）

## 7. 测试

- **数据层测试**（test/commands.test.js）：内置 JSON 合法性与完整性（必需字段、id 唯一、分类覆盖）
- **搜索测试**（test/search.test.js）：子串匹配、大小写不敏感、关键词命中、空输入全列表
- **无头冒烟**：沿用现有游戏项目 test/ 模式（Node 直接跑，jsdom 模拟 DOM）
- **手动验证清单**：透明点击穿透、拖拽移动、展开/收起动画、全局快捷键、自启动开关、用户自定义命令生效、位置记忆

## 8. 项目结构

```
cli-guide/
├── package.json           # Electron + 启动脚本
├── main.js                # 主进程（窗口/快捷键/自启动/Tray/单实例）
├── preload.js             # IPC 安全桥（contextBridge）
├── resources/
│   └── commands/          # 内置命令库（13 个分类 JSON）
│       ├── linux.json  k8s.json  helm.json
│       ├── vim.json  terminal.json  office.json
│       └── docker.json  kafka.json  mysql.json
│           postgres.json  redis.json  vscode.json  idea.json
├── renderer/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── pet.js         # Three.js 终端脸桌宠
│       ├── panel.js       # 面板 UI（搜索/列表/详情）
│       ├── search.js      # 搜索算法
│       ├── commands.js    # 命令库加载/合并/用户扩展
│       └── main.js        # 渲染进程入口
└── test/
    ├── commands.test.js
    └── search.test.js
```

## 9. 明确不做（YAGNI）

- 不做在线命令库拉取/更新（数据固定内置 + 用户手改）
- 不做多桌宠/皮肤系统
- 不做云同步
- 不做付费/账户体系

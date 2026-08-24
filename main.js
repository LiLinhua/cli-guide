'use strict';
/* CLI-GUIDE 主进程: 窗口状态机/全局快捷键/自启动/Tray/单实例/IPC */
const { app, BrowserWindow, globalShortcut, Tray, Menu, clipboard, ipcMain, screen, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { loadBuiltinCommands, loadUserCommands, mergeCommands } = require('./lib/commands');
const { defaultCompactBounds, computeExpandedBounds, computeStealthBounds, interpolate, PET_W, PET_H, STEALTH_SIZE } = require('./lib/layout');

const USER_DIR = path.join(os.homedir(), '.cli-guide');
const CONFIG_FILE = path.join(USER_DIR, 'config.json');
const USER_CMDS_DIR = path.join(USER_DIR, 'commands');
const PANEL_W = 760, PANEL_H = 560;
const HOTKEY = 'CommandOrControl+Shift+Z';

let win = null;
let tray = null;
let state = 'compact';
let animTimer = null;
let _compactBeforeStealth = null;
let _stealthPreview = false;

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
  win.setVisibleOnAllWorkspaces(true);
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
    if (_stealthPreview) {
      // 临时预览: 收起面板后继续隐身贴边
      _stealthPreview = false;
      _compactBeforeStealth = { x: to.x, y: to.y, width: PET_W, height: PET_H };
      const wa = screen.getDisplayMatching(to).workArea;
      const stealthBounds = computeStealthBounds(to, wa);
      state = 'invisible';
      broadcast();
      win.setBounds(stealthBounds);
    } else {
      saveConfig({ ...loadConfig(), x: to.x, y: to.y });
      broadcast();
    }
  });
}
function toggle() {
  if (state === 'invisible') {
    if (!win) return;
    _stealthPreview = true;
    const compactBounds = _compactBeforeStealth || defaultCompactBounds(screen.getPrimaryDisplay().workArea);
    const wa = screen.getDisplayMatching(compactBounds).workArea;
    const to = computeExpandedBounds(compactBounds, wa, { width: PANEL_W, height: PANEL_H });
    animateBounds(win.getBounds(), to, 220, () => {
      if (win) win.setBounds(to);
      state = 'expanded';
      broadcast();
    });
  } else {
    (state === 'compact') ? expand() : collapse();
  }
}
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
  if (animTimer) { clearInterval(animTimer); animTimer = null; } // 拖拽中断展开/收起动画, 避免位置被拉回
  const b = win.getBounds();
  win.setPosition(Math.round(b.x + dx), Math.round(b.y + dy));
});
ipcMain.handle('login:set', (_e, enabled) => setLoginItem(enabled));
ipcMain.handle('data:open-dir', () => { ensureUserData(); shell.openPath(USER_CMDS_DIR); });
ipcMain.handle('app:quit', () => app.quit());
ipcMain.handle('pet:stealth', () => {
  if (!win || state !== 'compact') return;
  _compactBeforeStealth = win.getBounds();
  saveConfig({ ...loadConfig(), x: _compactBeforeStealth.x, y: _compactBeforeStealth.y });
  const wa = screen.getDisplayMatching(_compactBeforeStealth).workArea;
  const to = computeStealthBounds(_compactBeforeStealth, wa);
  state = 'invisible';
  broadcast(); // 动画开始前同步状态, 防止竞态
  animateBounds(_compactBeforeStealth, to, 200, () => {
    if (win) win.setBounds(to);
  });
});
ipcMain.handle('pet:show', () => {
  if (!win || state !== 'invisible') return;
  _stealthPreview = true;
  const to = _compactBeforeStealth || defaultCompactBounds(screen.getPrimaryDisplay().workArea);
  animateBounds(win.getBounds(), to, 200, () => {
    if (win) win.setBounds(to);
    state = 'compact';
    broadcast();
  });
});
ipcMain.handle('pet:unstealth', () => {
  return new Promise((resolve) => {
    if (!win || state !== 'invisible') { resolve(); return; }
    _stealthPreview = false;
    const to = _compactBeforeStealth || defaultCompactBounds(screen.getPrimaryDisplay().workArea);
    win.setBounds(to); // 即时恢复 compact 位置, 无需动画
    state = 'compact';
    _compactBeforeStealth = null;
    broadcast();
    resolve();
  });
});
ipcMain.handle('menu:open', () => {
  if (!win) return;
  if (state === 'expanded' || state === 'invisible') return; // 已展开/隐身, 无需扩窗
  const b = win.getBounds();
  const wa = screen.getDisplayMatching(b).workArea;
  const menuW = 180;
  let newW = PET_W + menuW;
  let newX = b.x;
  if (newX + newW > wa.x + wa.width) {
    newX = wa.x + wa.width - newW;
  }
  win.setBounds({ x: newX, y: b.y, width: newW, height: PET_H });
});
ipcMain.handle('menu:close', () => {
  if (!win) return;
  if (state === 'expanded' || state === 'invisible') return; // 已展开/隐身, 不缩回
  const b = win.getBounds();
  // 恢复 compact: 保持右边缘对齐
  win.setBounds({ x: b.x + b.width - PET_W, y: b.y, width: PET_W, height: PET_H });
});

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
  app.on('will-quit', () => {
    if (win && (state === 'compact' || state === 'invisible')) {
      const b = state === 'invisible' ? (_compactBeforeStealth || win.getBounds()) : win.getBounds();
      saveConfig({ ...loadConfig(), x: b.x, y: b.y });
    }
    globalShortcut.unregisterAll();
  });
}

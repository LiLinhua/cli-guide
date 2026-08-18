'use strict';
/* Web 版 cliGuide shim: 浏览器环境替代 Electron preload 的 IPC API
 * 由 scripts/build-web.js 内联进 dist/cli-guide-web.html, 与客户端版共用
 * renderer/js/main.js 及全部渲染层代码, 数据来自内联的 window.__COMMANDS__
 * Web 版形态: 无桌宠, 面板常驻屏幕居中 (覆盖样式 WEB_CSS 负责定位),
 * shim 只负责状态切换 (展开/收起) 与系统 API 兜底 */
(function () {
  const stateCbs = [];
  let expanded = true; // Web 版启动即显示面板
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem('cli-guide-cfg') || '{}'); } catch (e) { /* 忽略损坏配置 */ }

  function panelEl() { return document.getElementById('panel-root'); }

  function syncPanel() {
    const panel = panelEl();
    if (panel) panel.classList.toggle('hidden', !expanded);
  }

  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
    document.body.removeChild(ta);
  }

  window.cliGuide = {
    loadCommands: () => Promise.resolve(window.__COMMANDS__ || []),
    getConfig: () => Promise.resolve(cfg),
    saveConfig: (partial) => {
      Object.assign(cfg, partial);
      try { localStorage.setItem('cli-guide-cfg', JSON.stringify(cfg)); } catch (e) { /* 隐私模式忽略 */ }
      return Promise.resolve();
    },
    copyText: (text) => {
      const t = String(text);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(t).catch(() => { legacyCopy(t); });
      }
      legacyCopy(t);
      return Promise.resolve();
    },
    togglePanel: () => {
      expanded = !expanded;
      syncPanel();
      stateCbs.forEach(cb => cb(expanded ? 'expanded' : 'compact'));
      return Promise.resolve();
    },
    hidePanel: () => {
      // Web 版面板常驻: 禁用 Esc 收起 (仅 Cmd/Ctrl+Shift+Z 可切换)
      return Promise.resolve();
    },
    dragMove: () => Promise.resolve(), // 无桌宠, 无拖拽
    setLoginItem: () => Promise.resolve(false), // 浏览器无开机自启动
    openDataDir: () => Promise.resolve(),
    quit: () => Promise.resolve(),
    onWindowState: (cb) => {
      stateCbs.push(cb);
      cb(expanded ? 'expanded' : 'compact'); // 订阅即推送当前状态快照, 同步 main.js 初始 expanded
    }
  };

  // 页面内快捷键: Cmd/Ctrl+Shift+Z 切换面板显示 (客户端版为全局快捷键)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'Z' || e.key === 'z')) {
      e.preventDefault();
      window.cliGuide.togglePanel();
    }
  });

  // shim 内联在 <head>, 需等 DOM 就绪再显示面板 (启动即展开)
  function boot() { syncPanel(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

'use strict';
/* Web 版 cliGuide shim: 浏览器环境替代 Electron preload 的 IPC API
 * 由 scripts/build-web.js 内联进 dist/cli-guide-web.html, 与客户端版共用
 * renderer/js/main.js 及全部渲染层代码, 数据来自内联的 window.__COMMANDS__ */
(function () {
  const stateCbs = [];
  let expanded = false;
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem('cli-guide-cfg') || '{}'); } catch (e) { /* 忽略损坏配置 */ }
  const drag = { x: 0, y: 0, restore: null };

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

  function syncPanel() {
    const app = document.getElementById('app');
    if (app) {
      app.classList.toggle('expanded', expanded);
      if (drag.restore) { clearTimeout(drag.restore); drag.restore = null; }
      app.style.transition = '';
    }
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
      expanded = false;
      syncPanel();
      stateCbs.forEach(cb => cb('compact'));
      return Promise.resolve();
    },
    dragMove: (dx, dy) => {
      drag.x += dx;
      drag.y += dy;
      const app = document.getElementById('app');
      if (app) {
        app.style.transition = 'none'; // 拖拽时禁用展开动画过渡, 避免滞后
        app.style.transform = 'translate(' + drag.x + 'px,' + drag.y + 'px)';
        if (drag.restore) clearTimeout(drag.restore);
        drag.restore = setTimeout(() => { app.style.transition = ''; drag.restore = null; }, 250);
      }
      return Promise.resolve();
    },
    setLoginItem: () => Promise.resolve(false), // 浏览器无开机自启动
    openDataDir: () => Promise.resolve(),
    quit: () => Promise.resolve(),
    onWindowState: (cb) => { stateCbs.push(cb); }
  };

  // 页面内快捷键: Cmd/Ctrl+Shift+C 唤起/收起 (客户端版为全局快捷键)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
      e.preventDefault();
      window.cliGuide.togglePanel();
    }
  });
})();

'use strict';
/* Web 版 cliGuide shim: 浏览器环境替代 Electron preload 的 IPC API
 * 由 scripts/build-web.js 内联进 dist/cli-guide-web.html, 与客户端版共用
 * renderer/js/main.js 及全部渲染层代码, 数据来自内联的 window.__COMMANDS__
 * 布局语义与客户端 lib/layout.js 一致: 右下角锚点 + 向左/向上展开 + 视口钳制 */
(function () {
  const stateCbs = [];
  let expanded = false;
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem('cli-guide-cfg') || '{}'); } catch (e) { /* 忽略损坏配置 */ }

  const PET_W = 150, PET_H = 150, PANEL_W = 760, PANEL_H = 560, MARGIN = 16, EDGE = 8;
  const drag = { x: 0, y: 0, restore: null };
  const anchor = { x: 0, y: 0 };

  function appEl() { return document.getElementById('app'); }

  // 锚点 = 视口右下角 (与 CSS right/bottom 初始值一致), 视口变化时重算
  function updateAnchor() {
    anchor.x = window.innerWidth - MARGIN - PET_W;
    anchor.y = window.innerHeight - MARGIN - PET_H;
  }

  // 桌宠位置: 右下角锚点 + 拖拽偏移 (left/top 定位, 钳制在视口内)
  function applyPet() {
    const app = appEl();
    if (!app) return;
    app.style.right = 'auto';
    app.style.bottom = 'auto';
    app.style.left = (anchor.x + drag.x) + 'px';
    app.style.top = (anchor.y + drag.y) + 'px';
  }

  function syncPanel() {
    const app = appEl();
    if (!app) return;
    app.classList.toggle('expanded', expanded);
    if (expanded) {
      // 与客户端 computeExpandedBounds 同语义: 面板右/底边缘对齐桌宠, 再钳制视口
      const petX = anchor.x + drag.x;
      const petY = anchor.y + drag.y;
      let left = petX + PET_W - PANEL_W;
      let top = petY + PET_H - PANEL_H;
      left = Math.max(EDGE, Math.min(left, window.innerWidth - PANEL_W - EDGE));
      top = Math.max(EDGE, Math.min(top, window.innerHeight - PANEL_H - EDGE));
      app.style.right = 'auto';
      app.style.bottom = 'auto';
      app.style.left = left + 'px';
      app.style.top = top + 'px';
    } else {
      applyPet();
    }
    if (drag.restore) { clearTimeout(drag.restore); drag.restore = null; }
    app.style.transition = '';
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
      expanded = false;
      syncPanel();
      stateCbs.forEach(cb => cb('compact'));
      return Promise.resolve();
    },
    dragMove: (dx, dy) => {
      drag.x += dx;
      drag.y += dy;
      // 钳制桌宠在视口内 (与客户端窗口移动同语义)
      drag.x = Math.max(-anchor.x + EDGE, Math.min(drag.x, window.innerWidth - PET_W - EDGE - anchor.x));
      drag.y = Math.max(-anchor.y + EDGE, Math.min(drag.y, window.innerHeight - PET_H - EDGE - anchor.y));
      const app = appEl();
      if (app) {
        app.style.transition = 'none'; // 拖拽时禁用展开动画过渡, 避免滞后
        applyPet();
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

  // 视口变化(窗口缩放)时重算锚点: 展开态重新摆放面板, 收起态跟随桌宠
  window.addEventListener('resize', () => {
    updateAnchor();
    if (expanded) syncPanel(); else applyPet();
  });
  updateAnchor();
  applyPet();

  // 页面内快捷键: Cmd/Ctrl+Shift+C 唤起/收起 (客户端版为全局快捷键)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
      e.preventDefault();
      window.cliGuide.togglePanel();
    }
  });
})();

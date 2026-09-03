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
    _stealthed: false,
    _lastInteraction: Date.now(),
    _stealthTimerId: null,
    _ctxMenu: null,
    _ctxBackdrop: null,

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
      this.pet.onClick = () => {
        this._trackInteraction();
        window.cliGuide.togglePanel();
      };
      this.pet.onDragStart = (dx, dy) => {
        this._trackInteraction();
        window.cliGuide.dragMove(dx, dy);
      };
      this.pet.init();
      this.query = '';

      window.cliGuide.onWindowState((st) => this.setState(st));

      const { commands, categories } = await window.cliGuide.loadCommands();
      this.allCommands = commands;
      window.CommandStore.setData(commands);
      this.panel.setData(commands);
      this.panel.renderCats(categories);
      this.applyFilter('');

      // 右键菜单
      this._createContextMenu();
      this._createStealthBar();
      document.getElementById('pet-root').addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._showContextMenu();
      });
      // 点击/拖拽桌宠时关闭菜单(click 事件在拖拽时不触发, 用 mousedown)
      document.getElementById('pet-root').addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (this._ctxMenu && !this._ctxMenu.classList.contains('hidden')) {
          this._hideContextMenu();
        }
      });

      // Esc 收起
      document.addEventListener('keydown', (e) => {
        if (this._ctxMenu && !this._ctxMenu.classList.contains('hidden')) {
          if (e.key === 'Escape') this._hideContextMenu();
          return;
        }
        if (e.key === 'Escape' && this.expanded) window.cliGuide.hidePanel();
      });

      // 右键菜单: 左键点击菜单外部关闭(mousedown 比 click 更底层, 适配透明窗口)
      document.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (!this._ctxMenu || this._ctxMenu.classList.contains('hidden')) return;
        if (!e.target.closest('#pet-context-menu')) {
          this._hideContextMenu();
        }
      });

      this._resetStealthTimer();
    },

    setState(st) {
      // 状态切换时自动关闭右键菜单(全局快捷键/托盘展开面板时菜单不残留)
      if (this._ctxMenu && !this._ctxMenu.classList.contains('hidden')) {
        this._hideContextMenu();
      }
      this.expanded = st === 'expanded';
      this._stealthed = st === 'invisible';
      document.getElementById('panel-root').classList.toggle('hidden', !this.expanded);
      // 桌宠内容与隐身条切换
      const petRoot = document.getElementById('pet-root');
      if (petRoot) petRoot.classList.toggle('hidden', this._stealthed);
      if (this._stealthBar) this._stealthBar.classList.toggle('hidden', !this._stealthed);
      // 更新桌宠动画
      if (this.pet && this.pet.setStealth) this.pet.setStealth(this._stealthed);
      // 更新隐身菜单文字
      const stealthLabel = document.getElementById('ctx-stealth-label');
      if (stealthLabel) stealthLabel.textContent = this._stealthed ? '取消隐身' : '隐身';
      // 管理隐身计时器
      if (this._stealthed) {
        this._stopStealthTimer();
      } else if (st === 'compact') {
        this._resetStealthTimer();
      } else if (this.expanded) {
        this._stopStealthTimer();
        if (this.pet) this.pet.fireLaser();
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
    },

    /* ---------- 右键菜单 ---------- */
    _createContextMenu() {
      // 遮罩层: 捕获透明区域点击(alpha>0 阻止 macOS 事件穿透)
      const backdrop = document.createElement('div');
      backdrop.id = 'ctx-menu-backdrop';
      backdrop.className = 'hidden';
      backdrop.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        this._hideContextMenu();
      });
      document.getElementById('app').appendChild(backdrop);
      this._ctxBackdrop = backdrop;

      const el = document.createElement('div');
      el.id = 'pet-context-menu';
      el.className = 'hidden';
      el.innerHTML = `
        <div class="ctx-item" data-action="toggle">
          <span class="ctx-icon">▸</span>
          <span>展开 / 收起面板</span>
        </div>
        <div class="ctx-separator"></div>
        <div class="ctx-item" data-action="stealth-toggle">
          <span class="ctx-icon">◉</span>
          <span id="ctx-stealth-label">隐身</span>
        </div>
        <div class="ctx-separator"></div>
        <div class="ctx-item" data-action="login">
          <span class="ctx-check" id="ctx-login-check"></span>
          <span>开机自启动</span>
        </div>
        <div class="ctx-item" data-action="data">
          <span class="ctx-icon"></span>
          <span>打开命令数据目录</span>
        </div>
        <div class="ctx-separator"></div>
        <div class="ctx-item" data-action="quit">
          <span class="ctx-icon"></span>
          <span>退出</span>
        </div>
      `;
      el.addEventListener('click', (e) => {
        const item = e.target.closest('.ctx-item');
        if (!item) return;
        this._handleCtxAction(item.dataset.action);
      });
      document.getElementById('app').appendChild(el);
      this._ctxMenu = el;
    },

    async _showContextMenu() {
      this._trackInteraction();
      // 如果隐身中, 先取消隐身再弹菜单
      if (this._stealthed) {
        await window.cliGuide.unstealth();
      }
      const config = await window.cliGuide.getConfig();
      const check = document.getElementById('ctx-login-check');
      if (check) check.textContent = config.loginItem ? '✓' : '';
      const stealthLabel = document.getElementById('ctx-stealth-label');
      if (stealthLabel) stealthLabel.textContent = this._stealthed ? '取消隐身' : '隐身';
      // expanded 时隐藏隐身菜单项
      const stealthItem = document.querySelector('[data-action="stealth-toggle"]');
      if (stealthItem) stealthItem.style.display = this.expanded ? 'none' : '';
      if (!this._ctxMenu.classList.contains('hidden')) return; // 菜单已显示(重复右键), 仅刷新上面内容
      // 先渲染但不可见, 实测菜单高度(内容随隐身项显隐变化), 供主进程扩窗; 否则底部菜单项被窗口裁剪
      this._ctxMenu.classList.remove('hidden');
      this._ctxMenu.style.visibility = 'hidden';
      const menuH = Math.ceil(this._ctxMenu.getBoundingClientRect().height);
      const r = await window.cliGuide.showMenu(menuH); // 扩窗容纳菜单(含高度)
      // 等待扩窗期间状态可能已切换(快捷键展开面板等), 此时不显示菜单
      if (this.expanded || this._stealthed) {
        this._ctxMenu.classList.add('hidden');
        this._ctxMenu.style.visibility = '';
        window.cliGuide.hideMenu();
        return;
      }
      this._ctxMenu.style.visibility = '';
      // 窗口上移(贴底弹菜单)时补偿桌宠偏移, 保持屏幕位置不跳
      document.getElementById('pet-root').style.top = (r && r.dy < 0) ? String(-r.dy) + 'px' : '';
      this._ctxBackdrop.classList.remove('hidden');
    },

    _hideContextMenu() {
      this._ctxBackdrop.classList.add('hidden');
      this._ctxMenu.classList.add('hidden');
      document.getElementById('pet-root').style.top = ''; // 清除菜单期偏移
      window.cliGuide.hideMenu(); // 恢复 compact
    },

    _handleCtxAction(action) {
      this._hideContextMenu();
      switch (action) {
        case 'toggle': window.cliGuide.togglePanel(); break;
        case 'stealth-toggle':
          if (this._stealthed) {
            window.cliGuide.unstealth();
          } else {
            window.cliGuide.stealth();
          }
          break;
        case 'login': {
          window.cliGuide.getConfig().then(cfg => {
            window.cliGuide.setLoginItem(!cfg.loginItem);
          });
          break;
        }
        case 'data': window.cliGuide.openDataDir(); break;
        case 'quit': window.cliGuide.quit(); break;
      }
    },

    /* ---------- 隐身贴边 ---------- */
    _createStealthBar() {
      const bar = document.createElement('div');
      bar.id = 'stealth-bar';
      bar.className = 'hidden';
      bar.innerHTML = '<span class="stealth-dot"></span>';
      bar.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._showContextMenu();
      });

      // 拖拽 + 左键点击处理
      let _drag = null;
      let _dragged = false;
      bar.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        _drag = { x: e.screenX, y: e.screenY };
        _dragged = false;
        bar.classList.add('dragging');
      });
      document.addEventListener('mousemove', (e) => {
        if (!_drag) return;
        const dx = e.screenX - _drag.x;
        const dy = e.screenY - _drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) {
          _dragged = true;
          window.cliGuide.dragMove(dx, dy);
          _drag.x = e.screenX;
          _drag.y = e.screenY;
        }
      });
      document.addEventListener('mouseup', () => {
        if (!_drag) return;
        if (!_dragged && this._stealthed) window.cliGuide.showPet();
        _drag = null;
        bar.classList.remove('dragging');
      });

      document.getElementById('app').appendChild(bar);
      this._stealthBar = bar;
    },

    /* ---------- 隐身计时器 ---------- */
    _trackInteraction() {
      this._lastInteraction = Date.now();
    },
    _resetStealthTimer() {
      this._stopStealthTimer();
      this._lastInteraction = Date.now();
      this._stealthTimerId = setInterval(() => {
        if (this._stealthed || this.expanded) return;
        if (Date.now() - this._lastInteraction >= 180000) {
          window.cliGuide.stealth();
        }
      }, 1000);
    },
    _stopStealthTimer() {
      if (this._stealthTimerId) {
        clearInterval(this._stealthTimerId);
        this._stealthTimerId = null;
      }
    }
  };

  window.Main = Main;
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => Main.init());
  }
  if (typeof module !== 'undefined') module.exports = { Main };
})();

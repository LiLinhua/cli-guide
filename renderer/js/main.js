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
      this.pet.onClick = () => window.cliGuide.togglePanel();
      this.pet.onDragStart = (dx, dy) => window.cliGuide.dragMove(dx, dy);
      this.pet.init();
      this.query = '';

      window.cliGuide.onWindowState((st) => this.setState(st));

      const data = await window.cliGuide.loadCommands();
      this.allCommands = data;
      window.CommandStore.setData(data);
      const cats = [...new Set(data.map(c => c.cat))];
      this.panel.setData(data);
      this.panel.renderCats(cats);
      this.applyFilter('');

      // 右键菜单
      this._createContextMenu();
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
    },

    setState(st) {
      this.expanded = st === 'expanded';
      document.getElementById('panel-root').classList.toggle('hidden', !this.expanded);
      if (this.expanded) {
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
      const config = await window.cliGuide.getConfig();
      const check = document.getElementById('ctx-login-check');
      if (check) check.textContent = config.loginItem ? '✓' : '';
      this._ctxBackdrop.classList.remove('hidden');
      this._ctxMenu.classList.remove('hidden');
      window.cliGuide.showMenu(); // 扩窗容纳菜单
    },

    _hideContextMenu() {
      this._ctxBackdrop.classList.add('hidden');
      this._ctxMenu.classList.add('hidden');
      window.cliGuide.hideMenu(); // 恢复 compact
    },

    _handleCtxAction(action) {
      this._hideContextMenu();
      switch (action) {
        case 'toggle': window.cliGuide.togglePanel(); break;
        case 'login': {
          window.cliGuide.getConfig().then(cfg => {
            window.cliGuide.setLoginItem(!cfg.loginItem);
          });
          break;
        }
        case 'data': window.cliGuide.openDataDir(); break;
        case 'quit': window.cliGuide.quit(); break;
      }
    }
  };

  window.Main = Main;
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => Main.init());
  }
  if (typeof module !== 'undefined') module.exports = { Main };
})();

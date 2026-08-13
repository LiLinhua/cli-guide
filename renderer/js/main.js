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

      // Esc 收起
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.expanded) window.cliGuide.hidePanel();
      });
    },

    setState(st) {
      this.expanded = st === 'expanded';
      document.getElementById('panel-root').classList.toggle('hidden', !this.expanded);
      if (this.expanded) {
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
    }
  };

  window.Main = Main;
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => Main.init());
  }
  if (typeof module !== 'undefined') module.exports = { Main };
})();

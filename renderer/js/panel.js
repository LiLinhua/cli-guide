'use strict';
/* 面板 UI: 搜索框/分类/列表/详情/复制 (渲染层, 无框架) */
(function () {
  const CAT_LABELS = {
    linux: 'linux 命令', k8s: 'k8s 命令', helm: 'helm 命令',
    vim: 'vim 命令', terminal: '终端快捷键', office: '办公常用',
    docker: 'docker 命令', kafka: 'kafka 命令', mysql: 'mysql 命令',
    postgres: 'postgres 命令', redis: 'redis 命令',
    vscode: 'VSCode 快捷键', idea: 'IDEA 快捷键'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function Panel(rootId, handlers) {
    this.h = handlers || {};
    this.root = document.getElementById(rootId);
    this.searchInput = document.getElementById('search-input');
    this.catBar = document.getElementById('cat-bar');
    this.listEl = document.getElementById('result-list');
    this.statusEl = document.getElementById('list-status');
    this.detailContent = document.getElementById('detail-content');
    this.detailEmpty = document.getElementById('detail-empty');
    this.activeCat = '';
    this.items = [];
    this.activeId = '';
    this._bind();
  }

  Panel.prototype._bind = function () {
    const self = this;
    this.searchInput.addEventListener('input', () => {
      if (self.h.onSearch) self.h.onSearch(this.searchInput.value);
    });
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (self.h.onArrow) self.h.onArrow(e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Enter') {
        if (self.h.onEnter) self.h.onEnter();
      }
    });
  };

  Panel.prototype.setData = function (items) { this.items = items; };

  Panel.prototype.renderCats = function (cats) {
    const self = this;
    this.catBar.innerHTML = '';
    for (const c of cats) {
      const chip = document.createElement('div');
      chip.className = 'cat-chip';
      chip.dataset.cat = c;
      chip.textContent = CAT_LABELS[c] || c;
      chip.addEventListener('click', () => { if (self.h.onCategory) self.h.onCategory(c); });
      this.catBar.appendChild(chip);
    }
  };

  Panel.prototype.setActiveCat = function (cat) {
    this.activeCat = cat;
    const chips = this.catBar.querySelectorAll('.cat-chip');
    chips.forEach((chip, i) => {
      const isActive = this.catBar.children[i] && this.catBar.children[i].dataset.cat === cat;
      chip.classList.toggle('active', !!isActive);
    });
  };

  Panel.prototype.renderList = function (results, query) {
    const q = (query || '').trim().toLowerCase();
    this.listEl.innerHTML = '';
    if (results.length === 0) {
      this.statusEl.textContent = q ? '▸ 无结果: ' + q : '';
      return;
    }
    this.statusEl.textContent = '▸ ' + results.length + ' 条命令';
    const self = this;
    for (const r of results) {
      const div = document.createElement('div');
      div.className = 'result-item';
      if (r.item.id === this.activeId) div.classList.add('active');
      let name = esc(r.item.cmd);
      if (q && r.field === 'cmd') {
        name = esc(r.item.cmd.slice(0, r.hitStart)) +
          '<span class="hl">' + esc(r.item.cmd.slice(r.hitStart, r.hitEnd)) + '</span>' +
          esc(r.item.cmd.slice(r.hitEnd));
      }
      div.innerHTML =
        '<span class="cmd-name">' + name + '</span>' +
        '<span class="cmd-desc">' + esc(r.item.desc) + '</span>' +
        '<span class="cmd-tag">' + esc(r.item.cat) + '</span>';
      div.addEventListener('click', () => { if (self.h.onSelect) self.h.onSelect(r.item); });
      this.listEl.appendChild(div);
    }
  };

  Panel.prototype.showDetail = function (item) {
    this.activeId = item.id;
    this.detailEmpty.classList.add('hidden');
    this.detailContent.classList.remove('hidden');
    const syntax = esc(item.syntax).replace(/&lt;([^&]+)&gt;/g, '<span class="arg">&lt;$1&gt;</span>');
    let argsHtml = '';
    if (item.args && item.args.length) {
      argsHtml = '<div class="detail-section">// 参数</div><table class="arg-table">' +
        item.args.map(a => '<tr><td>' + esc(a.name) + '</td><td>' + esc(a.desc || '') + '</td></tr>').join('') +
        '</table>';
    }
    const exHtml = '<div class="detail-section">// 示例</div><div class="ex-box">' +
      item.examples.map(e =>
        '<div class="ex-cmd">$ ' + esc(e.cmd) + '</div>' +
        (e.comment ? '<div class="ex-comment">  # ' + esc(e.comment) + '</div>' : '')
      ).join('') + '</div>';
    const self = this;
    this.detailContent.innerHTML =
      '<div class="detail-title">' + esc(item.cmd) + '</div>' +
      '<div class="detail-desc">' + esc(item.desc) + '</div>' +
      '<div class="detail-section">// 语法</div>' +
      '<div class="syntax-box">' + syntax + '</div>' +
      argsHtml + exHtml +
      '<button class="copy-btn">⧉ 复制命令</button>';
    this.detailContent.querySelector('.copy-btn').addEventListener('click', () => {
      const btn = self.detailContent.querySelector('.copy-btn');
      btn.classList.add('copied');
      btn.textContent = '✓ 已复制';
      setTimeout(() => { btn.classList.remove('copied'); btn.textContent = '⧉ 复制命令'; }, 1200);
      if (self.h.onCopy) self.h.onCopy(item);
    });
  };

  Panel.prototype.clearDetail = function () {
    this.activeId = '';
    this.detailContent.classList.add('hidden');
    this.detailEmpty.classList.remove('hidden');
  };

  if (typeof module !== 'undefined') module.exports = { Panel };
  if (typeof window !== 'undefined') { window.Panel = window.Panel || { Panel }; }
})();

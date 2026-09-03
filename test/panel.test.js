'use strict';
/* 无头测试: 手写 DOM 桩, 验证 panel 渲染逻辑 */
const path = require('path');
const ROOT = path.join(__dirname, '..');

let fail = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name); if (!cond) fail++; };

/* ---- DOM 桩 ---- */
class FakeEl {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.dataset = {};
    this.style = {}; this._html = ''; this._text = '';
    this._cls = new Set(); this._listeners = {};
    this.value = '';
  }
  get innerHTML() { return this._html + this.children.map(c => c.innerHTML).join(''); }
  set innerHTML(v) { this._html = v; this.children.length = 0; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = v; }
  appendChild(c) { this.children.push(c); return c; }
  remove() {}
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  dispatch(t, ev) { (this._listeners[t] || []).forEach(fn => fn(ev)); }
  get classList() {
    return {
      add: (...c) => c.forEach(x => this._cls.add(x)),
      remove: (...c) => c.forEach(x => this._cls.delete(x)),
      contains: c => this._cls.has(c),
      toggle: (c, f) => f === undefined ? (this._cls.has(c) ? this._cls.delete(c) : this._cls.add(c)) : (f ? this._cls.add(c) : this._cls.delete(c))
    };
  }
  querySelector(sel) {
    const key = 'q:' + sel;
    if (!this._childMap) this._childMap = new Map();
    if (!this._childMap.has(key)) this._childMap.set(key, new FakeEl('div'));
    return this._childMap.get(key);
  }
  querySelectorAll() { return []; }
  closest() { return null; }
}
const els = {};
global.document = {
  getElementById: id => els[id] || (els[id] = new FakeEl('div')),
  createElement: t => new FakeEl(t),
  querySelector: s => new FakeEl('div'),
  addEventListener() {}, removeEventListener() {}
};

/* ---- 加载 panel ---- */
const { Panel } = require(path.join(ROOT, 'renderer/js/panel.js'));

const ITEMS = [
  { id: 'a', cmd: 'kubectl get', cat: 'k8s', desc: '查询列表', syntax: 'kubectl get <r>', args: [{ name: '-A', desc: '全部' }], examples: [{ cmd: 'kubectl get pods', comment: '看 pod' }], tags: [] },
  { id: 'b', cmd: 'ls', cat: 'linux', desc: '列目录', syntax: 'ls [-la]', args: [], examples: [{ cmd: 'ls -la', comment: '详情' }], tags: [] }
];
/* renderList 契约: search 结果结构 { item, field, hitStart, hitEnd } */
const SEARCHED = ITEMS.map(x => ({ item: x, field: 'cmd', hitStart: 0, hitEnd: 3, score: 1 }));

let copied = null;
const panel = new Panel('panel-root', { onCopy: c => { copied = c; } });
panel.setData(ITEMS);
panel.renderList(SEARCHED, '');
check('列表渲染两条', els['result-list'].innerHTML.includes('kubectl get') && els['result-list'].innerHTML.includes('ls'));
check('状态显示条数', els['list-status']._text.includes('2'));

panel.renderList(SEARCHED, 'kubectl');
check('搜索高亮包含 <span class="hl">', els['result-list'].innerHTML.includes('class="hl"'));

panel.showDetail(ITEMS[0]);
const dc = els['detail-content'];
check('详情渲染语法', dc.innerHTML.includes('kubectl get') && dc.innerHTML.includes('-A'));
check('详情渲染示例', dc.innerHTML.includes('kubectl get pods'));
check('详情区可见', !dc.classList.contains('hidden'));

/* 点击复制按钮 */
const btn = els['detail-content'].querySelector('.copy-btn');
btn.dispatch('click', {});
check('复制回调触发', copied && copied.id === 'a');

/* 空搜索提示 */
panel.renderList([], 'xyz');
check('无结果提示', els['list-status']._text.includes('无结果'));

/* 分类入口渲染(对象数组 {key,label}, 来自数据管线) */
const CATS13 = [
  { key: 'linux', label: 'linux 命令' }, { key: 'k8s', label: 'k8s 命令' }, { key: 'helm', label: 'helm 命令' },
  { key: 'vim', label: 'vim 命令' }, { key: 'terminal', label: '终端快捷键' }, { key: 'office', label: '办公常用' },
  { key: 'docker', label: 'docker 命令' }, { key: 'kafka', label: 'kafka 命令' }, { key: 'mysql', label: 'mysql 命令' },
  { key: 'postgres', label: 'postgres 命令' }, { key: 'redis', label: 'redis 命令' },
  { key: 'vscode', label: 'VSCode 快捷键' }, { key: 'idea', label: 'IDEA 快捷键' }
];
let catClicks = [];
const panel2 = new Panel('panel-root2', { onCategory: c => catClicks.push(c) });
panel2.renderCats(CATS13);
check('13 个分类 chip 渲染', els['cat-bar'].children.length === 13);
check('chip 文案取 label', els['cat-bar'].children[6].textContent === 'docker 命令' && els['cat-bar'].children[11].textContent === 'VSCode 快捷键');
check('chip dataset.cat 取 key', els['cat-bar'].children[6].dataset.cat === 'docker' && els['cat-bar'].children[11].dataset.cat === 'vscode');
check('chip 点击回调', (els['cat-bar'].children[2]._listeners['click'] || []).length > 0);
els['cat-bar'].children[2].dispatch('click', {});
check('分类点击触发 onCategory(key)', catClicks.length === 1 && catClicks[0] === 'helm');

/* 空数组渲染 */
panel.renderList([], '');
check('空列表状态清空', els['list-status']._text === '');

console.log(fail === 0 ? '\n===== 全部通过 =====' : '\n===== 存在 ' + fail + ' 个失败 =====');
process.exit(fail === 0 ? 0 : 1);

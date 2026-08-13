'use strict';
/* 全链路冒烟: 桩 window.cliGuide + DOM, 验证 数据加载→搜索→面板→复制 */
const path = require('path');
const ROOT = path.join(__dirname, '..');

let fail = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name); if (!cond) fail++; };

/* ---- DOM 桩(同 panel.test.js 的最小版) ---- */
class FakeEl {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.dataset = {};
    this.style = {}; this._html = ''; this._text = ''; this.value = '';
    this._cls = new Set(); this._listeners = {};
  }
  get innerHTML() { return this._html + this.children.map(c => c.innerHTML).join(''); }
  set innerHTML(v) { this._html = v; this.children.length = 0; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = v; }
  appendChild(c) { this.children.push(c); return c; }
  remove() {}
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  dispatch(t, ev) { (this._listeners[t] || []).forEach(fn => fn(ev)); }
  focus() {} select() {}
  getContext() { return new Proxy({}, { get: () => () => {} }); }
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
}
const els = {};
global.document = {
  getElementById: id => els[id] || (els[id] = new FakeEl('div')),
  createElement: t => new FakeEl(t),
  querySelector: s => new FakeEl('div'),
  addEventListener() {}, removeEventListener() {},
  body: new FakeEl('body')
};
global.window = global;
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};

/* ---- 桩 cliGuide ---- */
let copiedText = '';
global.cliGuide = {
  loadCommands: async () => {
    const { loadBuiltinCommands } = require('../lib/commands');
    return loadBuiltinCommands(ROOT);
  },
  copyText: async (t) => { copiedText = t; },
  togglePanel: async () => {}, hidePanel: async () => {}, dragMove: async () => {},
  onWindowState: (cb) => { global.__stateCb = cb; }
};

/* ---- 加载渲染层模块 ---- */
require(path.join(ROOT, 'renderer/js/search.js'));
require(path.join(ROOT, 'renderer/js/commands.js'));
require(path.join(ROOT, 'renderer/js/panel.js'));
require(path.join(ROOT, 'renderer/js/pet.js'));

/* ---- 运行入口(DOMContentLoaded 不会触发, 手动调用) ---- */
const { Main } = require(path.join(ROOT, 'renderer/js/main.js'));

(async () => {
  await Main.init();

  check('命令库加载(>=500 条)', Main.allCommands.length >= 500);
  check('CommandStore 数据入口可用', window.CommandStore.getAll().length >= 500);
  check('十三个分类入口渲染', els['cat-bar'].children.length === 13);
  check('初始列表非空', Main.results.length === Main.allCommands.length);
  check('默认选中第一条', Main.activeIndex === 0 && Main.results[0] !== undefined);

  /* 搜索 */
  Main.applyFilter('kubectl');
  check('搜索 kubectl 命中', Main.results.length > 0 && Main.results.every(r => r.item.cmd.includes('kubectl') || (r.item.desc || '').includes('kubectl')));
  const firstId = Main.results[0].item.id;

  /* 分类过滤(先清空关键词, 否则 vim 分类搜 kubectl 为空) */
  Main.applyFilter('');
  Main.toggleCat('vim');
  check('分类过滤 vim', Main.results.length > 0 && Main.results.every(r => r.item.cat === 'vim'));
  Main.toggleCat('vim'); // 取消限定

  /* 键盘导航 + 复制 */
  Main.moveActive(1);
  check('方向键切换详情', Main.results[Main.activeIndex] && Main.activeIndex === 1);
  Main.copyActive();
  check('Enter 复制当前命令', copiedText === Main.results[1].item.cmd);

  /* 窗口状态广播 */
  global.__stateCb('expanded');
  check('展开时面板可见', !els['panel-root'].classList.contains('hidden'));
  global.__stateCb('compact');
  check('收起时面板隐藏', els['panel-root'].classList.contains('hidden'));

  /* pet 降级模式 */
  check('无 WebGL 环境 pet 降级', Main.pet.fallback === true);
  check('降级 CSS 桌宠显示', els['pet-fallback'] && !els['pet-fallback'].classList.contains('hidden'));

  /* 恢复搜索状态 */
  Main.applyFilter('kubectl');
  check('再次搜索 kubectl 正常', Main.results[0].item.id === firstId);

  console.log(fail === 0 ? '\n===== 全部通过 =====' : '\n===== 存在 ' + fail + ' 个失败 =====');
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('SMOKE ERROR:', e); process.exit(1); });

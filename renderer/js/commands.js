'use strict';
/* 渲染层命令数据整理: 分类/索引 (数据由主进程经 IPC 提供) */
(function () {
  const CommandStore = {
    data: [],
    setData(list) { this.data = list; },
    getAll() { return this.data; },
    getCategories() { return [...new Set(this.data.map(c => c.cat))]; },
    getByCategory(cat) { return this.data.filter(c => c.cat === cat); }
  };
  if (typeof module !== 'undefined') module.exports = { CommandStore };
  if (typeof window !== 'undefined') { window.CommandStore = window.CommandStore || CommandStore; }
})();

'use strict';
/* 搜索: cmd/desc/tags 大小写不敏感子串匹配, cmd 命中优先 */
function searchCommands(list, query, opts) {
  const q = (query || '').trim().toLowerCase();
  const cat = opts && opts.cat;
  const out = [];
  for (const item of list) {
    if (cat && item.cat !== cat) continue;
    if (!q) { out.push({ item, field: '', hitStart: 0, hitEnd: 0 }); continue; }
    const cmd = item.cmd.toLowerCase();
    const ci = cmd.indexOf(q);
    if (ci !== -1) { out.push({ item, field: 'cmd', hitStart: ci, hitEnd: ci + q.length }); continue; }
    if ((item.desc || '').toLowerCase().includes(q)) { out.push({ item, field: 'desc', hitStart: 0, hitEnd: 0 }); continue; }
    if ((item.tags || []).some(t => t.toLowerCase().includes(q))) { out.push({ item, field: 'tag', hitStart: 0, hitEnd: 0 }); continue; }
  }
  const rank = { cmd: 0, desc: 1, tag: 2 };
  out.sort((a, b) => rank[a.field] - rank[b.field]);
  return out;
}

if (typeof module !== 'undefined') { module.exports = { searchCommands }; }
if (typeof window !== 'undefined') { window.searchCommands = searchCommands; }

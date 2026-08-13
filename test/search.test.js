'use strict';
const { searchCommands } = require('../renderer/js/search');

let fail = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name); if (!cond) fail++; };

const DATA = [
  { id: 'kubectl-get', cmd: 'kubectl get', cat: 'k8s', desc: '查询资源列表', tags: ['查询', 'pod'] },
  { id: 'kubectl-logs', cmd: 'kubectl logs', cat: 'k8s', desc: '查看日志', tags: ['日志'] },
  { id: 'ls', cmd: 'ls', cat: 'linux', desc: '列出目录', tags: ['目录'] },
  { id: 'grep', cmd: 'grep', cat: 'linux', desc: '搜索文本', tags: ['搜索'] },
  { id: 'vim-search', cmd: '/ pattern', cat: 'vim', desc: '搜索', tags: ['搜索'] }
];

/* 基础: 大小写不敏感子串 */
let r = searchCommands(DATA, 'kubectl');
check('命令名子串匹配', r.length === 2 && r.every(x => x.item.cat === 'k8s'));
r = searchCommands(DATA, 'KUBECTL');
check('大小写不敏感', r.length === 2);

/* 关键词: tags / desc */
r = searchCommands(DATA, '日志');
check('描述匹配', r.length === 1 && r[0].item.id === 'kubectl-logs');
r = searchCommands(DATA, 'pod');
check('标签匹配', r.some(x => x.item.id === 'kubectl-get'));

/* 空输入: 返回全部 */
r = searchCommands(DATA, '');
check('空输入返回全部', r.length === DATA.length);

/* 分类过滤 */
r = searchCommands(DATA, '', { cat: 'linux' });
check('分类过滤', r.length === 2 && r.every(x => x.item.cat === 'linux'));
r = searchCommands(DATA, '搜索', { cat: 'vim' });
check('分类+关键词叠加', r.length === 1 && r[0].item.id === 'vim-search');

/* 优先级: cmd 命中排前 */
r = searchCommands(DATA, '搜索');
check('cmd 命中优先于 desc', r[0].item.id === 'grep' && r[1].item.id === 'vim-search');

/* 高亮区间 */
r = searchCommands(DATA, 'get');
check('返回命中位置', r[0].hitStart === 8 && r[0].hitEnd === 11);

console.log(fail === 0 ? '\n===== 全部通过 =====' : '\n===== 存在 ' + fail + ' 个失败 =====');
process.exit(fail === 0 ? 0 : 1);

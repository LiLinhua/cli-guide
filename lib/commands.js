'use strict';
/* 命令库: 校验 / 内置读取 / 用户合并 (纯 Node, 可无头测试) */
const fs = require('fs');
const path = require('path');

const CATS = ['linux', 'k8s', 'helm', 'vim', 'terminal', 'office'];

function validateCommand(c) {
  const errs = [];
  if (!c || typeof c !== 'object') return ['not an object'];
  if (typeof c.id !== 'string' || !c.id) errs.push('id required');
  if (typeof c.cmd !== 'string' || !c.cmd) errs.push('cmd required');
  if (!CATS.includes(c.cat)) errs.push('bad cat: ' + c.cat);
  if (typeof c.desc !== 'string' || !c.desc) errs.push('desc required');
  if (typeof c.syntax !== 'string' || !c.syntax) errs.push('syntax required');
  if (!Array.isArray(c.args)) errs.push('args must be array');
  if (!Array.isArray(c.examples)) errs.push('examples must be array');
  if (!Array.isArray(c.tags)) errs.push('tags must be array');
  return errs;
}

function loadBuiltinCommands(rootDir) {
  const dir = path.join(rootDir, 'resources', 'commands');
  const out = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
    const list = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const item of list) out.push(item);
  }
  return out;
}

module.exports = { validateCommand, loadBuiltinCommands, CATS };

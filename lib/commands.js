'use strict';
/* 命令库: 校验 / 双格式解析 / 内置读取 / 用户合并 (纯 Node, 可无头测试) */
const fs = require('fs');
const path = require('path');

function validateCommand(c) {
  const errs = [];
  if (!c || typeof c !== 'object') return ['not an object'];
  if (typeof c.id !== 'string' || !c.id) errs.push('id required');
  if (typeof c.cmd !== 'string' || !c.cmd) errs.push('cmd required');
  if (typeof c.cat !== 'string' || !c.cat) errs.push('cat required');
  if (typeof c.desc !== 'string' || !c.desc) errs.push('desc required');
  if (typeof c.syntax !== 'string' || !c.syntax) errs.push('syntax required');
  if (!Array.isArray(c.args)) errs.push('args must be array');
  if (!Array.isArray(c.examples)) errs.push('examples must be array');
  if (!Array.isArray(c.tags)) errs.push('tags must be array');
  return errs;
}

/* 分类文件 meta 校验: meta 为 null(旧格式纯数组)直接通过 */
function validateFileMeta(meta, commands) {
  if (meta == null) return [];
  const errs = [];
  if (typeof meta.cat !== 'string' || !meta.cat) errs.push('meta.cat required');
  if (meta.label !== undefined && typeof meta.label !== 'string') errs.push('meta.label must be string');
  if (meta.order !== undefined && !Number.isFinite(meta.order)) errs.push('meta.order must be number');
  commands.forEach((c, i) => {
    if (!c || typeof c !== 'object') { errs.push('element not an object: #' + i); return; }
    if (c.cat !== meta.cat) errs.push('cat mismatch: ' + (c.id || ('#' + i)) + ' cat=' + c.cat);
  });
  return errs;
}

/* 文件内容归一化: 旧格式(纯数组) => meta:null; 新格式(包裹对象) => 提取 meta */
function parseCommandFile(raw, file) {
  if (raw == null) return { meta: null, commands: [] };
  if (Array.isArray(raw)) return { meta: null, commands: raw };
  const cmds = Array.isArray(raw && raw.commands) ? raw.commands : [];
  return { meta: { cat: raw.cat, label: raw.label, order: raw.order, file: file || null }, commands: cmds };
}

/* 目录读取 => { commands, categories }; failFast 用于内置库(随包分发, 坏数据应启动即暴露) */
function loadCommandDir(dir, opts) {
  const failFast = !!(opts && opts.failFast);
  const out = { commands: [], categories: [] };
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort()) {
    const p = path.join(dir, f);
    let raw;
    try { raw = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) {
      if (failFast) throw e;
      console.warn('[cli-guide] 跳过非法 JSON: ' + p);
      continue;
    }
    const parsed = parseCommandFile(raw, f);
    const metaErrs = parsed.meta ? validateFileMeta(parsed.meta, parsed.commands) : [];
    if (metaErrs.length > 0) {
      console.warn('[cli-guide] meta 非法, 按无 meta 处理: ' + f + ' -> ' + metaErrs.join('; '));
      out.commands.push(...parsed.commands);
      continue;
    }
    if (parsed.meta) out.categories.push(parsed.meta);
    out.commands.push(...parsed.commands);
  }
  return out;
}

function loadBuiltinCommands(rootDir) {
  return loadCommandDir(path.join(rootDir, 'resources', 'commands'), { failFast: true });
}

function loadUserCommands(userDir) {
  return loadCommandDir(userDir);
}

/* 分类 meta 合并: 同 key 用户覆盖内置; 命令中未声明的 cat 兜底;
 * 排序: 有 order 升序(同 order 按 key 字母序) -> 无 order 按 key 字母序 */
function mergeCategories(builtinCats, userCats, allCommands) {
  const map = new Map();
  for (const m of builtinCats) map.set(m.cat, m);
  for (const m of userCats) map.set(m.cat, m);
  for (const c of allCommands) {
    if (!map.has(c.cat)) map.set(c.cat, { cat: c.cat, label: undefined, order: undefined, file: null });
  }
  const list = [...map.values()].map(m => ({ key: m.cat, label: m.label || m.cat, order: m.order }));
  const ordered = list.filter(x => Number.isFinite(x.order))
    .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  const rest = list.filter(x => !Number.isFinite(x.order))
    .sort((a, b) => a.key.localeCompare(b.key));
  return ordered.concat(rest).map(x => ({ key: x.key, label: x.label }));
}

function mergeCommands(builtin, user) {
  const map = new Map();
  for (const c of builtin) map.set(c.id, c);
  for (const c of user) map.set(c.id, c); // 用户同名 id 覆盖内置
  return [...map.values()];
}

module.exports = { validateCommand, validateFileMeta, parseCommandFile, loadBuiltinCommands, loadUserCommands, mergeCommands, mergeCategories };

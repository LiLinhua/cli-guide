'use strict';
/* 无头测试: 构建浏览器单文件版并断言产物完整性 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const ROOT = path.join(__dirname, '..');

let fail = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name); if (!cond) fail++; };

const { build } = require(path.join(ROOT, 'scripts/build-web.js'));
const outFile = path.join(os.tmpdir(), 'cli-guide-web-' + Date.now() + '.html');
const out = build(outFile);
const html = fs.readFileSync(out, 'utf8');

/* 1. 产物存在且结构完整 */
check('单文件产物已生成', fs.statSync(out).size > 100 * 1024);
check('HTML 结构完整', html.startsWith('<!DOCTYPE html>') && html.trimEnd().endsWith('</html>'));

/* 2. 零外部依赖(全部内联) */
check('无外部 script 引用', !/<script\s+src=/.test(html));
check('无外部样式表引用', !/<link\s+rel="stylesheet"/.test(html));
check('已移除 CSP(内联脚本需要)', !/Content-Security-Policy/.test(html));

/* 3. 命令数据内联完整 */
const m = html.match(/window\.__COMMANDS__ = (\[.*?\]);/s);
check('命令数据已内联', !!m);
let cmds = [];
if (m) {
  try { cmds = JSON.parse(m[1]); } catch (e) { check('命令数据 JSON 可解析', false); }
}
check('命令总数 >= 500', cmds.length >= 500);
check('命令 id 全局唯一', new Set(cmds.map(c => c.id)).size === cmds.length);
check('十三分类齐全', new Set(cmds.map(c => c.cat)).size === 13);

/* 4. 渲染层与 shim 齐全 */
check('three UMD 已内联', html.includes('WebGLRenderer'));
check('web shim 已内联(window.cliGuide)', html.includes('window.cliGuide'));
check('桌宠模块已内联', html.includes('骷髅头骨桌宠'));
check('面板模块已内联', html.includes('renderCats'));
check('入口模块已内联', html.includes('DOMContentLoaded'));

/* 5. 脚本内容无 HTML 闭合泄漏 */
const scripts = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
check('内联脚本块完整闭合(8 块: 数据/shim/three/渲染层 x5)', scripts.length === 8);
check('无未转义闭合泄漏', !/<\/script><\/script>/.test(html));

/* 6. 覆盖样式生效(面板常驻居中 + 移除桌宠) */
check('Web 覆盖样式已注入', html.includes('#pet-root { display: none') && html.includes('#panel-root {'));

/* 7. 分类元数据内联 */
const mc = html.match(/window\.__CATEGORIES__ = (\[.*?\]);\n<\/script>/s);
check('__CATEGORIES__ 已内联', !!mc);
let cats = [];
if (mc) { try { cats = JSON.parse(mc[1]); } catch (e) { check('__CATEGORIES__ JSON 可解析', false); } }
check('13 个分类齐全且带 key/label', cats.length === 13 && cats.every(c => c.key && c.label));
check('分类顺序 linux 最前', cats[0] && cats[0].key === 'linux');

fs.unlinkSync(out);
console.log(fail === 0 ? '\n===== 全部通过 =====' : '\n===== 存在 ' + fail + ' 个失败 =====');
process.exit(fail === 0 ? 0 : 1);

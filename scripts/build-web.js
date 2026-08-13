'use strict';
/* 构建浏览器单文件版 dist/cli-guide-web.html:
 * 内联 CSS/three(UMD)/渲染层 JS/13 个命令库 JSON + web shim, 零外部依赖, 双击即可用 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const WEB_CSS = `
/* ===== Web 版覆盖样式: 面板常驻屏幕居中, 无桌宠(与客户端版交互解耦) ===== */
html, body { background: #05070a; }
#app { position: fixed; left: 0; top: 0; width: 100%; height: 100%; }
#pet-root { display: none !important; }          /* 移除桌宠 */
#panel-root {
  position: fixed; left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: min(880px, calc(100vw - 48px));
  height: min(640px, calc(100vh - 48px));
`;

/* 内联脚本内容防 HTML 闭合 */
function inline(src) {
  return fs.readFileSync(src, 'utf8').replace(/<\/script>/gi, '<\\/script>');
}

function build(outFile) {
  const out = path.resolve(outFile || path.join(ROOT, 'dist', 'cli-guide-web.html'));
  let html = fs.readFileSync(path.join(ROOT, 'renderer', 'index.html'), 'utf8');

  // 1. 移除 CSP(内联脚本需要; 单文件本地运行无外部请求)
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/, '');

  // 2. 内联样式表 + Web 覆盖样式
  html = html.replace(
    '<link rel="stylesheet" href="css/style.css">',
    '<style>\n' + inline(path.join(ROOT, 'renderer', 'css', 'style.css')) + '\n</style>\n  <style>' + WEB_CSS + '\n  </style>'
  );

  // 3. 内联外部脚本 (three.min.js / renderer/js/*.js)
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
    const file = path.resolve(path.join(ROOT, 'renderer'), src); // src 相对 renderer/index.html
    return '<script>\n' + inline(file) + '\n</script>';
  });

  // 4. 注入内联命令数据 + web shim (位于首个脚本之前, 先于渲染层加载)
  const cmds = [];
  const dir = path.join(ROOT, 'resources', 'commands');
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort()) {
    cmds.push(...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  }
  const shim = inline(path.join(ROOT, 'web', 'cli-guide-web.js'));
  const inject = '<script>\nwindow.__COMMANDS__ = ' + JSON.stringify(cmds) + ';\n</script>\n  <script>\n' + shim + '\n</script>\n  ';
  html = html.replace('<!-- three 的 UMD 构建先加载, pet.js 通过 window.THREE 使用 -->', inject + '<!-- three 的 UMD 构建先加载, pet.js 通过 window.THREE 使用 -->');

  // 5. 标题
  html = html.replace('<title>CLI-GUIDE</title>', '<title>CLI-GUIDE · Web 版</title>');

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  return out;
}

module.exports = { build, WEB_CSS };
if (require.main === module) {
  const out = build();
  const dir = path.join(ROOT, 'resources', 'commands');
  const total = fs.readdirSync(dir).filter(x => x.endsWith('.json'))
    .reduce((n, f) => n + JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).length, 0);
  console.log('web build written: ' + out + ' (' + Math.round(fs.statSync(out).size / 1024) + ' KB, ' + total + ' 条命令)');
}

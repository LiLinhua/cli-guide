'use strict';
/* 构建浏览器单文件版 dist/cli-guide-web.html:
 * 内联 CSS/three(UMD)/渲染层 JS/13 个命令库 JSON + web shim, 零外部依赖, 双击即可用 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const WEB_CSS = `
/* ===== Web 版覆盖样式: 桌宠固定视口右下角, 展开为 760x560 面板(与客户端窗口动画同语义) ===== */
html, body { background: #05070a; }
#app {
  position: fixed; right: 16px; bottom: 16px;
  width: 150px; height: 150px; z-index: 9999;
  transition: width .22s ease-out, height .22s ease-out;
}
#app.expanded { width: 760px; height: 560px; }
#web-badge {
  position: fixed; left: 12px; top: 10px; z-index: 10000;
  font: 11px/1 "Menlo", monospace; color: #2affa0; letter-spacing: 1px;
  background: rgba(0, 255, 136, .08); border: 1px solid rgba(0, 255, 136, .35);
  border-radius: 3px; padding: 5px 10px; user-select: none;
}
`;

const WEB_BADGE = '<div id="web-badge">WEB 测试版 · 数据与客户端版一致</div>';

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

  // 5. Web 角标 + 标题
  html = html.replace('<body>', '<body>\n  ' + WEB_BADGE);
  html = html.replace('<title>CLI-GUIDE</title>', '<title>CLI-GUIDE · Web 版</title>');

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  return out;
}

module.exports = { build, WEB_CSS, WEB_BADGE };
if (require.main === module) {
  const out = build();
  const dir = path.join(ROOT, 'resources', 'commands');
  const total = fs.readdirSync(dir).filter(x => x.endsWith('.json'))
    .reduce((n, f) => n + JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).length, 0);
  console.log('web build written: ' + out + ' (' + Math.round(fs.statSync(out).size / 1024) + ' KB, ' + total + ' 条命令)');
}

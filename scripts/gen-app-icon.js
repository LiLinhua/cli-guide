'use strict';
/* 生成应用图标: 终端脸风格 PNG (1024x1024, 圆角方块 + 绿色眼睛 + 字符流)
 * 用法: node scripts/gen-app-icon.js [size] [outfile] */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const SIZE = parseInt(process.argv[2], 10) || 1024;
const OUT = process.argv[3] || path.join(__dirname, '..', 'resources', 'icon-1024.png');

function inRounded(x, y, w, h, r) {
  if (x < r && y < r) return (x - r) * (x - r) + (y - r) * (y - r) <= r * r;
  if (x > w - r && y < r) return (x - (w - r)) * (x - (w - r)) + (y - r) * (y - r) <= r * r;
  if (x < r && y > h - r) return (x - r) * (x - r) + (y - (h - r)) * (y - (h - r)) <= r * r;
  if (x > w - r && y > h - r) return (x - (w - r)) * (x - (w - r)) + (y - (h - r)) * (y - (h - r)) <= r * r;
  return x >= 0 && x < w && y >= 0 && y < h;
}

/* 按归一化坐标(0-1)绘制: 返回 [r,g,b,a] */
function draw(nx, ny) {
  const w = 1, h = 1, r = 0.18;
  const BORDER = 0.018, EYE_W = 0.17, EYE_H = 0.22, EYE_Y = 0.26, EYE_X1 = 0.19, EYE_X2 = 0.64;
  const LINE_Y = [0.66, 0.76, 0.86], LINE_H = 0.035, LINE_X1 = 0.17, LINE_X2 = 0.83;

  // 透明背景
  if (!inRounded(nx, ny, w, h, r)) return [0, 0, 0, 0];
  const dist = Math.min(nx, ny, w - nx, h - ny);
  // 边框(绿)
  if (dist <= BORDER) return [0, 255, 136, 255];
  // 背景(深色终端)
  let base = [10, 15, 20, 255];
  // 眼睛(亮绿方块)
  const inEye = (ex) => nx >= ex && nx <= ex + EYE_W && ny >= EYE_Y && ny <= EYE_Y + EYE_H;
  if (inEye(EYE_X1) || inEye(EYE_X2)) return [0, 255, 136, 255];
  // 字符流(暗绿横线)
  for (const ly of LINE_Y) {
    if (ny >= ly && ny <= ly + LINE_H && nx >= LINE_X1 && nx <= LINE_X2) {
      base = [0, 90, 60, 255];
      break;
    }
  }
  // 轻微纵向渐变
  const g = 15 + Math.round(ny * 10);
  return [base[0], Math.min(255, base[1] + 5), base[2] + Math.round(ny * 6), 255];
}

/* ---- PNG 编码 (RGBA) ---- */
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b, a] = draw(x / SIZE, y / SIZE);
    const o = y * (SIZE * 4 + 1) + 1 + x * 4;
    raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
  }
}
function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, png);
console.log('app icon written: ' + OUT + ' (' + SIZE + 'x' + SIZE + ', ' + Math.round(png.length / 1024) + ' KB)');

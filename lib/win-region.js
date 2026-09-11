'use strict';
/* Windows: 用 SetWindowRgn 把窗口裁成胶囊, CSS 圆角无法裁掉 HWND 矩形四角 */
let _api = null;

function loadApi() {
  if (_api) return _api;
  if (process.platform !== 'win32') return null;
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const gdi32 = koffi.load('gdi32.dll');
    _api = {
      CreateRoundRectRgn: gdi32.func('void * __stdcall CreateRoundRectRgn(int x1, int y1, int x2, int y2, int w, int h)'),
      SetWindowRgn: user32.func('int __stdcall SetWindowRgn(void *hWnd, void *hRgn, int bRedraw)')
    };
  } catch (e) {
    _api = null;
  }
  return _api;
}

function readHwnd(win) {
  const buf = win.getNativeWindowHandle();
  if (!buf || buf.length < 4) return null;
  return buf.length >= 8 ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0));
}

/** 将窗口裁成圆角胶囊; width/height 为 DIP, 内部按 scaleFactor 转物理像素 */
function applyCapsuleRegion(win, width, height, scaleFactor) {
  const api = loadApi();
  if (!api || !win || !width || !height) return false;
  const hwnd = readHwnd(win);
  if (hwnd == null) return false;
  const scale = scaleFactor > 0 ? scaleFactor : 1;
  const pw = Math.max(1, Math.round(width * scale));
  const ph = Math.max(1, Math.round(height * scale));
  const corner = Math.min(pw, ph); // 短边直径 → 两端半圆 = 真胶囊
  // CreateRoundRectRgn 的右/下是 exclusive
  const hrgn = api.CreateRoundRectRgn(0, 0, pw + 1, ph + 1, corner, corner);
  if (!hrgn) return false;
  return api.SetWindowRgn(hwnd, hrgn, 1) !== 0;
}

/** 恢复矩形窗口(退出隐身时调用) */
function clearWindowRegion(win) {
  const api = loadApi();
  if (!api || !win) return false;
  const hwnd = readHwnd(win);
  if (hwnd == null) return false;
  return api.SetWindowRgn(hwnd, null, 1) !== 0;
}

module.exports = { applyCapsuleRegion, clearWindowRegion };

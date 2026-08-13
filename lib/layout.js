'use strict';
/* 窗口布局纯函数 (可无头测试) */
const PET_W = 150, PET_H = 150, MARGIN = 20;

function defaultCompactBounds(workArea) {
  return {
    x: workArea.x + workArea.width - PET_W - MARGIN,
    y: workArea.y + workArea.height - PET_H - MARGIN,
    width: PET_W, height: PET_H
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function computeExpandedBounds(compact, workArea, panelSize) {
  let x = compact.x + compact.width - panelSize.width;  // 右边缘对齐(向左展开)
  let y = compact.y + compact.height - panelSize.height; // 底边缘对齐(向上展开)
  x = clamp(x, workArea.x, workArea.x + workArea.width - panelSize.width);
  y = clamp(y, workArea.y, workArea.y + workArea.height - panelSize.height);
  return { x, y, width: panelSize.width, height: panelSize.height };
}

function interpolate(from, to, t, easing) {
  if (easing === 'easeOutCubic') t = 1 - Math.pow(1 - t, 3);
  return from + (to - from) * t;
}

module.exports = { defaultCompactBounds, computeExpandedBounds, interpolate, PET_W, PET_H, MARGIN };

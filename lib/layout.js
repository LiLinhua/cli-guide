'use strict';
/* 窗口布局纯函数 (可无头测试) */
const PET_W = 150, PET_H = 150, MARGIN = 20, STEALTH_SIZE = 12, STEALTH_BAR_LONG = 30;

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

function computeStealthBounds(compactBounds, workArea) {
  const cx = compactBounds.x + compactBounds.width / 2;
  const cy = compactBounds.y + compactBounds.height / 2;
  const candidates = [
    { edge: 'bottom', dist: workArea.y + workArea.height - cy },
    { edge: 'right',  dist: workArea.x + workArea.width - cx },
    { edge: 'top',    dist: cy - workArea.y },
    { edge: 'left',   dist: cx - workArea.x }
  ];
  const nearest = candidates.reduce((a, b) => a.dist < b.dist ? a : b);
  switch (nearest.edge) {
    case 'bottom':
      return { x: clamp(compactBounds.x, workArea.x, workArea.x + workArea.width - STEALTH_BAR_LONG), y: workArea.y + workArea.height - STEALTH_SIZE, width: STEALTH_BAR_LONG, height: STEALTH_SIZE };
    case 'right':
      return { x: workArea.x + workArea.width - STEALTH_SIZE, y: clamp(compactBounds.y, workArea.y, workArea.y + workArea.height - STEALTH_BAR_LONG), width: STEALTH_SIZE, height: STEALTH_BAR_LONG };
    case 'top':
      return { x: clamp(compactBounds.x, workArea.x, workArea.x + workArea.width - STEALTH_BAR_LONG), y: workArea.y, width: STEALTH_BAR_LONG, height: STEALTH_SIZE };
    case 'left':
      return { x: workArea.x, y: clamp(compactBounds.y, workArea.y, workArea.y + workArea.height - STEALTH_BAR_LONG), width: STEALTH_SIZE, height: STEALTH_BAR_LONG };
  }
}

module.exports = { defaultCompactBounds, computeExpandedBounds, computeStealthBounds, interpolate, PET_W, PET_H, MARGIN, STEALTH_SIZE, STEALTH_BAR_LONG };

'use strict';
const { defaultCompactBounds, computeExpandedBounds, computeMenuBounds, interpolate } = require('../lib/layout');

let fail = 0;
const check = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name); if (!cond) fail++; };

/* 默认位置: 屏幕右下角上方, 留 20px 边距 */
const wa = { x: 0, y: 0, width: 1440, height: 900 };
const cb = defaultCompactBounds(wa);
check('默认停靠右下角', cb.x === 1440 - 150 - 20 && cb.y === 900 - 150 - 20 && cb.width === 150 && cb.height === 150);

/* 展开: 面板 610 宽(760-150), 桌宠 150 在左侧 */
const eb = computeExpandedBounds(cb, wa, { width: 760, height: 560 });
check('展开宽度正确', eb.width === 760 && eb.height === 560);
check('桌宠区在左, 面板在右', eb.x + 150 <= wa.x + wa.width && eb.x + 760 <= wa.x + wa.width + 0.01);

/* 靠右时向左展开: 保持右边缘对齐 */
check('右边缘对齐(向左展开)', eb.x + eb.width === cb.x + cb.width);

/* 靠底部时向上展开: 保持底部对齐 */
check('底边缘对齐(向上展开)', eb.y + eb.height === cb.y + cb.height);

/* 屏幕太小(小于面板): 钳制到工作区左上角, 面板可超出右/下 */
const small = { x: 0, y: 0, width: 400, height: 300 };
const eb2 = computeExpandedBounds(cb, small, { width: 760, height: 560 });
check('小屏钳制到左上角', eb2.x === 0 && eb2.y === 0);

/* 右键菜单扩窗: 宽度 150+180, 高度容纳菜单实测高度 */
const cbFree = { x: 1000, y: 100, width: 150, height: 150 }; // 离右/底均远
const mb1 = computeMenuBounds(cbFree, wa, 200);
check('菜单扩窗尺寸(宽 330 高容纳菜单)', mb1.width === 330 && mb1.height === 200);
check('常规位置向右下扩展(x/y 不变)', mb1.x === cbFree.x && mb1.y === cbFree.y);

const mb2 = computeMenuBounds(cb, wa, 200); // cb 默认右下角: 贴右+距底 20px(MARGIN)
check('距底不足时窗口上移(不越屏幕底, 高度完整)', mb2.y + mb2.height <= wa.y + wa.height && mb2.height === 200);
check('贴右时窗口左移(不越右边缘)', mb2.x + mb2.width === wa.x + wa.width);

const cbBottom = { x: 1000, y: 750, width: 150, height: 150 }; // 用户拖到完全贴底
const mb4 = computeMenuBounds(cbBottom, wa, 200);
check('桌宠贴底时窗口底边缘对齐', mb4.y + mb4.height === cbBottom.y + cbBottom.height);

const mb3 = computeMenuBounds(cbFree, wa, 120); // 菜单比桌宠矮
check('菜单低于150时高度保持150', mb3.height === 150 && mb3.y === cbFree.y);

/* 插值 */
const v = interpolate(0, 100, 0.5);
check('线性插值中点', v === 50);
const eased = interpolate(0, 100, 0.5, 'easeOutCubic');
check('缓动插值', eased > 50 && eased <= 100);

console.log(fail === 0 ? '\n===== 全部通过 =====' : '\n===== 存在 ' + fail + ' 个失败 =====');
process.exit(fail === 0 ? 0 : 1);

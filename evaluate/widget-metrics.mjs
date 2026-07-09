/**
 * widget-metrics.mjs — UI 控件布局质量评估
 *
 * 评估维度:
 *   1. Element Overlap          — 元素互相遮挡
 *   2. Text Clipping            — 文字被裁剪/遮挡
 *   3. Border Proximity         — 文字距边框过近 (padding 不足)
 *   4. Touch Target Size        — 交互控件触控面积不足
 *
 * 依赖: 无 (纯函数)
 * 用法: import * as Widget from './widget-metrics.mjs'
 */

// ═════════════════════════════════════════════════
// 阈值常量
// ═════════════════════════════════════════════════

export const WIDGET_THRESHOLDS = {
  overlap: {
    /** 重叠面积占较小元素面积的比例超过此值 → flag */
    minOverlapRatio: 0.10,
    /** 两个交互元素重叠 → fail */
    /** 一个交互元素重叠 → warn */
    /** 非交互元素重叠 → info */
  },
  textClipping: {
    label: '文字不应被容器 overflow 裁剪',
  },
  borderProximity: {
    /** 最小 padding 倍数 (相对于 fontSize) */
    minPaddingRatio: 0.5,
    /** 推荐 padding 倍数 */
    recommendedPaddingRatio: 0.75,
    label: '文字距容器边框至少 0.5em',
  },
  touchTarget: {
    /** WCAG 2.5.8 (Target Size) 最小 24×24 CSS px */
    minSize: 24,
    /** WCAG 推荐 44×44 CSS px */
    recommendedSize: 44,
    label: 'WCAG 2.5.8 交互控件最小 24×24px',
  },
};

/** 交互控件标签列表 */
const INTERACTIVE_TAGS = new Set([
  'a', 'button', 'input', 'select', 'textarea', 'label',
  'summary', 'details',
]);

/** 可点击角色列表 (ARIA) */
const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'menuitem', 'tab', 'checkbox', 'radio',
  'switch', 'slider', 'spinbutton', 'combobox', 'searchbox',
  'textbox', 'option', 'menuitemcheckbox', 'menuitemradio',
  'treeitem', 'gridcell',
]);


// ═════════════════════════════════════════════════
// 辅助函数
// ═════════════════════════════════════════════════

/**
 * 判断元素是否为交互控件
 */
function isInteractive(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toLowerCase();
  const role = (el.role || '').toLowerCase();
  const hasOnClick = el.onClick || el.onclick;
  const isTabIndex = el.tabIndex !== undefined && el.tabIndex >= 0;
  return INTERACTIVE_TAGS.has(tag)
    || INTERACTIVE_ROLES.has(role)
    || hasOnClick
    || isTabIndex;
}

/**
 * 计算两个矩形是否重叠以及重叠比例
 * @returns {{ overlaps: boolean, overlapArea: number, overlapRatio: number, ratioA: number, ratioB: number }}
 */
function rectOverlap(a, b) {
  const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const overlapArea = xOverlap * yOverlap;
  if (overlapArea <= 0) {
    return { overlaps: false, overlapArea: 0, overlapRatio: 0, ratioA: 0, ratioB: 0 };
  }
  const areaA = (a.right - a.left) * (a.bottom - a.top);
  const areaB = (b.right - b.left) * (b.bottom - b.top);
  const minArea = Math.min(areaA, areaB);
  return {
    overlaps: true,
    overlapArea,
    overlapRatio: overlapArea / minArea,
    ratioA: overlapArea / areaA,
    ratioB: overlapArea / areaB,
  };
}

/**
 * 判断两个元素是否为 DOM 父子/后代关系
 * 利用 depth 字段: 如果一个元素完全包含另一个元素且 depth 不同，视作父容器
 */
function isParentChild(a, b) {
  // 有 depth 字段时：用层级差 + 矩形包含关系推断
  if (a.depth !== undefined && b.depth !== undefined) {
    if (a.depth === b.depth) return false;
    let shallow, deep;
    if (a.depth < b.depth) { shallow = a; deep = b; }
    else { shallow = b; deep = a; }
    var depthDiff = deep.depth - shallow.depth;
    // 只有 depth 差恰好为 1 且矩形包含时才认为是父子关系
    // depth 差 ≥ 2 时不跳过 —— 不同 DOM 分支（如 fixed 侧边栏与主内容）即使 rect 包含也不是父子
    if (depthDiff === 1) {
      var sr = shallow.rect;
      var dr = deep.rect;
      var isContained = sr.left <= dr.left && sr.top <= dr.top &&
                        sr.left + sr.width >= dr.left + dr.width &&
                        sr.top + sr.height >= dr.top + dr.height;
      return isContained;
    }
    return false;
  }
  return false;
}


// ═════════════════════════════════════════════════
// 1. Element Overlap — 元素互相遮挡
// ═════════════════════════════════════════════════

/**
 * 生成人类可读的重叠描述
 */
function describeOverlapPair(p) {
  // 提取有意义的 class 名（取前两个 class，忽略 Tailwind 工具类）
  function shortSelector(sel) {
    if (!sel) return '?';
    var parts = sel.split('.');
    var tag = parts[0];
    // 取前 2 个非工具类名作为标识
    var classes = [];
    for (var i = 1; i < parts.length && classes.length < 2; i++) {
      var c = parts[i];
      // 跳过 Tailwind 工具类（特征：含 - 或数字开头或常见布局类）
      if (!/^(flex|items|justify|self|gap|p[trblxy]?\-|m[trblxy]?\-|w\-|h\-|min|max|inset|left|right|top|bottom|z\-|fixed|absolute|relative|static|sticky|transition|duration|shadow|rounded|border|opacity|overflow|scroll|text\-|font|tracking|leading|space)/.test(c)) {
        classes.push(c);
      }
    }
    return tag + (classes.length > 0 ? '.' + classes.join('.') : '');
  }

  var aDesc = shortSelector(p.a.selector) + (p.a.zIndex > 0 ? '(z-' + p.a.zIndex + ')' : '') + (p.a.position ? '·' + p.a.position : '');
  var bDesc = shortSelector(p.b.selector) + (p.b.zIndex > 0 ? '(z-' + p.b.zIndex + ')' : '') + (p.b.position ? '·' + p.b.position : '');
  var overlayPct = (p.overlapRatio * 100).toFixed(0);

  var dir = '';
  if (p.a.zIndex > p.b.zIndex && p.b.zIndex === 0) dir = ' (上层遮盖下层)';
  else if (p.b.zIndex > p.a.zIndex && p.a.zIndex === 0) dir = ' (上层遮盖下层)';
  if (p.isPositioned) dir += ' [定位脱离文档流]';

  var impact = '';
  if (p.severity === 'fail') impact = '❌ 交互控件被遮盖 → 用户无法点击';
  else if (p.severity === 'warn') impact = '⚠️ 内容被遮挡 → 文字/控件不可见';
  else impact = 'ℹ️ 非交互元素重叠';

  return impact + '\n       「' + aDesc + '」遮盖了「' + bDesc + '」' + dir + '，重叠' + overlayPct + '%';
}

/**
 * 根据重叠类型给出修复建议
 */
function getRepairHint(p) {
  var hints = [];
  var aPos = p.a.position || '';
  var bPos = p.b.position || '';

  // fixed 定位元素覆盖普通流元素
  if (/fixed|absolute|sticky/.test(aPos) && !/fixed|absolute|sticky/.test(bPos)) {
    hints.push('\n       原因: ' + p.a.selector.split('.')[0] + ' 使用 `' + aPos + '` 定位脱离文档流，' +
               '下方元素未预留空间');
    hints.push('       方案: 给主内容区添加 `margin-left: 侧边栏宽度` 或 ' +
               '用 `xl:static` 在大屏上恢复文档流');
  } else if (!/fixed|absolute|sticky/.test(aPos) && /fixed|absolute|sticky/.test(bPos)) {
    hints.push('\n       原因: ' + p.b.selector.split('.')[0] + ' 使用 `' + bPos + '` 定位脱离文档流');
    hints.push('       方案: 调整主内容区 margin 或给固定元素条件隐藏');
  }

  // 两个交互控件重叠
  if (p.severity === 'fail') {
    hints.push('       影响: 用户无法点击被覆盖的按钮/链接');
  }

  // 带 z-index 的重叠
  if (p.a.zIndex > 0 || p.b.zIndex > 0) {
    hints.push('       注意: 涉及 z-index 层叠，需检查堆叠上下文');
  }

  return hints.join('');
}

/**
 * 评估页面中非嵌套元素之间的重叠
 *
 * @param {Array} elements — 所有元素数据 (含 rect, selector, tagName, role)
 * @param {number} [minRatio] — 最小重叠比例阈值 (默认 0.10)
 * @returns {Object} report
 */
export function evaluateOverlaps(elements, minRatio = WIDGET_THRESHOLDS.overlap.minOverlapRatio) {
  const pairs = [];

  // 只检查有实际尺寸且在屏幕内的元素
  // 注意: 不排除 left<0 的元素（如 transform 移出视口的侧边栏也应参与检测）
  const visible = elements.filter(el => {
    const r = el.rect;
    return r.width > 0 && r.height > 0;
  });

  // 按 z-index 分组: 有显式 z-index 的元素应被优先检测
  const hasZIndex = el => el.zIndex > 0 || (el.style && parseInt(el.style.zIndex) > 0);

  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i];
      const b = visible[j];

      // 跳过 DOM 父子/后代关系（子元素应在父容器内，这是正常布局）
      if (isParentChild(a, b)) {
        continue;
      }

      const overlap = rectOverlap(
        { left: a.rect.left, top: a.rect.top, right: a.rect.left + a.rect.width, bottom: a.rect.top + a.rect.height },
        { left: b.rect.left, top: b.rect.top, right: b.rect.left + b.rect.width, bottom: b.rect.top + b.rect.height },
      );

      if (overlap.overlaps && overlap.overlapRatio >= minRatio) {
        const aInteractive = isInteractive(a);
        const bInteractive = isInteractive(b);

        // 判断谁在上面 (z-index 高的在上)
        const aZ = a.zIndex || 0;
        const bZ = b.zIndex || 0;
        var onTop = aZ > bZ ? 'a' : (bZ > aZ ? 'b' : null);

        // 严重程度
        let severity;
        if (aInteractive && bInteractive) {
          severity = 'fail';     // 两个交互控件重叠 → 严重
        } else if (aInteractive || bInteractive) {
          severity = 'warn';     // 交互控件被遮挡
        } else {
          severity = 'info';     // 非交互元素重叠
        }

        // 增加额外信息: 是否因为 fixed/absolute 定位导致
        const aPos = a.style?.position || '';
        const bPos = b.style?.position || '';
        const isPositioned = /fixed|absolute|sticky/.test(aPos) || /fixed|absolute|sticky/.test(bPos);

        pairs.push({
          a: {
            selector: a.selector,
            text: (a.text || '').slice(0, 30),
            interactive: aInteractive,
            zIndex: aZ,
            position: aPos,
            depth: a.depth,
          },
          b: {
            selector: b.selector,
            text: (b.text || '').slice(0, 30),
            interactive: bInteractive,
            zIndex: bZ,
            position: bPos,
            depth: b.depth,
          },
          overlapArea: overlap.overlapArea,
          overlapRatio: overlap.overlapRatio,
          severity,
          onTop,
          isPositioned,
          isOverlapping: true,
        });
      }
    }
  }

  // 去重: 如果同一元素出现在多个重叠对中, 合并显示
  const fail = pairs.filter(p => p.severity === 'fail').length;
  const warn = pairs.filter(p => p.severity === 'warn').length;
  const info = pairs.filter(p => p.severity === 'info').length;

  return {
    dimension: '元素遮挡检测',
    standard: `重叠面积占比 ≥${(minRatio * 100).toFixed(0)}% 时标记`,
    pairs: pairs.slice(0, 30).map(p => ({
      ...p,
      description: describeOverlapPair(p),
      repairHint: getRepairHint(p),
    })),
    stats: {
      totalPairs: pairs.length,
      fail,
      warn,
      info,
      passRate: pairs.length === 0 ? 1 : 0,
    },
  };
}


// ═════════════════════════════════════════════════
// 2. Text Clipping — 文字被裁剪/遮挡
// ═════════════════════════════════════════════════

/**
 * 评估文字被容器裁剪的情况
 *
 * 检测场景:
 *   a) scrollWidth > clientWidth 且 overflow:hidden (水平裁剪)
 *   b) scrollHeight > clientHeight 且 overflow:hidden (垂直裁剪)
 *   c) text-overflow:ellipsis 实际触发截断
 *   d) white-space:nowrap 且内容溢出父容器
 *
 * @param {Array} elements — 每项含 scrollWidth, clientWidth, style 等
 * @returns {Object} report
 */
export function evaluateTextClipping(elements) {
  const issues = [];

  for (const el of elements) {
    const text = el.text || '';
    if (!text) continue;

    const sw = el.scrollWidth || 0;
    const cw = el.clientWidth || el.rect.width;
    const sh = el.scrollHeight || 0;
    const ch = el.clientHeight || el.rect.height;
    const style = el.style || {};

    // a) 水平裁剪: scroll > client + overflow 为 hidden/clip
    if (sw > cw + 1 && /hidden|clip/.test(style.overflow || '')) {
      issues.push({
        selector: el.selector,
        text: text.slice(0, 40),
        type: 'horizontal-clip',
        severity: 'fail',
        detail: `水平裁剪 ${(sw - cw).toFixed(0)}px (scroll=${sw}, client=${cw})`,
      });
      continue;
    }

    // b) 垂直裁剪
    if (sh > ch + 1 && /hidden|clip/.test(style.overflow || '')) {
      // 估算被裁剪的行数
      const fontSize = style.fontSize || 16;
      const lh = parseFloat(style.lineHeight) || fontSize * 1.5;
      const visibleLines = Math.floor(ch / lh);
      const totalLines = Math.floor(sh / lh);
      const clippedLines = totalLines - visibleLines;

      issues.push({
        selector: el.selector,
        text: text.slice(0, 40),
        type: 'vertical-clip',
        severity: 'fail',
        detail: `垂直裁剪 ~${clippedLines}行 (scroll=${sh}, client=${ch}, 可见 ${visibleLines}/${totalLines}行)`,
      });
      continue;
    }

    // c) text-overflow:ellipsis 触发
    if (style.textOverflow === 'ellipsis' && sw > cw + 1) {
      issues.push({
        selector: el.selector,
        text: text.slice(0, 40),
        type: 'ellipsis',
        severity: 'warn',
        detail: `文本被截断显示... (scroll=${sw}, client=${cw})`,
      });
      continue;
    }

    // d) nowrap 溢出父容器
    if (style.whiteSpace === 'nowrap' && el.parentOverflow) {
      issues.push({
        selector: el.selector,
        text: text.slice(0, 40),
        type: 'nowrap-overflow',
        severity: 'fail',
        detail: 'white-space:nowrap 导致溢出父容器',
      });
      continue;
    }

    // e) 文本长度远大于容器宽度可能被隐式裁剪 (无 overflow:hidden 但内容仍不可见)
    if (text.length > 5 && text.indexOf('\n') === -1) {
      const avgCharWidth = style.fontSize * 0.9;
      const estTextWidth = text.length * avgCharWidth;
      if (estTextWidth > cw * 2 && !style.wordBreak && !style.overflowWrap) {
        issues.push({
          selector: el.selector,
          text: text.slice(0, 40),
          type: 'potential-clip',
          severity: 'warn',
          detail: `文本 (${text.length}字) 可能溢出容器 (容器宽 ${cw}px, 估算需要 ${estTextWidth.toFixed(0)}px)`,
        });
      }
    }
  }

  const fail = issues.filter(i => i.severity === 'fail').length;
  const warn = issues.filter(i => i.severity === 'warn').length;

  return {
    dimension: '文字裁剪/遮挡检测',
    standard: WIDGET_THRESHOLDS.textClipping.label,
    issues,
    stats: {
      totalIssues: issues.length,
      fail,
      warn,
      passRate: issues.length === 0 ? 1 : 0,
    },
  };
}


// ═════════════════════════════════════════════════
// 3. Border Proximity — 文字距边框过近
// ═════════════════════════════════════════════════

/**
 * 评估文字与容器边框之间的距离 (padding 充足性)
 *
 * 对每个文本容器, 检查:
 *   - paddingLeft, paddingRight 是否 ≥ 0.5em
 *   - paddingTop, paddingBottom 是否 ≥ 0.5em
 *   - 若 padding 不足, 检查文本 rect 与容器 rect 的实际距离
 *
 * @param {Array} elements
 * @param {number} [minRatio] — 最小 padding/fontSize 比 (默认 0.5)
 * @returns {Object} report
 */
export function evaluateBorderProximity(elements, minRatio = WIDGET_THRESHOLDS.borderProximity.minPaddingRatio) {
  const issues = [];

  for (const el of elements) {
    const text = el.text || '';
    if (!text) continue;

    const fontSize = el.style.fontSize || 16;
    const minPadding = fontSize * minRatio;
    const recPadding = fontSize * WIDGET_THRESHOLDS.borderProximity.recommendedPaddingRatio;
    const style = el.style || {};

    // 检查四个方向的 padding
    const directions = [
      { key: '左', prop: 'paddingLeft', value: style.paddingLeft || 0 },
      { key: '右', prop: 'paddingRight', value: style.paddingRight || 0 },
      { key: '上', prop: 'paddingTop', value: style.paddingTop || 0 },
      { key: '下', prop: 'paddingBottom', value: style.paddingBottom || 0 },
    ];

    for (const dir of directions) {
      if (dir.value < minPadding) {
        const ratio = fontSize > 0 ? dir.value / fontSize : 0;
        // 对于按钮、输入框等交互控件, padding 不足更严重
        const isInteractive = /button|input|select|textarea/.test((el.tagName || el.selector || '').toLowerCase());
        const severity = isInteractive || ratio < minRatio * 0.5 ? 'fail' : 'warn';

        issues.push({
          selector: el.selector,
          text: text.slice(0, 30),
          direction: dir.key,
          fontSize,
          padding: dir.value,
          minRequired: minPadding,
          recommended: recPadding,
          paddingRatio: ratio,
          severity,
          detail: `${dir.key}侧 padding=${dir.value}px, 建议 ≥${minPadding.toFixed(1)}px (${minRatio}em, 字号 ${fontSize}px)`,
        });
      }
    }
  }

  const fail = issues.filter(i => i.severity === 'fail').length;
  const warn = issues.filter(i => i.severity === 'warn').length;

  // 按 selector 分组去重 (一个元素可能有多个方向的问题)
  const groupedBySelector = {};
  for (const issue of issues) {
    if (!groupedBySelector[issue.selector]) {
      groupedBySelector[issue.selector] = {
        selector: issue.selector,
        text: issue.text,
        fontSize: issue.fontSize,
        directions: [],
        worstSeverity: 'ok',
      };
    }
    groupedBySelector[issue.selector].directions.push(issue.direction + '=' + issue.padding.toFixed(0) + 'px');
    if (issue.severity === 'fail') groupedBySelector[issue.selector].worstSeverity = 'fail';
    else if (issue.severity === 'warn' && groupedBySelector[issue.selector].worstSeverity !== 'fail') {
      groupedBySelector[issue.selector].worstSeverity = 'warn';
    }
    groupedBySelector[issue.selector].minPadding = issue.minRequired;
  }

  const grouped = Object.values(groupedBySelector);

  return {
    dimension: '文字距边框距离 (padding)',
    standard: `${WIDGET_THRESHOLDS.borderProximity.label} (fontSize=${WIDGET_THRESHOLDS.borderProximity.minPaddingRatio}em)`,
    issues: grouped,
    stats: {
      totalElements: grouped.length,
      fail,
      warn,
      passRate: issues.length === 0 ? 1 : 0,
    },
  };
}


// ═════════════════════════════════════════════════
// 4. Touch Target Size — 交互控件触控面积
// ═════════════════════════════════════════════════

/**
 * 评估交互控件的触控面积 (WCAG 2.5.8)
 *
 * @param {Array} elements — 需含 tagName, role, rect, selector
 * @returns {Object} report
 */
export function evaluateTouchTargets(elements) {
  const interactiveElements = elements.filter(el => isInteractive(el));

  const results = [];

  for (const el of interactiveElements) {
    const w = el.rect.width;
    const h = el.rect.height;
    const minDim = Math.min(w, h);
    const text = (el.text || '').slice(0, 30);

    let status, message;
    if (minDim >= WIDGET_THRESHOLDS.touchTarget.recommendedSize) {
      status = 'ok';
      message = `${w.toFixed(0)}×${h.toFixed(0)}px (推荐 ≥${WIDGET_THRESHOLDS.touchTarget.recommendedSize}px)`;
    } else if (minDim >= WIDGET_THRESHOLDS.touchTarget.minSize) {
      status = 'warn';
      message = `${w.toFixed(0)}×${h.toFixed(0)}px (最小 ${WIDGET_THRESHOLDS.touchTarget.minSize}px, 推荐 ${WIDGET_THRESHOLDS.touchTarget.recommendedSize}px)`;
    } else {
      status = 'fail';
      message = `${w.toFixed(0)}×${h.toFixed(0)}px (不足 WCAG 最小 ${WIDGET_THRESHOLDS.touchTarget.minSize}px)`;
    }

    results.push({
      selector: el.selector,
      text,
      width: w,
      height: h,
      minDimension: minDim,
      status,
      message,
    });
  }

  const ok = results.filter(r => r.status === 'ok').length;
  const warn = results.filter(r => r.status === 'warn').length;
  const fail = results.filter(r => r.status === 'fail').length;

  return {
    dimension: '交互控件触控面积 (WCAG 2.5.8)',
    standard: WIDGET_THRESHOLDS.touchTarget.label,
    elements: results,
    stats: {
      total: results.length,
      ok, warn, fail,
      passRate: results.length > 0 ? ok / results.length : 1,
    },
  };
}


// ═════════════════════════════════════════════════
// 格式化输出
// ═════════════════════════════════════════════════

function printSep(char = '═', len = 72) {
  console.log('  ' + char.repeat(len));
}

function printTitle(report) {
  console.log(`\n  ${report.dimension}`);
  if (report.standard) console.log(`  标准: ${report.standard}`);
  printSep('─');
}

/**
 * 打印控件布局评估报告
 */
export function printWidgetReport(reports) {
  printSep();
  console.log('  🎛️  UI 控件布局质量评估');
  printSep();

  // 1. 元素遮挡
  if (reports.overlaps) {
    printTitle(reports.overlaps);
    if (reports.overlaps.pairs.length === 0) {
      console.log('  ✅ 未检测到元素遮挡');
    } else {
      const s = reports.overlaps.stats;
      console.log(`  ⚠️  共 ${s.totalPairs} 对重叠 (❌ ${s.fail}  ⚠️ ${s.warn}  ℹ️ ${s.info})`);
      for (const p of reports.overlaps.pairs.slice(0, 10)) {
        const icon = p.severity === 'fail' ? '❌' : p.severity === 'warn' ? '⚠️' : 'ℹ️';
        console.log(`    ${icon} 遮挡: ${p.description || '?'}`);
        if (p.repairHint) {
          console.log(p.repairHint);
        }
      }
    }
  }

  // 2. 文字裁剪
  if (reports.textClipping) {
    printTitle(reports.textClipping);
    if (reports.textClipping.issues.length === 0) {
      console.log('  ✅ 未检测到文字裁剪');
    } else {
      const issues = reports.textClipping.issues;
      console.log(`  ⚠️  共 ${issues.length} 处裁剪问题`);
      for (const issue of issues.slice(0, 8)) {
        const icon = issue.severity === 'fail' ? '❌' : '⚠️';
        console.log(`    ${icon} [${issue.type}] ${issue.selector}`);
        console.log(`       "${issue.text}" — ${issue.detail}`);
      }
    }
  }

  // 3. 边框距离
  if (reports.borderProximity) {
    printTitle(reports.borderProximity);
    if (reports.borderProximity.issues.length === 0) {
      console.log('  ✅ 所有元素 padding 充足');
    } else {
      const s = reports.borderProximity.stats;
      console.log(`  ⚠️  共 ${s.totalElements} 个元素 padding 不足 (❌ ${s.fail}  ⚠️ ${s.warn})`);
      for (const issue of reports.borderProximity.issues.slice(0, 8)) {
        const icon = issue.worstSeverity === 'fail' ? '❌' : '⚠️';
        console.log(`    ${icon} ${issue.selector}`);
        console.log(`       "${issue.text}" 字号 ${issue.fontSize}px, 方向: ${issue.directions.join(', ')}`);
        console.log(`       建议 padding ≥${issue.minPadding.toFixed(1)}px (${WIDGET_THRESHOLDS.borderProximity.minPaddingRatio}em)`);
      }
    }
  }

  // 4. 触控面积
  if (reports.touchTargets) {
    printTitle(reports.touchTargets);
    if (reports.touchTargets.stats.total === 0) {
      console.log('  ℹ️  未检测到交互控件');
    } else {
      const s = reports.touchTargets.stats;
      console.log(`  交互控件 ${s.total} 个 (✅ ${s.ok}  ⚠️ ${s.warn}  ❌ ${s.fail})  通过率: ${(s.passRate * 100).toFixed(0)}%`);
      for (const el of reports.touchTargets.elements.filter(e => e.status !== 'ok').slice(0, 8)) {
        console.log(`    ${el.status === 'fail' ? '❌' : '⚠️'} ${el.selector}`);
        console.log(`       "${el.text}" — ${el.message}`);
      }
    }
  }

  // 汇总
  printSep();
  const allOk = [
    !(reports.overlaps?.pairs?.length > 0),
    !(reports.textClipping?.issues?.length > 0),
    !(reports.borderProximity?.issues?.length > 0),
    (reports.touchTargets?.stats?.passRate ?? 1) >= 0.8,
  ];
  const passCount = allOk.filter(Boolean).length;
  console.log(`\n  控件综合: ${passCount}/4 维度达标`);
  if (passCount === 4) console.log('  🎉 全部通过!');
  else console.log(`  ⚠️  ${4 - passCount} 个维度需关注`);
  printSep();
  console.log();
}

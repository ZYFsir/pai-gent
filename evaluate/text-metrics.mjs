/**
 * text-metrics.mjs — 中文排版度量评估函数库
 *
 * 评估维度:
 *   1. CPL (Characters Per Line)          — 每行字符数
 *   2. Line Height Ratio                  — 行高比
 *   3. Text Overflow                      — 文本溢出检测
 *   4. CJK Line-breaking (禁则)           — 行首/行尾禁则违反
 *   5. CJK-Latin Mixed Spacing            — 中西文混排间距
 *   6. Vertical Rhythm                    — 垂直韵律 (基线网格对齐)
 *   7. Paragraph Raggedness               — 段落参差度
 *   8. Text Density                       — 版心文字密度
 *
 * 依赖: 无 (纯函数)
 * 用法: import * as Metrics from './text-metrics.mjs'
 */

// ═════════════════════════════════════════════════
// 阈值常量
// ═════════════════════════════════════════════════

export const THRESHOLDS = {
  cpl: {
    desktop:  { optimal: [25, 35], warn: [18, 45], label: '桌面端 25–35 字/行' },
    tablet:   { optimal: [20, 30], warn: [15, 40], label: '平板 20–30 字/行' },
    mobile:   { optimal: [18, 28], warn: [14, 38], label: '手机 18–28 字/行' },
  },
  lineHeight: {
    body:     { optimal: [1.6, 2.0], warn: [1.4, 2.2], label: '正文 1.6–2.0 倍字号' },
    heading:  { optimal: [1.2, 1.5], warn: [1.0, 1.8], label: '标题 1.2–1.5 倍字号' },
    small:    { optimal: [1.5, 1.8], warn: [1.3, 2.0], label: '小字 1.5–1.8 倍字号' },
  },
  overflow: {
    textClip:   { warn: true,  label: '文本被 overflow:hidden 裁剪' },
    nowrapOvf:  { fail: true,  label: 'nowrap 导致溢出父容器' },
    noWordWrap: { warn: true,  label: '长行无 word-break/overflow-wrap 保护' },
  },
  cjkLinebreak: {
    warn: 3,   // 1-3 违反/页 → warn
    fail: 4,   // ≥4 违反/页 → fail
    label: 'W3C CLREQ 行首/行尾禁则',
  },
  mixedSpacing: {
    warnRatio: 0.3,   // 超过 30% 的混合间隙无间距 → warn
    failRatio: 0.6,   // 超过 60% → fail
    idealGapEm: 0.25, // W3C CLREQ 建议 1/4em
    label: 'CJK-Latin 间 0.25em 间距',
  },
  verticalRhythm: {
    alignedPx:  1,    // ≤1px → ok
    warnPx:     3,    // ≤3px → warn
    defaultGrid: 8,   // 默认网格步长 8px
    label: '基线网格对齐 (±1px)',
  },
  raggedness: {
    okCv:  0.05,  // CV ≤0.05 → ok (接近两端对齐)
    warnCv: 0.10, // CV ≤0.10 → warn
    label: '右边缘变异系数 (CV)',
  },
  textDensity: {
    sparse:  0.20,  // <0.2 → 过疏
    optimalLow:  0.30,
    optimalHigh: 0.50,
    dense:  0.70,   // >0.7 → 过密
    label: '文字面积 / 版心面积',
  },
};

// ═════════════════════════════════════════════════
// CJK 禁则字符集 (W3C CLREQ)
// ═════════════════════════════════════════════════

export const CJK_LINE_BREAK = {
  /** 行首禁则 — 不能出现在行首的字符 */
  lineStart: new Set([
    '。', '、', '，', '．', '：', '；', '？', '！',
    '」', '』', '】', '〕', '〗', '〙', '〛',
    '〉', '》', '）', '］',
    '”', '’', '"', "'",
    '・', '·', '…', '—',
    '∶', '†', '‡',
  ]),
  /** 行尾禁则 — 不能出现在行尾的字符 */
  lineEnd: new Set([
    '（', '［', '〔', '｛', '〈', '《', '「', '『',
    '【', '〖', '〘', '〚',
    '“', '‘', '"', "'",
  ]),
};

// ═════════════════════════════════════════════════
// 1. CPL — Characters Per Line
// ═════════════════════════════════════════════════

/**
 * 估算中文字符的平均宽度 (em 为单位)
 * 中文字符 = 1em, 半角字母/数字 = 0.6em, 全角标点 = 1em, 半角空格 = 0.3em
 */
export function estimateAvgCharWidth(text, fontSize) {
  if (!text || text.length === 0) return fontSize;
  let totalWidth = 0;
  for (const ch of text) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef\u3000-\u303f]/.test(ch)) {
      totalWidth += fontSize;           // 全角 = 1em
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      totalWidth += fontSize * 0.6;     // 半角字母/数字
    } else if (ch === ' ') {
      totalWidth += fontSize * 0.3;     // 空格
    } else {
      totalWidth += fontSize * 0.5;     // 其他符号 (标点等)
    }
  }
  return totalWidth / text.length;
}

/**
 * 评估每行字符数 (CPL)
 *
 * @param {Array} elements — 文本元素数据数组, 每项含:
 *   { selector, rect: {width}, style: {fontSize, paddingLeft, paddingRight}, text }
 * @param {number} viewportWidth — viewport 宽度 (用于选择阈值档位)
 * @returns {Object} report
 */
export function evaluateCPL(elements, viewportWidth = 1440) {
  // 根据 viewport 选择阈值
  let tier;
  if (viewportWidth >= 1024) tier = THRESHOLDS.cpl.desktop;
  else if (viewportWidth >= 768) tier = THRESHOLDS.cpl.tablet;
  else tier = THRESHOLDS.cpl.mobile;

  const results = [];
  let ok = 0, warn = 0, fail = 0;

  for (const el of elements) {
    const fontSize = el.style.fontSize;
    if (!fontSize || fontSize <= 0) continue;

    const padLeft = el.style.paddingLeft || 0;
    const padRight = el.style.paddingRight || 0;
    const effectiveWidth = el.rect.width - padLeft - padRight;
    if (effectiveWidth <= 0) continue;

    // 用实际文本估算字符宽度
    const avgCharWidth = estimateAvgCharWidth(el.text || '', fontSize);
    const cpl = Math.round(effectiveWidth / avgCharWidth);

    let status, message;
    if (cpl >= tier.optimal[0] && cpl <= tier.optimal[1]) {
      status = 'ok';
      message = `${cpl} 字/行 (最优区间 ${tier.optimal[0]}–${tier.optimal[1]})`;
      ok++;
    } else if (cpl >= tier.warn[0] && cpl <= tier.warn[1]) {
      status = 'warn';
      message = `${cpl} 字/行 (警告区间 ${tier.warn[0]}–${tier.warn[1]})`;
      warn++;
    } else {
      status = 'fail';
      message = `${cpl} 字/行 (超出范围 ${tier.warn[0]}–${tier.warn[1]})`;
      fail++;
    }

    results.push({
      selector: el.selector,
      text: (el.text || '').slice(0, 50),
      fontSize,
      containerWidth: effectiveWidth,
      cpl,
      status,
      message,
    });
  }

  const total = results.length;
  return {
    dimension: 'CPL (每行字符数)',
    standard: tier.label,
    elements: results,
    stats: {
      total,
      ok, warn, fail,
      passRate: total > 0 ? ok / total : 1,
    },
  };
}


// ═════════════════════════════════════════════════
// 2. Line Height Ratio
// ═════════════════════════════════════════════════

/**
 * 解析行高值为数字 (px)
 * 支持: 'normal', '1.5', '24px', '1.5em', '150%'
 */
function parseLineHeight(lh, fontSize) {
  if (!lh || lh === 'normal') return null;
  if (lh.endsWith('px')) return parseFloat(lh);
  if (lh.endsWith('em') || lh.endsWith('rem')) return parseFloat(lh) * fontSize;
  if (lh.endsWith('%')) return parseFloat(lh) / 100 * fontSize;
  return parseFloat(lh) * fontSize;  // 无单位数值
}

/**
 * 评估行高比
 *
 * @param {Array} elements — 每项含 { selector, style: {fontSize, lineHeight, ...}, lines? }
 * @returns {Object} report
 */
export function evaluateLineHeight(elements) {
  const results = [];
  let ok = 0, warn = 0, fail = 0;

  for (const el of elements) {
    const fontSize = el.style.fontSize;
    if (!fontSize || fontSize <= 0) continue;

    // resolvedRatio: 浏览器实际渲染行高比 (如果 lines 数据包含多行 rect)
    let ratio = null;
    if (el.lines && el.lines.length >= 2) {
      const lineGap = el.lines[1].rect.top - el.lines[0].rect.top;
      ratio = lineGap / fontSize;
    }

    // fallback: 从 CSS line-height 解析
    if (ratio === null) {
      const lhPx = parseLineHeight(el.style.lineHeight, fontSize);
      if (lhPx !== null) {
        ratio = lhPx / fontSize;
      }
    }

    if (ratio === null) {
      results.push({
        selector: el.selector,
        fontSize,
        lineHeight: el.style.lineHeight || 'normal',
        ratio: null,
        status: 'warn',
        message: '无法解析行高 (line-height: normal, 缺少多行数据)',
      });
      warn++;
      continue;
    }

    // 选择阈值 (按字号或标签)
    let tier;
    const tag = (el.selector || '').split(/[.#]/)[0];
    if (/^h[1-4]$/i.test(tag) || ratio < 1.5) {
      tier = THRESHOLDS.lineHeight.heading;
    } else if (fontSize < 14) {
      tier = THRESHOLDS.lineHeight.small;
    } else {
      tier = THRESHOLDS.lineHeight.body;
    }

    let status, message;
    if (ratio >= tier.optimal[0] && ratio <= tier.optimal[1]) {
      status = 'ok';
      message = `${ratio.toFixed(2)}× (最优 ${tier.optimal[0]}–${tier.optimal[1]})`;
      ok++;
    } else if (ratio >= tier.warn[0] && ratio <= tier.warn[1]) {
      status = 'warn';
      message = `${ratio.toFixed(2)}× (警告 ${tier.warn[0]}–${tier.warn[1]})`;
      warn++;
    } else {
      status = 'fail';
      message = `${ratio.toFixed(2)}× (超出区间 ${tier.warn[0]}–${tier.warn[1]})`;
      fail++;
    }

    results.push({
      selector: el.selector,
      fontSize,
      lineHeight: el.style.lineHeight || 'normal',
      ratio,
      status,
      message,
    });
  }

  const total = results.length;
  return {
    dimension: '行高比 (line-height / font-size)',
    standard: '正文 1.6–2.0 | 标题 1.2–1.5 | 小字 1.5–1.8',
    elements: results,
    stats: {
      total,
      ok, warn, fail,
      passRate: total > 0 ? ok / total : 1,
    },
  };
}


// ═════════════════════════════════════════════════
// 3. Text Overflow
// ═════════════════════════════════════════════════

/**
 * 评估文本溢出情况
 *
 * @param {Array} elements — 每项含:
 *   { selector, text, rect, style: {overflow, textOverflow, whiteSpace, wordBreak, overflowWrap}, scrollWidth, clientWidth }
 * @returns {Object} report
 */
export function evaluateOverflow(elements) {
  const issues = [];
  let warned = 0, failed = 0;

  for (const el of elements) {
    const style = el.style;
    const sw = el.scrollWidth;
    const cw = el.clientWidth;
    const isClipped = sw > cw + 1;

    // 1. text-overflow:ellipsis + overflow:hidden → 实际截断
    if (style.textOverflow === 'ellipsis' && /hidden|clip/.test(style.overflow) && isClipped) {
      issues.push({
        selector: el.selector,
        text: (el.text || '').slice(0, 40),
        overflowType: 'ellipsis-clip',
        severity: 'warn',
        detail: `文本被截断: scroll=${sw} > client=${cw} (差 ${sw - cw}px)`,
      });
      warned++;
    }

    // 2. white-space:nowrap 溢出父容器 (由浏览器端标注 OVERFLOW_X)
    if (style.whiteSpace === 'nowrap' && el.parentOverflow) {
      issues.push({
        selector: el.selector,
        text: (el.text || '').slice(0, 40),
        overflowType: 'nowrap-overflow',
        severity: 'fail',
        detail: 'nowrap 导致横向溢出父容器',
      });
      failed++;
    }

    // 3. overflow:hidden 裁剪但无 text-overflow 提示
    if (style.overflow === 'hidden' && style.textOverflow !== 'ellipsis' && isClipped) {
      issues.push({
        selector: el.selector,
        text: (el.text || '').slice(0, 40),
        overflowType: 'hidden-clipped',
        severity: 'warn',
        detail: 'overflow:hidden 裁剪内容但未设 text-overflow:ellipsis',
      });
      warned++;
    }

    // 4. 长行无 word-break/overflow-wrap 保护 (中文长词)
    if (el.text && el.text.length > 30) {
      const hasLineBreak = /\n/.test(el.text);
      if (!hasLineBreak && !style.wordBreak && !style.overflowWrap) {
        // 估算文本宽度是否可能溢出
        const estWidth = el.text.length * (el.style.fontSize || 16) * 0.9;
        if (estWidth > (cw || el.rect.width) * 1.2) {
          issues.push({
            selector: el.selector,
            text: (el.text || '').slice(0, 40),
            overflowType: 'no-word-wrap',
            severity: 'warn',
            detail: `长行 (${el.text.length}字) 无 word-break/overflow-wrap`,
          });
          warned++;
        }
      }
    }
  }

  // 去重 (同 selector + 同类型)
  const unique = [];
  const seen = new Set();
  for (const i of issues) {
    const key = i.selector + '|' + i.overflowType;
    if (!seen.has(key)) { seen.add(key); unique.push(i); }
  }
  // 重新计数
  warned = unique.filter(i => i.severity === 'warn').length;
  failed = unique.filter(i => i.severity === 'fail').length;

  return {
    dimension: '文本溢出检测',
    standard: '无截断、无溢出、长行有 word-break 保护',
    issues: unique,
    stats: {
      totalIssues: unique.length,
      warned,
      failed,
      passRate: unique.length === 0 ? 1 : 0,
    },
  };
}


// ═════════════════════════════════════════════════
// 4. CJK Line-breaking (禁则)
// ═════════════════════════════════════════════════

/**
 * 从每行文本中检测禁则违反
 *
 * @param {Array} elementsWithLines — 每项含:
 *   { selector, text, lines: [{ text, rect }] }
 * @returns {Object} report
 */
export function evaluateCjkLinebreak(elementsWithLines) {
  const violations = [];
  let totalViolations = 0;

  for (const el of elementsWithLines) {
    const lines = el.lines || [];
    if (lines.length < 2) continue;

    const elViolations = [];

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i].text || '';
      if (lineText.length === 0) continue;

      // 行首检查
      const firstChar = lineText[0];
      if (CJK_LINE_BREAK.lineStart.has(firstChar)) {
        elViolations.push({
          line: i + 1,
          position: 'line-start',
          char: firstChar,
          context: lineText.slice(0, 12),
        });
      }

      // 行尾检查
      const lastChar = lineText[lineText.length - 1];
      if (CJK_LINE_BREAK.lineEnd.has(lastChar)) {
        elViolations.push({
          line: i + 1,
          position: 'line-end',
          char: lastChar,
          context: lineText.slice(-12),
        });
      }
    }

    if (elViolations.length > 0) {
      violations.push({
        selector: el.selector,
        text: (el.text || '').slice(0, 60),
        lineCount: lines.length,
        violations: elViolations,
        totalViolations: elViolations.length,
      });
      totalViolations += elViolations.length;
    }
  }

  const hasViolations = totalViolations > 0;
  const status = !hasViolations ? 'ok'
    : totalViolations <= THRESHOLDS.cjkLinebreak.warn ? 'warn'
    : 'fail';

  return {
    dimension: 'CJK 禁则违反 (W3C CLREQ)',
    standard: THRESHOLDS.cjkLinebreak.label,
    violations,
    stats: {
      totalViolations,
      affectedElements: violations.length,
      status,
      passRate: !hasViolations ? 1 : totalViolations <= THRESHOLDS.cjkLinebreak.warn ? 0.7 : 0,
    },
  };
}


// ═════════════════════════════════════════════════
// 5. CJK-Latin Mixed Spacing
// ═════════════════════════════════════════════════

/**
 * 检测 CJK 与 Latin 字符混排及其间距
 *
 * @param {Array} elements — 每项含 { selector, text, style: {fontSize, letterSpacing} }
 * @returns {Object} report
 */
export function evaluateMixedSpacing(elements) {
  const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef\u3000-\u303f]/;
  const LATIN_RE = /[a-zA-Z0-9]/;

  const results = [];
  let totalMixedContainers = 0;
  let withSpacing = 0;

  for (const el of elements) {
    const text = el.text || '';
    if (text.length < 2) continue;

    const fontSize = el.style.fontSize || 16;
    const letterSpacing = el.style.letterSpacing || 0;
    const gaps = [];

    for (let i = 0; i < text.length - 1; i++) {
      const left = text[i];
      const right = text[i + 1];

      const isLeftCJK = CJK_RE.test(left);
      const isRightCJK = CJK_RE.test(right);
      const isLeftLatin = LATIN_RE.test(left);
      const isRightLatin = LATIN_RE.test(right);

      // CJK⇄Latin 边界
      if ((isLeftCJK && isRightLatin) || (isLeftLatin && isRightCJK)) {
        const hasExplicitSpace = right === ' ' || left === ' ';
        const spacingProvided = letterSpacing >= fontSize * 0.25 || hasExplicitSpace;

        gaps.push({
          position: i,
          left, right,
          leftType: isLeftCJK ? 'CJK' : 'Latin',
          rightType: isRightCJK ? 'CJK' : 'Latin',
          hasSpacing: spacingProvided,
        });
      }
    }

    if (gaps.length === 0) continue;

    totalMixedContainers++;
    const gapsWithoutSpacing = gaps.filter(g => !g.hasSpacing);
    const ratio = gapsWithoutSpacing.length / gaps.length;

    let status, message;
    if (ratio === 0) {
      status = 'ok';
      message = `全部 ${gaps.length} 处 CJK-Latin 边界均有间距`;
      withSpacing++;
    } else if (ratio <= THRESHOLDS.mixedSpacing.warnRatio) {
      status = 'warn';
      message = `${gapsWithoutSpacing.length}/${gaps.length} 处缺少间距 (letter-spacing=${letterSpacing}px, 建议 ≥${(fontSize * 0.25).toFixed(1)}px)`;
    } else {
      status = 'fail';
      message = `${gapsWithoutSpacing.length}/${gaps.length} 处缺少间距`;
    }

    results.push({
      selector: el.selector,
      text: text.slice(0, 50),
      fontSize,
      letterSpacing,
      totalGaps: gaps.length,
      gapsWithoutSpacing: gapsWithoutSpacing.length,
      ratio: gapsWithoutSpacing.length / gaps.length,
      sampleGaps: gapsWithoutSpacing.slice(0, 5).map(g => `${g.left}${g.right}`),
      status,
      message,
    });
  }

  const passCount = results.filter(r => r.status === 'ok').length;

  return {
    dimension: '中西文混排间距',
    standard: THRESHOLDS.mixedSpacing.label,
    elements: results,
    stats: {
      totalMixedContainers,
      withSpacing: passCount,
      withoutSpacing: totalMixedContainers - passCount,
      passRate: totalMixedContainers > 0 ? passCount / totalMixedContainers : 1,
    },
  };
}


// ═════════════════════════════════════════════════
// 6. Vertical Rhythm
// ═════════════════════════════════════════════════

/**
 * 自动推断网格步长 (取文本块 top 间距的众数)
 */
export function inferGridStep(elements) {
  const tops = elements
    .map(el => el.rect.top)
    .filter(t => t > 0 && t < 10000)
    .sort((a, b) => a - b);

  if (tops.length < 3) return THRESHOLDS.verticalRhythm.defaultGrid;

  const gaps = [];
  for (let i = 1; i < tops.length; i++) {
    const gap = Math.round(tops[i] - tops[i - 1]);
    if (gap > 0 && gap < 200) gaps.push(gap);
  }

  if (gaps.length === 0) return THRESHOLDS.verticalRhythm.defaultGrid;

  // 取众数
  const freq = {};
  for (const g of gaps) freq[g] = (freq[g] || 0) + 1;
  const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return parseFloat(entries[0][0]) || THRESHOLDS.verticalRhythm.defaultGrid;
}

/**
 * 评估垂直韵律 (基线网格对齐)
 *
 * @param {Array} elements — 每项含 { selector, rect: {top}, style: {...} }
 * @param {number} [gridStep] — 网格步长, 不传则自动推断
 * @returns {Object} report
 */
export function evaluateVerticalRhythm(elements, gridStep) {
  if (gridStep === undefined) gridStep = inferGridStep(elements);

  const results = [];
  let aligned = 0, misaligned = 0, maxDev = 0, sumDev = 0;

  for (const el of elements) {
    const top = el.rect.top;
    if (top < 0 || top > 10000) continue;

    const offset = top % gridStep;
    const deviation = Math.min(offset, gridStep - offset);
    const isAligned = deviation <= THRESHOLDS.verticalRhythm.alignedPx;

    maxDev = Math.max(maxDev, deviation);
    sumDev += deviation;

    let status, message;
    if (isAligned) {
      status = 'ok';
      message = `偏差 ${deviation.toFixed(1)}px`;
      aligned++;
    } else if (deviation <= THRESHOLDS.verticalRhythm.warnPx) {
      status = 'warn';
      message = `偏差 ${deviation.toFixed(1)}px (建议 ≤${THRESHOLDS.verticalRhythm.alignedPx}px)`;
      misaligned++;
    } else {
      status = 'fail';
      message = `偏差 ${deviation.toFixed(1)}px 超出网格对齐容差`;
      misaligned++;
    }

    results.push({
      selector: el.selector,
      top,
      offsetFromGrid: offset,
      deviation,
      isAligned,
      status,
      message,
    });
  }

  const total = results.length;

  return {
    dimension: '垂直韵律 (基线网格对齐)',
    standard: `${THRESHOLDS.verticalRhythm.label} (网格步长 ${gridStep}px)`,
    gridStep,
    elements: results,
    stats: {
      total,
      aligned,
      misaligned,
      maxDeviation: maxDev,
      meanDeviation: total > 0 ? sumDev / total : 0,
      passRate: total > 0 ? aligned / total : 1,
    },
  };
}


// ═════════════════════════════════════════════════
// 7. Paragraph Raggedness
// ═════════════════════════════════════════════════

/**
 * 评估左对齐文本的右边缘参差度
 *
 * @param {Array} elementsWithLines — 每项含 { selector, text, lines: [{ text, rect: {right} }] }
 * @returns {Object} report
 */
export function evaluateRaggedness(elementsWithLines) {
  const results = [];

  for (const el of elementsWithLines) {
    const lines = el.lines || [];
    // 排除最后一行 (通常自然较短) 和单行
    const bodyLines = lines.slice(0, -1);
    if (bodyLines.length < 3) continue;

    const edges = bodyLines.map(l => l.rect.right).filter(e => e > 0);
    if (edges.length < 2) continue;

    const mean = edges.reduce((a, b) => a + b, 0) / edges.length;
    const variance = edges.reduce((sum, e) => sum + (e - mean) ** 2, 0) / edges.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean;

    // 识别异常短行 (右边缘比均值小 1.5σ 以上)
    const shortLines = bodyLines.filter(l => l.rect.right < mean - stdDev * 1.5);

    let status, message;
    if (cv <= THRESHOLDS.raggedness.okCv) {
      status = 'ok';
      message = `CV=${(cv * 100).toFixed(1)}% 右边缘接近对齐`;
    } else if (cv <= THRESHOLDS.raggedness.warnCv) {
      status = 'warn';
      message = `CV=${(cv * 100).toFixed(1)}% 轻微参差`;
    } else {
      status = 'fail';
      message = `CV=${(cv * 100).toFixed(1)}% 参差过大`;
    }

    results.push({
      selector: el.selector,
      text: (el.text || '').slice(0, 50),
      lineCount: lines.length,
      bodyLineCount: bodyLines.length,
      meanRightEdge: mean,
      stdDev,
      coefficientOfVariation: cv,
      shortLines: shortLines.map(l => ({
        lineNumber: bodyLines.indexOf(l) + 1,
        text: (l.text || '').slice(0, 20),
        rightEdge: l.rect.right,
        diff: l.rect.right - mean,
      })),
      status,
      message,
    });
  }

  const ok = results.filter(r => r.status === 'ok').length;
  const warn = results.filter(r => r.status === 'warn').length;
  const fail = results.filter(r => r.status === 'fail').length;

  return {
    dimension: '段落参差度 (Raggedness)',
    standard: `${THRESHOLDS.raggedness.label} ≤${(THRESHOLDS.raggedness.okCv * 100).toFixed(0)}% = ok, ≤${(THRESHOLDS.raggedness.warnCv * 100).toFixed(0)}% = warn`,
    elements: results,
    stats: { total: results.length, ok, warn, fail, passRate: results.length > 0 ? ok / results.length : 1 },
  };
}


// ═════════════════════════════════════════════════
// 8. Text Density
// ═════════════════════════════════════════════════

/**
 * 评估版心文字密度
 *
 * @param {Array} elements — 文本元素 rect 数据
 * @param {number} vw — viewport 宽度
 * @param {number} vh — viewport 高度
 * @returns {Object} report
 */
export function evaluateTextDensity(elements, vw, vh) {
  const viewportArea = vw * vh;

  let totalTextArea = 0;
  let totalChars = 0;

  for (const el of elements) {
    const r = el.rect;
    if (r.width > 0 && r.height > 0) {
      totalTextArea += r.width * r.height;
    }
    if (el.text) {
      totalChars += el.text.replace(/\s+/g, '').length;
    }
  }

  const density = totalTextArea / viewportArea;

  // 中文阅读速度: ~500 字/分钟
  const readingTime = totalChars / 500;
  const charsPerScreen = totalChars;

  let status, grade;
  if (density < THRESHOLDS.textDensity.sparse) {
    status = 'warn';
    grade = '过疏 (文字面积比 < 20%)';
  } else if (density < THRESHOLDS.textDensity.optimalLow) {
    status = 'warn';
    grade = '偏松 (适合阅读类页面)';
  } else if (density <= THRESHOLDS.textDensity.optimalHigh) {
    status = 'ok';
    grade = '舒适 (正文页理想密度)';
  } else if (density <= THRESHOLDS.textDensity.dense) {
    status = 'ok';
    grade = '信息密集 (适合 dashboard/列表页)';
  } else {
    status = 'warn';
    grade = '过密 (需增加留白)';
  }

  return {
    dimension: '版心文字密度',
    standard: THRESHOLDS.textDensity.label,
    textArea: totalTextArea,
    viewportArea,
    densityRatio: density,
    totalChars,
    charsPerScreen,
    estimatedReadingTime: readingTime,
    grade,
    status,
  };
}


// ═════════════════════════════════════════════════
// 格式化输出 — 报告打印
// ═════════════════════════════════════════════════

/**
 * 打印一条分割线
 */
function printSep(char = '═', len = 72) {
  console.log('  ' + char.repeat(len));
}

/**
 * 打印维度标题
 */
function printDimensionTitle(report) {
  console.log(`\n  ${report.dimension}`);
  console.log(`  标准: ${report.standard}`);
  printSep('─');
}

/**
 * 打印统计摘要行
 */
function printStatsLine(stats, indent = '  ') {
  if (!stats) return;
  const parts = [];
  if (stats.total !== undefined) parts.push(`总计: ${stats.total}`);
  if (stats.ok !== undefined) parts.push(`✅ ${stats.ok}`);
  if (stats.warn !== undefined) parts.push(`⚠️  ${stats.warn}`);
  if (stats.fail !== undefined) parts.push(`❌ ${stats.fail}`);
  if (stats.passRate !== undefined) parts.push(`通过率: ${(stats.passRate * 100).toFixed(0)}%`);
  if (stats.totalViolations !== undefined) parts.push(`违反: ${stats.totalViolations} 处`);
  if (stats.totalIssues !== undefined) parts.push(`问题: ${stats.totalIssues} 处`);
  if (stats.misaligned !== undefined) parts.push(`未对齐: ${stats.misaligned}`);
  console.log(`  ${parts.join('  |  ')}`);
}

/**
 * 格式化数值
 */
function fmt(v, decimals = 1) {
  if (typeof v === 'number') return v.toFixed(decimals);
  return String(v);
}

/**
 * 格式化报告数组，集中输出
 *
 * @param {Object} reports — { cpl, lineHeight, overflow, cjkLinebreak, mixedSpacing, verticalRhythm, raggedness, textDensity }
 */
export function printFormattedReport(reports, viewportW, viewportH) {
  printSep();
  console.log('  📐 中文排版度量评估报告');
  console.log(`  视口: ${viewportW}×${viewportH}px`);
  printSep();

  // ── 1. CPL ──
  if (reports.cpl) {
    printDimensionTitle(reports.cpl);
    printStatsLine(reports.cpl.stats);
    const warns = reports.cpl.elements.filter(e => e.status !== 'ok').slice(0, 5);
    for (const w of warns) {
      console.log(`    ${w.status === 'warn' ? '⚠️' : '❌'} ${w.selector || '(unknown)'}`);
      console.log(`       ${w.cpl} 字/行  (字号 ${w.fontSize}px, 容器宽 ${w.containerWidth.toFixed(0)}px)`);
    }
    if (warns.length < reports.cpl.stats.total) {
      console.log(`       ... 共 ${reports.cpl.stats.total} 个元素, 显示前 ${warns.length} 个异常`);
    }
  }

  // ── 2. 行高比 ──
  if (reports.lineHeight) {
    printDimensionTitle(reports.lineHeight);
    printStatsLine(reports.lineHeight.stats);
    const warns = reports.lineHeight.elements.filter(e => e.status !== 'ok').slice(0, 5);
    for (const w of warns) {
      const r = w.ratio !== null ? fmt(w.ratio, 2) + '×' : '—';
      console.log(`    ${w.status === 'warn' ? '⚠️' : '❌'} ${w.selector || '(unknown)'}  →  ${r}`);
    }
  }

  // ── 3. 溢出 ──
  if (reports.overflow) {
    printDimensionTitle(reports.overflow);
    if (reports.overflow.issues.length === 0) {
      console.log('  ✅ 未检测到文本溢出问题');
    } else {
      console.log(`  ⚠️  共 ${reports.overflow.issues.length} 个溢出问题`);
      for (const issue of reports.overflow.issues.slice(0, 8)) {
        console.log(`    ${issue.severity === 'fail' ? '❌' : '⚠️'} [${issue.overflowType}] ${issue.selector}`);
        console.log(`       ${issue.detail}`);
      }
    }
  }

  // ── 4. CJK 禁则 ──
  if (reports.cjkLinebreak) {
    printDimensionTitle(reports.cjkLinebreak);
    if (reports.cjkLinebreak.violations.length === 0) {
      console.log('  ✅ 未检测到禁则违反');
    } else {
      console.log(`  ⚠️  共 ${reports.cjkLinebreak.stats.totalViolations} 处禁则违反 (${reports.cjkLinebreak.violations.length} 个元素)`);
      for (const v of reports.cjkLinebreak.violations.slice(0, 5)) {
        for (const vn of v.violations.slice(0, 3)) {
          console.log(`    ${vn.position === 'line-start' ? '⛔行首' : '⛔行尾'} 第${vn.line}行 "${vn.char}" 上下文: "${vn.context}"`);
        }
      }
    }
  }

  // ── 5. CJK-Latin 混排 ──
  if (reports.mixedSpacing) {
    printDimensionTitle(reports.mixedSpacing);
    if (reports.mixedSpacing.elements.length === 0) {
      console.log('  ✅ 未检测到 CJK-Latin 混排 (或无需评估)');
    } else {
      printStatsLine(reports.mixedSpacing.stats);
      const issues = reports.mixedSpacing.elements.filter(e => e.status !== 'ok').slice(0, 5);
      for (const e of issues) {
        console.log(`    ${e.status === 'warn' ? '⚠️' : '❌'} ${e.selector}`);
        console.log(`       ${e.message}`);
        if (e.sampleGaps && e.sampleGaps.length > 0) {
          console.log(`       示例: "${e.sampleGaps.join('", "')}"`);
        }
      }
    }
  }

  // ── 6. 垂直韵律 ──
  if (reports.verticalRhythm) {
    printDimensionTitle(reports.verticalRhythm);
    printStatsLine(reports.verticalRhythm.stats);
    const worst = reports.verticalRhythm.elements.filter(e => e.status !== 'ok')
      .sort((a, b) => b.deviation - a.deviation).slice(0, 5);
    for (const w of worst) {
      console.log(`    ${w.status === 'warn' ? '⚠️' : '❌'} ${w.selector || '(unknown)'}  top=${w.top}px 偏差=${fmt(w.deviation, 1)}px`);
    }
  }

  // ── 7. 段落参差度 ──
  if (reports.raggedness) {
    printDimensionTitle(reports.raggedness);
    if (reports.raggedness.elements.length === 0) {
      console.log('  ℹ️  无多行段落数据 (跳过参差度评估)');
    } else {
      printStatsLine(reports.raggedness.stats);
      const issues = reports.raggedness.elements.filter(e => e.status !== 'ok').slice(0, 5);
      for (const e of issues) {
        console.log(`    ${e.status === 'warn' ? '⚠️' : '❌'} ${e.selector}`);
        console.log(`       CV=${(e.coefficientOfVariation * 100).toFixed(1)}%  (${e.bodyLineCount} 行主体)`);
        if (e.shortLines && e.shortLines.length > 0) {
          for (const sl of e.shortLines.slice(0, 2)) {
            console.log(`       异常短行 #${sl.lineNumber}: "${sl.text}" 右边缘=${sl.rightEdge.toFixed(0)}px (均值差 ${(sl.diff).toFixed(0)}px)`);
          }
        }
      }
    }
  }

  // ── 8. 文本密度 ──
  if (reports.textDensity) {
    printDimensionTitle(reports.textDensity);
    const d = reports.textDensity;
    console.log(`  文字面积: ${(d.textArea / 10000).toFixed(1)} cm² (${fmt(d.densityRatio * 100, 1)}% 版心)`);
    console.log(`  每屏字符: ${d.charsPerScreen} 字`);
    console.log(`  预估阅读: ${fmt(d.estimatedReadingTime, 1)} 分钟`);
    console.log(`  评价: ${d.grade}`);
  }

  // ── 总体 ──
  printSep();
  const allOk = [
    reports.cpl?.stats?.passRate >= 0.8 ?? true,
    reports.lineHeight?.stats?.passRate >= 0.8 ?? true,
    !(reports.overflow?.issues?.length > 0),
    reports.cjkLinebreak?.stats?.totalViolations === 0 ?? true,
    (reports.mixedSpacing?.stats?.passRate ?? 1) >= 0.7,
    (reports.verticalRhythm?.stats?.passRate ?? 1) >= 0.7,
    (reports.raggedness?.stats?.passRate ?? 1) >= 0.7,
    reports.textDensity?.status === 'ok',
  ];
  const passCount = allOk.filter(Boolean).length;
  const totalCount = allOk.length;
  console.log(`\n  综合: ${passCount}/${totalCount} 维度达标`);
  if (passCount === totalCount) {
    console.log('  🎉 全部通过!');
  } else {
    console.log(`  ⚠️  ${totalCount - passCount} 个维度需关注`);
  }
  printSep();
  console.log();
}

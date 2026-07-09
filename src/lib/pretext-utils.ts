/**
 * pretext-utils.ts — Pretext typography utilities for pai-gent
 *
 * 经验教训: 气泡宽度应使用固定 CSS max-width（如 max-w-[80%] md:max-w-[720px]），
 * 不要用 pretext shrinkWrap 二分搜索"最优宽度"——那会导致气泡忽宽忽窄，
 * 而且生产价值存疑（用户不会注意到气泡刚好包住文本）。
 *
 * Pretext 的正确用法: 在宽度已经由 CSS/JS 确定之后，用它测量文本会折成几行。
 * 参考: https://chenglou.me/pretext/markdown-chat/
 */

import {
  prepareWithSegments,
  layout,
  measureLineStats,
  measureNaturalWidth,
} from "@chenglou/pretext";

// ═══════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════

const BODY_FONT = '16px "Noto Serif SC", "Source Han Serif SC", "STSong", serif';
const BODY_LINE_HEIGHT = 28;
const BODY_LETTER_SPACING = 0.32;

const MONO_FONT = '15px "JetBrains Mono", "Fira Code", monospace';
const MONO_LINE_HEIGHT = 24;

// ═══════════════════════════════════════════════════════
// 缓存
// ═══════════════════════════════════════════════════════

const preparedCache = new Map<string, ReturnType<typeof prepareWithSegments>>();

function getOrPrepare(text: string, font: string, letterSpacing = BODY_LETTER_SPACING) {
  const key = `${font}::${text}::ls${letterSpacing}`;
  if (!preparedCache.has(key)) {
    preparedCache.set(key, prepareWithSegments(text, font, { letterSpacing }));
  }
  return preparedCache.get(key)!;
}

export function clearPretextCache(): void {
  preparedCache.clear();
}

// ═══════════════════════════════════════════════════════
// 1. measureHeight — 预计算文本高度
// ═══════════════════════════════════════════════════════

export interface HeightResult {
  height: number;
  lineCount: number;
  width: number;
}

/**
 * 在给定宽度下预计算文本渲染高度，用于消除布局抖动。
 */
export function measureHeight(
  text: string,
  width: number,
  font = BODY_FONT,
  lineHeight = BODY_LINE_HEIGHT,
): HeightResult {
  if (!text || text.trim().length === 0) {
    return { height: 0, lineCount: 0, width };
  }

  const prepared = getOrPrepare(text, font);
  const result = layout(prepared, width, lineHeight);

  return {
    height: result.height,
    lineCount: result.lineCount,
    width,
  };
}

// ═══════════════════════════════════════════════════════
// 2. analyzeText — 排版诊断（开发期工具）
// ═══════════════════════════════════════════════════════

export interface TextAnalysis {
  charCount: number;
  naturalWidth: number;
  linesAt720: number;
  heightAt720: number;
  estimatedCharsPerLine: number;
  suggestion: string;
}

/**
 * 排版诊断 — 在浏览器控制台调用:
 *   window.__pretextAnalyze("你的文本")
 */
export function analyzeText(
  text: string,
  font = BODY_FONT,
  lineHeight = BODY_LINE_HEIGHT,
): TextAnalysis {
  const charCount = text.replace(/\s+/g, '').length;
  const prepared = getOrPrepare(text, font);
  const naturalW = measureNaturalWidth(prepared);
  const maxWidth = 720;
  const stats = measureLineStats(prepared, maxWidth);
  const lineCount = stats?.lineCount ?? 1;
  const height = lineCount * lineHeight;

  const avgCharW = naturalW / Math.max(1, charCount);
  const cpl = Math.floor(maxWidth / Math.max(1, avgCharW));

  let suggestion: string;
  if (lineCount <= 1 && naturalW < maxWidth * 0.3) {
    suggestion = `短文本 (${charCount}字, ${naturalW.toFixed(0)}px)`;
  } else if (lineCount <= 1) {
    suggestion = `单行，自然宽度 ${naturalW.toFixed(0)}px`;
  } else if (cpl > 50) {
    suggestion = `行长过大 (~${cpl}字/行)，建议限制宽度 < 720px`;
  } else if (cpl < 25 && lineCount > 3) {
    suggestion = `行短行多 (~${cpl}字/行)` + (naturalW < 400 ? '，可加宽容器' : '，代码块正常');
  } else {
    suggestion = `良好: ~${cpl}字/行 × ${lineCount}行`;
  }

  return {
    charCount,
    naturalWidth: Math.round(naturalW),
    linesAt720: lineCount,
    heightAt720: height,
    estimatedCharsPerLine: cpl,
    suggestion,
  };
}

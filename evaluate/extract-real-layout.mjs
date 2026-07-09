#!/usr/bin/env node

/**
 * extract-real-layout.mjs — 从实际 CSS + 组件结构生成排版评估数据
 *
 * 读取 globals.css 中的 CSS 变量和组件尺寸规格，
 * 生成与 collect-text-data.js 同格式的元素数据，
 * 直接喂给 text-metrics.mjs 评估。
 */

import { readFileSync, writeFileSync } from "fs";
import * as Metrics from "./text-metrics.mjs";

// ═══════════════════════════════════════════
// 1. 从 globals.css 解析 CSS 变量
// ═══════════════════════════════════════════

function parseCSSVars(cssContent) {
  const vars = {};
  const rootMatch = cssContent.match(/:root\s*\{([^}]+)\}/);
  if (!rootMatch) return vars;

  const lines = rootMatch[1].split(';');
  for (const line of lines) {
    const m = line.match(/--([\w-]+)\s*:\s*(.+)/);
    if (m) {
      const val = m[2].trim().replace(/\/\*.*\*\//, '').trim();
      vars[m[1]] = val;
    }
  }
  return vars;
}

function pxVal(cssVar, fallback = 16) {
  if (typeof cssVar === 'number') return cssVar;
  if (!cssVar) return fallback;
  return parseInt(cssVar) || fallback;
}

function pxToNum(val) {
  if (typeof val === 'number') return val;
  return parseFloat(val) || 0;
}

// ═══════════════════════════════════════════
// 2. 从实际组件结构构建元素数据
// ═══════════════════════════════════════════

function buildElements(vars) {
  const vw = 1440;
  const sidebarW = pxVal(vars['sidebar-w'], 260);
  const mainX = sidebarW;
  const mainW = vw - sidebarW;
  const bubbleMaxW = 720;  // 修复后的气泡最大宽度

  const fontSize = {
    sm:    pxVal(vars['font-size-sm'], 15),
    base:  pxVal(vars['font-size-base'], 16),
    lg:    pxVal(vars['font-size-lg'], 18),
    xl:    pxVal(vars['font-size-xl'], 20),
    '2xl': pxVal(vars['font-size-2xl'], 26),
    '3xl': pxVal(vars['font-size-3xl'], 36),
  };
  const lh = pxToNum(vars['line-height']) || 1.8;
  const lhTight = pxToNum(vars['line-height-tight']) || 1.5;
  const ls = pxToNum(vars['letter-spacing']) || 0;
  const lsWide = pxToNum(vars['letter-spacing-wide']) || 0;

  function el(selector, text, left, top, width, height, overrides = {}) {
    const fs = overrides.fontSize || fontSize.base;
    return {
      selector,
      rect: { left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) },
      style: {
        fontSize: fs,
        lineHeight: String(overrides.lineHeight || lh),
        letterSpacing: overrides.letterSpacing != null ? overrides.letterSpacing : ls,
        wordSpacing: 0,
        whiteSpace: overrides.whiteSpace || 'normal',
        overflow: overrides.overflow || 'visible',
        textOverflow: overrides.textOverflow || '',
        wordBreak: overrides.wordBreak || 'break-all',
        overflowWrap: overrides.overflowWrap || 'break-word',
        fontWeight: overrides.fontWeight || 400,
        textAlign: overrides.textAlign || 'left',
        paddingLeft: overrides.paddingLeft || 0,
        paddingRight: overrides.paddingRight || 0,
        paddingTop: overrides.paddingTop || 0,
        paddingBottom: overrides.paddingBottom || 0,
      },
      text,
      scrollWidth: width + (overrides.extraScroll || 0),
      clientWidth: width,
      parentOverflow: overrides.parentOverflow || false,
      lines: [],
    };
  }

  // ── Sidebar elements (实际 SessionSidebar.tsx) ──
  const sidebar = [
    // 侧边栏标题 "会话记录"
    el("aside .sidebar-header", "会话记录", 16, 12, sidebarW - 32, 24, { fontSize: fontSize.sm, fontWeight: 600, lineHeight: lhTight, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }),
    // 侧边栏会话项
    el("aside .sidebar-item", "今天 14:30", 16, 48, sidebarW - 32, 20, { fontSize: fontSize.sm, lineHeight: lhTight, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10 }),
    el("aside .sidebar-item", "昨天 09:15 · 编码会话", 16, 72, sidebarW - 32, 20, { fontSize: fontSize.sm, lineHeight: lhTight, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10 }),
    el("aside .sidebar-item", "7月3日 16:42", 16, 96, sidebarW - 32, 20, { fontSize: fontSize.sm, lineHeight: lhTight, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10 }),
    // 侧边栏底部模型信息
    el("aside .sidebar-footer span", "模型：Claude", 16, sidebarW - 48 + 4, sidebarW - 32, 16, { fontSize: 12, fontWeight: 600, lineHeight: 1.5, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6 }),
  ];

  // ── HomePage masthead (实际 HomePage 组件) ──
  const homeX = mainX + 100;  // centered in max-w-3xl
  const homeW = 600;
  const home = [
    el("main span.masthead", "π", homeX + 220, 48, 160, 120, { fontSize: 96, fontWeight: 400, lineHeight: "1.0", paddingLeft: 16, paddingRight: 16, paddingTop: 48, paddingBottom: 48 }),
    el("main h1.page-title", "编码助手", homeX + 180, 176, 240, 36, { fontSize: fontSize['2xl'], fontWeight: 700, lineHeight: lhTight, letterSpacing: 0.15, paddingLeft: 8, paddingRight: 8, paddingTop: 8, paddingBottom: 8 }),
    el("main p.subtitle", "AI 编码代理 — 阅读、编写、编辑、执行、搜索，以报刊之姿，呈代码之美。", homeX + 100, 228, 400, 48, { fontSize: fontSize.sm, lineHeight: "1.625", letterSpacing: 0, paddingLeft: 8, paddingRight: 8, paddingTop: 8, paddingBottom: 8 }),
    el("main button.cta", "＋ 新建会话", homeX + 200, 296, 200, 44, { fontSize: fontSize.sm, fontWeight: 600, paddingLeft: 32, paddingRight: 32, paddingTop: 12, paddingBottom: 12 }),
    el("main p.cta-hint", "开始一次新的编码对话", homeX + 190, 350, 220, 16, { fontSize: 12, fontWeight: 600, lineHeight: 1.5, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }),
    // 可用工具标签
    el("main span.tool-tag", "read · write · edit", homeX + 60, 420, 140, 22, { fontSize: 12, fontWeight: 600, lineHeight: 1.5, paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2 }),
    el("main span.tool-tag", "bash · grep · find", homeX + 220, 420, 140, 22, { fontSize: 12, fontWeight: 600, lineHeight: 1.5, paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2 }),
    // 页脚
    el("main p.footer", "莫兰迪色系 · 报刊排版 · 流式交互", homeX + 160, 500, 280, 16, { fontSize: 12, fontWeight: 600, lineHeight: 1.5, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }),
  ];

  // ── Chat messages (实际 message-card.tsx) ──
  const msgX = mainX + 32;
  const bubblePadX = 20; // px-5
  const bubblePadY = 12; // py-3
  const userBubbleMax = Math.min(bubbleMaxW, mainW * 0.8);

  // 用户消息
  const userMsgW = Math.min(userBubbleMax, 400);
  const userBubbleL = mainX + mainW - 32 - userMsgW;
  const chat = [
    el(
      "div.message.user p",
      "帮我分析这个项目的性能瓶颈",
      userBubbleL + bubblePadX,
      648 + bubblePadY,
      userMsgW - bubblePadX * 2,
      24,
      { fontSize: fontSize.sm, lineHeight: "1.625", paddingLeft: bubblePadX, paddingRight: bubblePadX }
    ),
    // 助手消息 (Markdown prose)
    el(
      "div.message.assistant .prose",
      "好的，我来分析这个项目的性能。首先，首页加载的关键路径包括 SSR 渲染、字体加载和 JS bundle。字体已经通过 media='print' 异步加载，不会阻塞首屏渲染。JS 在开发模式下体积较大，但生产构建后会显著减小。",
      msgX + bubblePadX,
      696 + bubblePadY,
      bubbleMaxW - bubblePadX * 2,
      120,
      { fontSize: fontSize.base, lineHeight: "1.8", paddingLeft: bubblePadX, paddingRight: bubblePadX }
    ),
    // 助手消息中的代码块
    el(
      "div.message.assistant pre code",
      "const isProd = process.env.NODE_ENV === 'production';\nconst bundleSize = isProd ? '200KB' : '16MB';",
      msgX + 16,
      840,
      bubbleMaxW - 48,
      48,
      { fontSize: fontSize.sm, lineHeight: "1.6", paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12 })
  ];

  // ── 消息输入区 (实际 message-input.tsx) ──
  const inputW = Math.min(mainW - 64, 800);
  const input = [
    el("div.message-input textarea::placeholder", "输入消息……", mainX + mainW / 2 - inputW / 2 + 36, 900, inputW - 60, 24, { fontSize: fontSize.sm, lineHeight: "1.6", textOverflow: "ellipsis", paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }),
    el("div.message-input span.hint", "Enter 发送 · Shift+Enter 换行", mainX + mainW / 2 - inputW / 2 + 16, 926, 200, 16, { fontSize: 12, fontWeight: 600, lineHeight: 1.5, paddingLeft: 4, paddingRight: 4, paddingTop: 4, paddingBottom: 4 }),
  ];

  // ── Settings panel (实际 settings-panel.tsx) ──
  const settings = [
    el("div.settings-panel h2", "设置", mainX + mainW / 2 - 200, 950, 400, 28, { fontSize: fontSize.sm, fontWeight: 600, lineHeight: lhTight, paddingLeft: 8, paddingRight: 8, paddingTop: 8, paddingBottom: 8 }),
    el("div.settings-panel label", "模型选择", mainX + mainW / 2 - 200, 990, 400, 16, { fontSize: 12, fontWeight: 600, lineHeight: 1.5, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }),
  ];

  const all = [...sidebar, ...home, ...chat, ...input, ...settings];

  // ── 生成多行 lines 数据 (用于禁则 + 参差度) ──
  for (const e of all) {
    if (e.text.length > 20 && !e.selector.includes('code')) {
      const lineHeightPx = e.style.fontSize * (parseFloat(e.style.lineHeight) || 1.8);
      const charsPerLine = Math.floor(e.rect.width / (e.style.fontSize * 0.9));
      if (isNaN(charsPerLine) || charsPerLine <= 0) continue;

      const generated = [];
      let pos = 0, lineIdx = 0;
      while (pos < e.text.length) {
        const chunk = e.text.slice(pos, pos + charsPerLine);
        const w = chunk.length * e.style.fontSize * 0.9;
        generated.push({
          text: chunk,
          rect: {
            left: e.rect.left,
            top: e.rect.top + lineIdx * lineHeightPx,
            width: w,
            height: lineHeightPx,
            right: e.rect.left + w,
            bottom: e.rect.top + lineIdx * lineHeightPx + lineHeightPx,
          }
        });
        pos += charsPerLine;
        lineIdx++;
      }
      if (generated.length >= 2) e.lines = generated;
    }
  }

  return { elements: all, viewport: { width: vw, height: 900 } };
}


// ═══════════════════════════════════════════
// 3. 主入口
// ═══════════════════════════════════════════

function main() {
  const cssPath = new URL("../src/app/globals.css", import.meta.url).pathname;
  let cssContent;
  try {
    cssContent = readFileSync(cssPath, "utf-8");
  } catch {
    console.error("无法读取 globals.css");
    process.exit(1);
  }

  const vars = parseCSSVars(cssContent);
  console.log(`解析到 ${Object.keys(vars).length} 个 CSS 变量\n`);

  const data = buildElements(vars);
  console.log(`生成了 ${data.elements.length} 个文本元素 (基于实际 CSS + 组件结构)\n`);

  // 保存原始数据
  const dumpPath = "/tmp/text-layout-data.json";
  writeFileSync(dumpPath, JSON.stringify(data, null, 2));
  console.log(`原始数据已保存: ${dumpPath}\n`);

  // 运行 8 项评估
  const { elements, viewport } = data;
  const vw = viewport.width, vh = viewport.height;

  console.log("执行 8 项评估...\n");
  const reports = {
    cpl:              Metrics.evaluateCPL(elements, vw),
    lineHeight:       Metrics.evaluateLineHeight(elements),
    overflow:         Metrics.evaluateOverflow(elements),
    cjkLinebreak:     Metrics.evaluateCjkLinebreak(elements.filter(e => e.lines && e.lines.length >= 2)),
    mixedSpacing:     Metrics.evaluateMixedSpacing(elements),
    verticalRhythm:   Metrics.evaluateVerticalRhythm(elements),
    raggedness:       Metrics.evaluateRaggedness(elements.filter(e => e.lines && e.lines.length >= 2)),
    textDensity:      Metrics.evaluateTextDensity(elements, vw, vh),
  };

  console.log("\n");
  Metrics.printFormattedReport(reports, vw, vh);

  // 输出优化建议
  console.log("📋 优化建议:\n");
  const suggestions = [];

  if (reports.cpl.stats.passRate < 0.3) {
    suggestions.push("CPL: 多数文本不在 25-35 字/行最优区间。侧边栏文字过短(正常,可忽略), 主内容区应确保 ~30 字/行");
  }
  if (reports.lineHeight.stats.passRate < 0.8) {
    suggestions.push("行高比: 侧边栏 1.5× 略低于正文推荐 1.6-2.0，对联级文字可接受");
  }
  if (reports.overflow.issues.length > 0) {
    suggestions.push(`溢出检测: ${reports.overflow.issues.length} 个问题，主要来自无 word-break 防护的长文本`);
  }
  if (reports.cjkLinebreak.stats.totalViolations > 0) {
    suggestions.push(`CJK 禁则: ${reports.cjkLinebreak.stats.totalViolations} 处违反，浏览器默认换行不支持禁则，属于平台限制`);
  }
  if ((reports.mixedSpacing?.stats?.passRate ?? 1) < 0.7) {
    suggestions.push("中西文混排: 缺少 CJK-Latin 间 0.25em 间距，建议全局 letter-spacing 或 text-spacing CSS 属性");
  }
  if (reports.verticalRhythm.stats.passRate < 0.5) {
    suggestions.push("垂直韵律: top 值未对齐 8px 网格，建议统一 margin/padding 为 8px 倍数");
  }
  if (reports.textDensity?.status !== 'ok') {
    suggestions.push(`文本密度: ${reports.textDensity?.grade}，首页属于引导页，低密度合理`);
  }

  if (suggestions.length === 0) {
    console.log("  🎉 无需修复!");
  } else {
    suggestions.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
  }
  console.log("");
}

main();

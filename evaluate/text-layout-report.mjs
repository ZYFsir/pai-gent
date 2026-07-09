#!/usr/bin/env node

/**
 * text-layout-report.mjs — 中文排版度量评估报告
 *
 * 评估 8 个文字 Layout 维度 + 4 个 Widget 控件维度:
 *   文字: ①CPL ②行高比 ③溢出检测 ④CJK禁则 ⑤混排间距 ⑥垂直韵律 ⑦参差度 ⑧密度
 *   控件: ⑨元素遮挡 ⑩文字裁剪 ⑪边框距离 ⑫触控面积
 *
 * 数据来源 (三种模式):
 *   a) 在线采集: node scripts/text-layout-report.mjs http://localhost:3000
 *       自动启动 Playwright 加载页面并采集数据 (需 Playwright 可用)
 *
 *   b) 离线文件: node scripts/text-layout-report.mjs --from-file <json-path>
 *       使用预先通过浏览器控制台采集的 JSON 数据文件
 *       采集方法见: scripts/collect-text-data.js
 *
 *   c) 演示模式: node scripts/text-layout-report.mjs --demo
 *       使用内置模拟数据验证评估模块运行 (无需浏览器)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import * as Metrics from "./text-metrics.mjs";
import * as Widget from "./widget-metrics.mjs";

// ═══════════════════════════════════════════════════════
// 全局配置
// ═══════════════════════════════════════════════════════

const VERSION = "1.0.0";
const DEMO_VIEWPORT = { width: 1440, height: 900 };

// ═══════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════

function printBanner(url, vw, vh) {
  console.log("┌──────────────────────────────────────────────┐");
  console.log("│  中文排版度量评估 v" + VERSION.padEnd(38) + "│");
  console.log("│  " + (url || "离线模式").padEnd(45) + "│");
  console.log("│  视口: " + String(vw).padEnd(4) + "×" + String(vh).padEnd(4) + " px                           │");
  console.log("└──────────────────────────────────────────────┘\n");
}

/**
 * 加载数据: 文件 → JSON 解析 → 校验
 */
function loadFromFile(filePath) {
  if (!existsSync(filePath)) {
    console.error(`❌ 文件不存在: ${filePath}`);
    process.exit(1);
  }
  const raw = readFileSync(filePath, "utf-8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`❌ JSON 解析失败: ${e.message}`);
    process.exit(1);
  }
  if (!data.elements || !Array.isArray(data.elements)) {
    console.error("❌ 数据格式错误: 缺少 elements 数组");
    process.exit(1);
  }
  const vw = data.viewport?.width || DEMO_VIEWPORT.width;
  const vh = data.viewport?.height || DEMO_VIEWPORT.height;
  console.log(`   已加载 ${data.elements.length} 个文本元素 (${vw}×${vh})\n`);
  return { elements: data.elements, viewport: { width: vw, height: vh } };
}


// ═══════════════════════════════════════════════════════
// 核心执行: 对元素数组运行所有评估
// ═══════════════════════════════════════════════════════

function runAllEvaluations(elements, vw, vh) {
  const reports = {};

  // 1. CPL
  console.time("   ① CPL");
  reports.cpl = Metrics.evaluateCPL(elements, vw);
  console.timeEnd("   ① CPL");

  // 2. 行高比
  console.time("   ② 行高比");
  reports.lineHeight = Metrics.evaluateLineHeight(elements);
  console.timeEnd("   ② 行高比");

  // 3. 溢出检测
  console.time("   ③ 溢出检测");
  reports.overflow = Metrics.evaluateOverflow(elements);
  console.timeEnd("   ③ 溢出检测");

  // 4. CJK 禁则 (需要 lines 数据)
  console.time("   ④ CJK 禁则");
  const hasLines = elements.filter(e => e.lines && e.lines.length >= 2);
  reports.cjkLinebreak = Metrics.evaluateCjkLinebreak(hasLines);
  console.timeEnd("   ④ CJK 禁则");

  // 5. CJK-Latin 混排
  console.time("   ⑤ CJK-Latin 混排");
  reports.mixedSpacing = Metrics.evaluateMixedSpacing(elements);
  console.timeEnd("   ⑤ CJK-Latin 混排");

  // 6. 垂直韵律
  console.time("   ⑥ 垂直韵律");
  reports.verticalRhythm = Metrics.evaluateVerticalRhythm(elements);
  console.timeEnd("   ⑥ 垂直韵律");

  // 7. 段落参差度
  console.time("   ⑦ 段落参差度");
  reports.raggedness = Metrics.evaluateRaggedness(hasLines);
  console.timeEnd("   ⑦ 段落参差度");

  // 8. 文本密度
  console.time("   ⑧ 文本密度");
  reports.textDensity = Metrics.evaluateTextDensity(elements, vw, vh);
  console.timeEnd("   ⑧ 文本密度");

  // ── Widget 控件布局评估 ──
  console.log("");

  // W1. 元素遮挡
  console.time("   Ⓦ1 元素遮挡");
  reports.overlaps = Widget.evaluateOverlaps(elements);
  console.timeEnd("   Ⓦ1 元素遮挡");

  // W2. 文字裁剪
  console.time("   Ⓦ2 文字裁剪");
  reports.textClipping = Widget.evaluateTextClipping(elements);
  console.timeEnd("   Ⓦ2 文字裁剪");

  // W3. 边框距离
  console.time("   Ⓦ3 边框距离");
  reports.borderProximity = Widget.evaluateBorderProximity(elements);
  console.timeEnd("   Ⓦ3 边框距离");

  // W4. 触控面积
  console.time("   Ⓦ4 触控面积");
  reports.touchTargets = Widget.evaluateTouchTargets(elements);
  console.timeEnd("   Ⓦ4 触控面积");

  return reports;
}


// ═══════════════════════════════════════════════════════
// 演示数据生成器 (无浏览器模式)
// ═══════════════════════════════════════════════════════

function generateDemoData() {
  const vw = DEMO_VIEWPORT.width;
  const vh = DEMO_VIEWPORT.height;

  const FONT_BODY = 16;
  const FONT_H1 = 26;
  const FONT_H2 = 20;
  const FONT_H3 = 18;
  const FONT_SM = 15;
  const FONT_CODE = 15;

  function el(el_selector, text, left, top, width, height, overrides) {
    const fontSize = overrides?.fontSize || FONT_BODY;
    const lh = overrides?.lineHeight || "1.8";
    return {
      selector: el_selector,
      rect: { left, top, width, height },
      tagName: overrides?.tagName || el_selector.split(/[.#\[]/)[0],
      role: overrides?.role || '',
      tabIndex: overrides?.tabIndex != null ? overrides.tabIndex : -1,
      depth: overrides?.depth ?? 5,
      zIndex: overrides?.zIndex ?? 0,
      style: {
        fontSize,
        lineHeight: lh,
        letterSpacing: overrides?.letterSpacing != null ? overrides.letterSpacing : fontSize * 0.02,
        wordSpacing: 0,
        whiteSpace: overrides?.whiteSpace || "normal",
        overflow: overrides?.overflow || "visible",
        textOverflow: overrides?.textOverflow || "",
        wordBreak: overrides?.wordBreak || "",
        overflowWrap: overrides?.overflowWrap || "",
        fontWeight: overrides?.fontWeight || 400,
        textAlign: overrides?.textAlign || "left",
        paddingLeft: overrides?.paddingLeft || 0,
        paddingRight: overrides?.paddingRight || 0,
        paddingTop: overrides?.paddingTop || 0,
        paddingBottom: overrides?.paddingBottom || 0,
        position: overrides?.position || '',
      },
      text,
      scrollWidth: width + (overrides?.extraScroll || 0),
      clientWidth: width,
      scrollHeight: height + (overrides?.extraScrollV || 0),
      clientHeight: height,
      parentOverflow: false,
      lines: [],
    };
  }

  function lines(text, baseTop, left, width, lineHeight) {
    const result = [];
    const charsPerLine = Math.floor(width / 16);
    let pos = 0;
    let lineIdx = 0;
    while (pos < text.length) {
      const chunk = text.slice(pos, pos + charsPerLine);
      const top = baseTop + lineIdx * lineHeight;
      result.push({
        text: chunk,
        rect: { left, top, width: chunk.length * 16, height: lineHeight, right: left + chunk.length * 16, bottom: top + lineHeight },
      });
      pos += charsPerLine;
      lineIdx++;
    }
    return result;
  }

  // 模拟页面内容
  const demo = [
    // 刊头
    el("h1.masthead", "π", 260, 20, 200, 120, { fontSize: 96, lineHeight: "1.2", fontWeight: 400 }),

    // 侧边栏
    el("div.sidebar-title", "pi · 编码助手", 20, 80, 220, 28, { fontSize: 15, lineHeight: "1.5", fontWeight: 600 }),
    el("div.sidebar-item", "新建对话", 20, 120, 220, 22, { fontSize: 15, lineHeight: "1.5" }),
    el("div.sidebar-item", "历史记录", 20, 148, 220, 22, { fontSize: 15, lineHeight: "1.5" }),

    // 助手消息
    el("div.assistant-msg", "你好！我是 pi，你的编码助手。有什么我可以帮你的吗？", 280, 120, 600, 56,
      { fontSize: FONT_BODY, lineHeight: "1.8" }),

    // 用户消息 (含混排)
    el("div.user-msg", "帮我写一个 React Hook useDebounce", 720, 200, 500, 28,
      { fontSize: FONT_BODY, lineHeight: "1.8", paddingLeft: 16, paddingRight: 16 }),

    // 助手回复 (含 CJK-Latin 混排)
    el("div.assistant-msg", "好的，这里是一个 useDebounce Hook 的实现：\n它使用 useEffect 和 setTimeout 来实现防抖。", 280, 260, 620, 56,
      { fontSize: FONT_BODY, lineHeight: "1.8" }),

    // 代码块
    el("pre.code-block", "const useDebounce = (value, delay) => {\n  const [debouncedValue, setDebouncedValue] = useState(value);\n  useEffect(() => {\n    const timer = setTimeout(() => setDebouncedValue(value), delay);\n    return () => clearTimeout(timer);\n  }, [value, delay]);\n  return debouncedValue;\n};", 300, 340, 580, 160,
      { fontSize: FONT_CODE, lineHeight: "1.6" }),

    // 长文本段落
    el("p.prose", "这篇文章介绍了在 React 应用中使用 TypeScript 的最佳实践。" +
      "我们将从基础的类型定义开始，逐步深入到高级泛型和类型体操。" +
      "通过合理的类型设计，可以显著提高代码的可维护性和开发效率。" +
      "在后续的章节中，还会介绍如何与 Zustand 状态管理库配合使用。",
      280, 520, 620, 104,
      { fontSize: FONT_BODY, lineHeight: "1.8", textAlign: "justify" }),

    // 小字提示
    el("span.hint-text", "按 Ctrl+Enter 发送消息 · Markdown 格式", 280, 640, 300, 20,
      { fontSize: 12, lineHeight: "1.5", fontWeight: 400, letterSpacing: 0 }),

    // 标题
    el("h1.page-title", "项目文档", 260, 680, 400, 32,
      { fontSize: FONT_H1, lineHeight: "1.4", fontWeight: 700, letterSpacing: 0.06 * FONT_H1 }),
    el("h2.section-title", "安装指南", 260, 730, 300, 28,
      { fontSize: FONT_H2, lineHeight: "1.4", fontWeight: 700, letterSpacing: 0.06 * FONT_H2 }),
    el("p.prose", "通过 npm install 命令安装依赖包。", 260, 770, 400, 28,
      { fontSize: FONT_BODY, lineHeight: "1.8" }),
    el("h3.sub-title", "注意事项", 260, 810, 300, 24,
      { fontSize: FONT_H3, lineHeight: "1.4", fontWeight: 700 }),
    el("p.prose", "请确保 Node.js 版本 ≥ 18。建议使用 pnpm 或 bun 作为包管理器以提升安装速度。", 260, 846, 620, 52,
      { fontSize: FONT_BODY, lineHeight: "1.8" }),

    // 溢出测试
    el("div.overflow-test", "这是一个非常长的没有换行的文本内容用来测试溢出检测功能是否能够正确识别",
      280, 920, 300, 22,
      { fontSize: 14, lineHeight: "1.5", whiteSpace: "nowrap", overflow: "hidden",
        extraScroll: 200 }),

    // ── 交互控件 ──
    el("button.send-btn", "发送", 1100, 640, 80, 36,
      { fontSize: FONT_BODY, lineHeight: "1.5", fontWeight: 600,
        tagName: "button", role: "button", tabIndex: 0,
        paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8 }),

    el("button.icon-btn", "×", 1180, 120, 24, 24,
      { fontSize: 18, lineHeight: "1", fontWeight: 400,
        tagName: "button", role: "button", tabIndex: 0,
        paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 }),

    el("input.chat-input", "输入消息...", 280, 636, 800, 44,
      { fontSize: FONT_BODY, lineHeight: "1.5",
        tagName: "input", role: "textbox", tabIndex: 0,
        paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }),

    el("a.tiny-link", "隐私政策", 280, 700, 56, 16,
      { fontSize: 12, lineHeight: "1.4",
        tagName: "a", role: "link", tabIndex: 0,
        paddingLeft: 0, paddingRight: 0 }),

    el("button.menu-item", "设置", 20, 180, 220, 32,
      { fontSize: 14, lineHeight: "1.5",
        tagName: "button", role: "menuitem", tabIndex: 0,
        paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6 }),
    el("button.menu-item", "帮助", 20, 216, 220, 32,
      { fontSize: 14, lineHeight: "1.5",
        tagName: "button", role: "menuitem", tabIndex: 0,
        paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6 }),

    // ── 重叠测试场景: fixed 侧边栏遮盖主内容 ──
    el("aside.fixed-sidebar", "会话列表", 0, 0, 260, 200,
      { fontSize: 16, lineHeight: "1.5", fontWeight: 700,
        tagName: "aside", depth: 3, zIndex: 50,
        position: "fixed",
        paddingLeft: 16, paddingRight: 16, paddingTop: 16 }),
    el("button.sidebar-item", "编码助手", 12, 44, 236, 28,
      { fontSize: 14, lineHeight: "1.5",
        tagName: "button", role: "button", tabIndex: 0,
        depth: 4, zIndex: 50, position: "fixed", paddingLeft: 12 }),
    el("button.sidebar-item", "项目文档", 12, 76, 236, 28,
      { fontSize: 14, lineHeight: "1.5",
        tagName: "button", role: "button", tabIndex: 0,
        depth: 4, zIndex: 50, position: "fixed", paddingLeft: 12 }),
    el("main.main-content", "欢迎使用编码助手", 0, 108, 700, 36,
      { fontSize: 22, lineHeight: "1.5", fontWeight: 700,
        tagName: "main", depth: 3 }),

    // ── 模拟真实 HomePage 内容被侧边栏遮挡 ──
    // 主内容页面靠左, 内容从 left=24 (px-6 padding) 开始
    el("h1.home-title", "编码助手", 24, 140, 400, 36,
      { fontSize: 24, lineHeight: "1.4", fontWeight: 700,
        tagName: "h1", depth: 4 }),
    el("p.home-desc", "AI 编码代理 — 阅读、编写、编辑、执行、搜索，以报刊之姿，呈代码之美。",
      24, 184, 550, 44,
      { fontSize: 14, lineHeight: "1.8",
        tagName: "p", depth: 4 }),
    el("button.home-cta", "＋ 新建会话", 24, 248, 200, 44,
      { fontSize: 14, lineHeight: "1.5", fontWeight: 600,
        tagName: "button", role: "button", tabIndex: 0, depth: 4,
        paddingLeft: 20, paddingRight: 20 }),
    // 卡片框
    el("div.tool-card", "read\n读取文件内容", 24, 320, 180, 72,
      { fontSize: 12, lineHeight: "1.5",
        tagName: "div", depth: 4,
        paddingLeft: 12, paddingRight: 12, paddingTop: 12 }),
    el("div.tool-card", "edit\n编辑文件", 220, 320, 180, 72,
      { fontSize: 12, lineHeight: "1.5",
        tagName: "div", depth: 4,
        paddingLeft: 12, paddingRight: 12, paddingTop: 12 }),
    el("div.tool-card", "write\n创建文件", 416, 320, 180, 72,
      { fontSize: 12, lineHeight: "1.5",
        tagName: "div", depth: 4,
        paddingLeft: 12, paddingRight: 12, paddingTop: 12 }),
  ];

    // ── 对多行元素补充 lines 数据 ──
  for (const d of demo) {
    if (d.text.length > 20 && (d.selector.includes('prose') || d.selector.includes('assistant'))) {
      const lh = parseFloat(d.style.lineHeight) || 1.8;
      const lineHeightPx = d.style.fontSize * lh;
      const generated = lines(d.text, d.rect.top, d.rect.left, d.rect.width, lineHeightPx);
      if (generated.length >= 2) {
        d.lines = generated;
      }
    }
  }

  return {
    elements: demo,
    viewport: { width: vw, height: vh },
  };
}


// ═══════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  let data;

  // ── 解析参数 ──
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
用法:
  node scripts/text-layout-report.mjs <url> [width] [height]
      在线模式 — 加载页面并自动采集 (需 Playwright 可用)

  node scripts/text-layout-report.mjs --from-file <json-file>
      离线模式 — 使用浏览器控制台采集的 JSON 数据
      采集脚本: scripts/collect-text-data.js

  node scripts/text-layout-report.mjs --demo
      演示模式 — 使用内置模拟数据 (无需浏览器)

  node scripts/text-layout-report.mjs --dump-to <json-file> <url> [width] [height]
      采集模式 — 仅采集原始数据保存到文件，不生成报告
`);
    process.exit(0);
  }

  if (args[0] === '--demo') {
    printBanner("演示模式 (模拟数据)", DEMO_VIEWPORT.width, DEMO_VIEWPORT.height);
    data = generateDemoData();
    console.log(`   生成了 ${data.elements.length} 个模拟文本元素\n`);

  } else if (args[0] === '--from-file') {
    const filePath = args[1];
    if (!filePath) {
      console.error("❌ 请指定 JSON 文件路径: --from-file <path>");
      process.exit(1);
    }
    printBanner("离线模式 (" + filePath + ")", 0, 0);
    data = loadFromFile(filePath);

  } else if (args[0] === '--dump-to') {
    const dumpPath = args[1];
    const url = args[2] || "http://localhost:3000";
    const vw = parseInt(args[3] || "1440");
    const vh = parseInt(args[4] || "900");

    console.log("   尝试启动 Playwright 采集数据...\n");

    let playwright;
    try {
      const { createRequire } = await import("module");
      const req = createRequire(import.meta.url);
      playwright = req("/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright");
    } catch (e) {
      console.error("❌ Playwright 不可用。请在浏览器控制台使用 collect-text-data.js 采集，然后:");
      console.error(`   node scripts/text-layout-report.mjs --from-file <your-file>`);
      process.exit(1);
    }

    if (playwright) {
      try {
        const browser = await playwright.chromium.launch({ headless: true });
        const context = await browser.newContext({
          viewport: { width: vw, height: vh },
          deviceScaleFactor: 1,
          locale: "zh-CN",
        });
        const page = await context.newPage();
        await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
        await page.waitForTimeout(2000);

        const collectCode = readFileSync(
          new URL("./collect-text-data.js", import.meta.url), "utf-8"
        );
        const raw = await page.evaluate(collectCode);
        const json = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
        writeFileSync(dumpPath, json);
        console.log(`✅ 数据已保存到: ${dumpPath}`);
        await browser.close();
      } catch (e) {
        console.error("❌ 采集失败:", e.message);
        process.exit(1);
      }
    }
    return;

  } else {
    // 在线模式
    const url = args[0];
    const vw = parseInt(args[1] || "1440");
    const vh = parseInt(args[2] || "900");
    printBanner(url, vw, vh);

    console.log("   尝试启动 Playwright 采集数据...\n");

    let playwright;
    try {
      const { createRequire } = await import("module");
      const req = createRequire(import.meta.url);
      playwright = req("/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright");
    } catch (e) {
      console.error("❌ Playwright 在本环境不可用。");
      console.error("\n   请使用浏览器控制台采集数据:");
      console.error("   1. 打开 " + url);
      console.error("   2. 打开开发者工具 (F12) → Console");
      console.error("   3. 复制 scripts/collect-text-data.js 的全部内容并粘贴到控制台 → 回车");
      console.error("   4. 复制输出的 JSON 并保存到文件");
      console.error("   5. 运行: node scripts/text-layout-report.mjs --from-file <your-file>\n");
      process.exit(1);
    }

    try {
      const browser = await playwright.chromium.launch({ headless: true });
      const context = await browser.newContext({
        viewport: { width: vw, height: vh },
        deviceScaleFactor: 1,
        locale: "zh-CN",
      });
      const page = await context.newPage();
      console.log("   加载页面: " + url);
      await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(2000);

      const collectCode = readFileSync(
        new URL("./collect-text-data.js", import.meta.url), "utf-8"
      );
      console.log("   采集文本布局数据...");
      const raw = await page.evaluate(collectCode);
      const json = typeof raw === 'string' ? JSON.parse(raw) : raw;
      data = { elements: json.elements, viewport: json.viewport };
      console.log(`   采集完成: ${data.elements.length} 个文本元素\n`);

      const dumpFile = "/tmp/text-layout-data.json";
      writeFileSync(dumpFile, JSON.stringify(json, null, 2));
      console.log("   原始数据已保存: " + dumpFile);

      await browser.close();
    } catch (e) {
      console.error("❌ 采集失败:", e.message);
      process.exit(1);
    }
  }

  // ── 运行全部评估 ──
  const vw = data.viewport?.width || DEMO_VIEWPORT.width;
  const vh = data.viewport?.height || DEMO_VIEWPORT.height;

  console.log("   执行 8 项文字 + 4 项控件评估...\n");
  const reports = runAllEvaluations(data.elements, vw, vh);

  // ── 输出报告 ──
  console.log("\n");
  Metrics.printFormattedReport(reports, vw, vh);
  Widget.printWidgetReport(reports);
}

main().catch(e => {
  console.error("\n❌ 未捕获错误:", e.message);
  process.exit(1);
});

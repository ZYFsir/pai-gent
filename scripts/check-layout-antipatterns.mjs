#!/usr/bin/env node
/**
 * 布局反模式检测 — 静态分析 JSX/TSX
 *
 * 检测的核心模式：
 *   同一个元素上 flex-1 + overflow-y:auto → 双向滚动容器
 *   └── 子元素用 mx-auto 居中 → margin-inline 可能不生效
 *
 * 用法: node scripts/check-layout-antipatterns.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { globSync } from 'fs';

// ─── 解析工具 ───

// 解析 className 字符串，提取 Tailwind 类名
function parseClassNames(nodeText) {
  const classes = [];

  // className="xxx yyy"
  const attrMatch = nodeText.match(/className=["']([^"']*)["']/);
  if (attrMatch) classes.push(...attrMatch[1].split(/\s+/));

  // className={`xxx ${...} yyy`} — 只提取静态部分
  const tmplMatch = nodeText.match(/className=\{`([^`]*(?:\$\{[^}]*\}[^`]*)*)`\}/);
  if (tmplMatch) {
    const parts = tmplMatch[1].split(/\$\{[^}]+\}/);
    parts.forEach(p => classes.push(...p.split(/\s+/)));
  }

  // className={"xxx"} 或 className={condition ? "xxx" : "yyy"}
  const exprMatch = nodeText.match(/className=\{([^}]+)\}/);
  if (exprMatch && !tmplMatch) {
    const s = exprMatch[1];
    // 简单提取字符串字面量
    const strs = s.match(/"([^"]*)"|'([^']*)'/g);
    if (strs) strs.forEach(st => {
      const clean = st.replace(/["']/g, '');
      classes.push(...clean.split(/\s+/));
    });
  }

  return classes.filter(Boolean);
}

// 检查 inline style 中是否有 margin auto
function hasInlineMarginAuto(nodeText) {
  // margin: "0 auto" / margin: "auto" / marginInline: "auto" / marginLeft: "auto"
  const patterns = [
    /margin(?:Inline|Left|Right)?["']?\s*:\s*['"]?auto['"]?/i,
    /margin(?:Inline|Left|Right)?["']?\s*:\s*['"]?0\s+auto['"]?/i,
  ];
  return patterns.some(p => p.test(nodeText));
}

// ─── 检测 1: w-full + max-w + margin: auto 冲突 ───
// width: 100% + max-width + margin: auto 三个在同一元素上时，
// width: 100% 会干扰 margin auto 的剩余空间分配

function detectWidthConflict(lines) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    const hasWFull = /\bw-full\b/.test(line) || /width\s*[:=]\s*['"`]100%['"`]/.test(line);
    const hasMaxW = /\bmax-w-\w+\b/.test(line) || /maxWidth\s*[:=]/.test(line);
    const hasMarginAuto =
      /\bmx-auto\b/.test(line) ||
      /margin(?:Left|Right)?\s*[:=]\s*['"`]?auto['"`]?/i.test(line);

    if (hasWFull && hasMaxW && hasMarginAuto) {
      warnings.push({
        file: filePath,
        line: lineNum,
        code: line.trim().substring(0, 120),
        detail: 'w-full + max-w + margin:auto 三者并存，width:100% 可能干扰 margin auto 居中',
        children: [],
      });
    }
  }
}

// ─── 检测 2: flex-1 + overflow 容器内使用 margin auto 居中 ───

let totalFiles = 0;
const warnings = [];

function scanFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  detectWidthConflict(lines);

  // 找出所有 JSX 元素及其行号范围
  // 简化的方法：逐行扫描，记录开标签的行号和类名

  let inJSX = false;
  let jsxDepth = 0;
  let currentElement = null; // { tag, line, classes, hasOverflow, hasFlex1 }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // 检测 JSX 元素：<div ...> 或 <Fragment> 等
    const openTagMatch = line.match(/<(\w[\w-]*)([^>]*)\/?>/);
    if (openTagMatch && !line.includes('</')) {
      const tag = openTagMatch[1];
      const attrs = openTagMatch[2];
      const classes = parseClassNames(line);
      const isSelfClosing = line.includes('/>');

      const hasFlex1 = classes.some(c =>
        /^flex-1$/.test(c) || c === 'flex-1' || /flex\s*:\s*1(?:\s|;|$)/.test(attrs)
      );
      const hasOverflowAuto = classes.some(c =>
        /^overflow(?:-y)?-auto$/.test(c) || /^overflow-auto$/.test(c)
      ) || /overflow(?:-y)?\s*:\s*auto/.test(attrs);

      // 如果有 flex-1 + overflow-auto 在同一元素上 → 触发检测
      if (hasFlex1 && hasOverflowAuto) {
        // 检查这个元素的子元素中是否有 mx-auto 或 inline margin auto
        // 往下扫描直到闭合标签（简化版：找第一个匹配缩进的同级闭合）
        const indent = line.search(/\S/);
        let childLines = [];
        let depth = 1;
        let j = i;
        while (j < lines.length && depth > 0) {
          j++;
          if (j >= lines.length) break;
          const childLine = lines[j];
          // 跳过纯 JSX 表达式行 { ... }
          if (/^\s*\{[^}]+\}\s*$/.test(childLine)) continue;
          // 开标签计数
          const opens = (childLine.match(/<(\w[\w-]*)[\s>]/g) || []).length;
          const closes = (childLine.match(/<\/\w[\w-]*>/g) || []).length;
          const selfCloses = (childLine.match(/<\w[\w-]*[^>]*\/>/g) || []).length;
          depth += opens - closes - selfCloses;
          if (depth > 0) {
            childLines.push({ line: j + 1, text: childLine });
          }
        }

        // 逐行检测子元素中的危险居中方式
        // 危险: mx-auto (Tailwind v4 = margin-inline: auto, 逻辑属性)
        // 危险: marginInline / margin-inline: auto
        // 安全: marginLeft / marginRight / margin-left / margin-right: auto (物理属性, 不受影响)
        const foundInChildren = [];
        for (const cl of childLines) {
          const hasDangerousCentering =
            /\bmx-auto\b/.test(cl.text) ||
            /margin[-_]?inline\s*[:=]\s*['"`]?auto['"`]?/i.test(cl.text);
          if (hasDangerousCentering) {
            foundInChildren.push({ line: cl.line, text: cl.text.trim().substring(0, 100) });
          }
        }

        if (foundInChildren.length > 0) {
          warnings.push({
            file: filePath,
            line: lineNum,
            code: line.trim().substring(0, 120),
            detail: `含 flex-1 + overflow-auto 的容器，子元素中发现 ${foundInChildren.length} 处 margin auto 居中`,
            children: foundInChildren,
          });
        }
      }
    }
  }
}

// ─── 遍历源码 ───

function scanDir(dir) {
  const srcDir = new URL(dir, import.meta.url).pathname;
  const files = globSync(`${srcDir}/**/*.{tsx,jsx}`);

  for (const file of files) {
    try {
      scanFile(file);
      totalFiles++;
    } catch (e) {
      console.error(`  ⚠  ${file}: ${e.message}`);
    }
  }
}

// ─── 主入口 ───

console.log('\n🔍  布局反模式检测\n');

scanDir('../src');

if (warnings.length === 0) {
  console.log(`  ✅ 已扫描 ${totalFiles} 个文件，未发现风险模式\n`);
} else {
  console.log(`  ⚠  发现 ${warnings.length} 处潜在风险:\n`);
  for (const w of warnings) {
    console.log(`  ── ${w.file}:${w.line}`);
    console.log(`     代码: ${w.code}`);
    console.log(`     问题: ${w.detail}`);
    if (w.children && w.children.length > 0) {
      for (const c of w.children) {
        console.log(`       · 行 ${c.line}: ${c.text}`);
      }
    }
    console.log("");
  }
}

// ─── 退出码 ───
process.exit(warnings.length > 0 ? 1 : 0);

#!/usr/bin/env node
/**
 * 布局验证脚本 — 验证修复后的 CSS 是否符合预期。
 *
 * 用途: 
 *   1. 解析源码中关键元素的 style 和 class
 *   2. 检查已知的布局陷阱是否被正确回避
 *   3. 需要浏览器时输出提示，不阻塞 CI
 *
 * 未来可扩展: 接入 Playwright/Puppeteer 做像素级验证
 *   (目前服务器环境没有可用浏览器)
 */

import { readFileSync } from 'fs';
import { globSync } from 'fs';

let passed = 0;
let failed = 0;

function check(description, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.log(`  ❌ ${description}`);
    if (detail) console.log(`     ${detail}`);
    failed++;
  }
}

// ─── 验证 1: 分割线必须有显式宽度 ───
// 踩坑记录: max-width 只设上限不设实际宽度，空 div 的 auto-width 为 0

function verifySectionRules(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let inSectionRule = false;
  let hasExplicitWidth = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检测 section-rule 或 section-rule-sm 的使用处
    if (/section-rule/.test(line) && !/\.section-rule/.test(line)) {
      // 检查是否在 flex justify-center 容器内
      const inFlexCenter = /flex.*justify.*center/.test(lines[i - 1] || '') || 
                           /justify.*center/.test(line) ||
                           /justifyContent.*center/.test(line);
      
      // 检查有无显式 width 或 w-[...]
      const hasWidth = /\bwidth\b|\bw-\[\d+\]/.test(line);
      const hasStyleWidth = /style.*width/.test(line);

      if (inFlexCenter && !hasWidth && !hasStyleWidth) {
        check(`行 ${i + 1}: section-rule 在 flex-center 内但无显式宽度`,
              false,
              'flex justify-center 内的空元素必须设 width，不能只靠 max-width');
      }
    }
  }
}

// ─── 验证 2: flex-1 + overflow 容器内没有 mx-auto 后代 ───

function verifyNoDangerousMxAuto(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  
  // 找 flex-1 + overflow-y-auto 的容器
  const flexOverflowMatch = content.match(/<div[^>]*flex-1[^>]*overflow-y-auto[^>]*>/);
  if (!flexOverflowMatch) return;

  // 简化的后代搜索：找到容器后检查之后的 mx-auto
  const containerEnd = flexOverflowMatch.index + flexOverflowMatch[0].length;
  const afterContainer = content.slice(containerEnd);
  
  // 找闭合标签 (简化版)
  let depth = 1;
  let searchEnd = 0;
  for (let i = 0; i < afterContainer.length && depth > 0; i++) {
    if (afterContainer[i] === '<') {
      if (afterContainer[i + 1] === '/') depth--;
      else if (/<(\w)/.test(afterContainer.slice(i))) depth++;
    }
  }

  const childContent = afterContainer.slice(0, searchEnd || afterContainer.length);
  const mxAutoMatches = childContent.match(/\bmx-auto\b/g);

  if (mxAutoMatches) {
    check('flex-1 + overflow 容器内无 mx-auto', false,
      `发现 ${mxAutoMatches.length} 处 mx-auto，需改用 flex justify-center`);
  } else {
    check('flex-1 + overflow 容器内无 mx-auto', true);
  }
}

// ─── 验证 3: 分割行必须有 width 属性 ───
// 检测所有 .section-rule 的实际使用处

function verifyExplicitWidth(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  
  // 找所有 section-rule 和 section-rule-sm 的 JSX 使用
  const ruleRegex = /(<div[^>]*section-rule[^>]*\/?>)/g;
  let match;
  let found = 0;
  let ok = 0;

  while ((match = ruleRegex.exec(content)) !== null) {
    found++;
    const el = match[1];
    // 检查 style 中有 width 或者 Tailwind w-[...] 类
    const hasWidthInStyle = /style\s*=\s*\{[^}]*\bwidth\b[^}]*\}/.test(el);
    const hasWidthClass = /\bw-\[\d+\]/.test(el);
    
    if (hasWidthInStyle || hasWidthClass) {
      ok++;
    }
  }

  if (found === 0) {
    check('找到 section-rule 元素', false, '未找到任何 section-rule 使用处');
  } else {
    check(`所有 ${found} 个 section-rule 都有显式宽度`, found === ok,
      found !== ok ? `${found - ok} 个缺少显式宽度` : '');
  }
}

// ─── 主流程 ───

console.log('\n🔍  布局修复验证\n');

const files = globSync('src/**/*.tsx');
for (const file of files) {
  if (file.includes('node_modules')) continue;
  try {
    verifySectionRules(file);
    verifyExplicitWidth(file);
    verifyNoDangerousMxAuto(file);
  } catch (e) {
    console.log(`  ⚠  ${file}: ${e.message}`);
  }
}

console.log(`\n📊  结果: ${passed} 通过, ${failed} 失败\n`);

if (failed > 0) {
  console.log('  ⚠  静态验证发现不一致，建议手动检查。\n');
  console.log('  如需像素级验证（元素实际渲染位置），需要浏览器环境:\n');
  console.log('    npm install --save-dev playwright');
  console.log('    npx playwright install chromium');
  console.log('    # 然后运行 scripts/verify-layout-browser.mjs (待编写)\n');
}

process.exit(failed > 0 ? 1 : 0);

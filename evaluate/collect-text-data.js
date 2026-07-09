/**
 * collect-text-data.js — 浏览器端文本布局数据采集器
 *
 * 用法:
 *   1. 在目标页面打开浏览器开发者工具 (F12) → Console
 *   2. 粘贴本文件全部内容 → 回车
 *   3. 控制台会输出 JSON 字符串，复制全部
 *   4. 保存为 /tmp/text-layout-data.json
 *   5. 运行: node scripts/text-layout-report.mjs --from-file /tmp/text-layout-data.json
 *
 * 注意: 本脚本在页面完全加载后执行效果最佳。
 *       确保字体已加载、布局已稳定后再运行。
 */

(function() {
  'use strict';

  var SCREEN_W = window.innerWidth;
  var SCREEN_H = window.innerHeight;

  // ── 唯一选择器 ──
  function getUniqueSelector(el) {
    if (!el || el === document.body) return 'body';
    var tag = el.tagName.toLowerCase();
    var id = el.id ? '#' + el.id : '';
    var cls = Array.from(el.classList).filter(function(c) { return !c.startsWith('lucide'); }).join('.');
    return tag + id + (cls ? '.' + cls : '');
  }

  // ── 递归获取所有 textNode ──
  function getTextNodes(root) {
    var nodes = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var n;
    while ((n = walker.nextNode())) {
      if (n.textContent.trim().length > 0) nodes.push(n);
    }
    return nodes;
  }

  // ── 行级分析 ──
  function analyzeLines(el) {
    var text = el.innerText || '';
    if (!text.trim()) return [];

    var textNodes = getTextNodes(el);
    if (textNodes.length === 0) return [];

    try {
      var range = document.createRange();
      range.selectNodeContents(el);
      var lineRects = range.getClientRects();
      if (lineRects.length <= 1) return [];

      var lines = [];
      for (var li = 0; li < lineRects.length; li++) {
        var lr = lineRects[li];
        var lineChars = [];
        for (var tnIdx = 0; tnIdx < textNodes.length; tnIdx++) {
          var tn = textNodes[tnIdx];
          var nodeText = tn.textContent;
          for (var j = 0; j < nodeText.length; j++) {
            try {
              var cr = document.createRange();
              cr.setStart(tn, j);
              cr.setEnd(tn, j + 1);
              var charRects = cr.getClientRects();
              if (charRects.length > 0) {
                var centerY = charRects[0].top + charRects[0].height / 2;
                if (centerY >= lr.top && centerY <= lr.bottom) {
                  lineChars.push(nodeText[j]);
                }
              }
            } catch(e) { /* skip */ }
          }
        }
        lines.push({
          text: lineChars.join(''),
          rect: {
            left: lr.left, top: lr.top,
            width: lr.width, height: lr.height,
            right: lr.right, bottom: lr.bottom,
          },
        });
      }
      return lines;
    } catch(e) {
      return [];
    }
  }

  // ── 检查溢出父容器 ──
  function checkParentOverflow(el) {
    var parent = el.parentElement;
    if (!parent) return false;
    var pr = parent.getBoundingClientRect();
    var er = el.getBoundingClientRect();
    return er.right > pr.right + 1 || er.left < pr.left - 1;
  }

  // ── 采集 ──
  function collect() {
    var results = [];

    function visit(el, depth) {
      if (depth > 30) return;
      if (!el || !el.getBoundingClientRect) return;

      var tag = el.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'HEAD' || tag === 'META' || tag === 'TITLE' || tag === 'NOSCRIPT') return;

      var rect = el.getBoundingClientRect();
      var style = getComputedStyle(el);

      if (rect.width === 0 || rect.height === 0) return;
      if (style.display === 'none' || style.visibility === 'hidden') return;
      if (parseFloat(style.opacity) === 0) return;

      var text = (el.innerText || '').trim();
      var lowerTag = tag.toLowerCase();

      var textContainers = ['p','span','h1','h2','h3','h4','h5','h6','li','a','label','button','td','th','blockquote','pre','code','div','figcaption','header','footer','aside','article','section','dd','dt'];
      var isTextContainer = textContainers.indexOf(lowerTag) !== -1 && text.length > 0;

      if (isTextContainer) {
        var fontSize = parseFloat(style.fontSize) || 16;
        var letterSpacingStr = style.letterSpacing;
        var letterSpacing = letterSpacingStr === 'normal' ? 0 : (parseFloat(letterSpacingStr) || 0);

        var entry = {
          selector: getUniqueSelector(el),
          tagName: tag,
          role: el.getAttribute ? (el.getAttribute('role') || '') : '',
          tabIndex: el.tabIndex,
          depth: depth,
          zIndex: parseInt(style.zIndex) || 0,
          rect: {
            left: rect.left, top: rect.top,
            width: rect.width, height: rect.height,
          },
          style: {
            fontSize: fontSize,
            lineHeight: style.lineHeight,
            letterSpacing: letterSpacing,
            wordSpacing: style.wordSpacing === 'normal' ? 0 : (parseFloat(style.wordSpacing) || 0),
            whiteSpace: style.whiteSpace,
            overflow: style.overflow,
            textOverflow: style.textOverflow,
            wordBreak: style.wordBreak,
            overflowWrap: style.overflowWrap,
            fontWeight: parseInt(style.fontWeight) || 400,
            textAlign: style.textAlign,
            paddingLeft: parseFloat(style.paddingLeft) || 0,
            paddingRight: parseFloat(style.paddingRight) || 0,
            paddingTop: parseFloat(style.paddingTop) || 0,
            paddingBottom: parseFloat(style.paddingBottom) || 0,
          },
          text: text,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          parentOverflow: checkParentOverflow(el),
          lines: [],
        };

        if (text.length > 10 && el.children.length > 0) {
          var lines = analyzeLines(el);
          if (lines.length >= 2) {
            entry.lines = lines;
          }
        }

        results.push(entry);
      }

      for (var i = 0; i < el.children.length; i++) {
        visit(el.children[i], depth + 1);
      }
    }

    visit(document.body, 0);
    return {
      elements: results,
      viewport: { width: SCREEN_W, height: SCREEN_H },
    };
  }

  var data = collect();
  console.log('采集完成: ' + data.elements.length + ' 个文本元素');
  console.log(JSON.stringify(data, null, 2));
  return data;
})();

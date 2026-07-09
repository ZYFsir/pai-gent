"use client";

import type { Message } from "@/stores/chat-store";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { ThinkingBlock } from "./thinking-block";
import { ToolCallBlock } from "./tool-call-block";
import { useState, useCallback, Children, isValidElement } from "react";

function toCodeText(children: React.ReactNode): string {
  let result = "";
  const items = Children.toArray(children);
  for (const item of items) {
    if (typeof item === "string") result += item;
    else if (typeof item === "number") result += String(item);
    else if (isValidElement(item)) result += toCodeText((item as React.ReactElement<any>).props?.children);
    else if (Array.isArray(item)) result += toCodeText(item);
  }
  return result;
}

function findCodeElement(children: React.ReactNode) {
  const nodes = Children.toArray(children);
  return nodes.find(
    (node): node is React.ReactElement =>
      isValidElement(node) && typeof (node as any).type === "string" && (node as any).type === "code"
  ) || null;
}

/* ─── Code Block ─── */
function CodeBlock({ code, language, children }: { code: string; language?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lineCount = code ? code.split("\n").length : 0;
  const isLong = lineCount > 16;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div className="relative group my-2 first:mt-0 last:mb-0 overflow-hidden rounded-lg border border-[var(--code-border)]" style={{ background: "var(--code-bg)" }}>
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-[var(--code-border)]" style={{ background: "rgba(255,255,255,0.18)" }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-1.5 py-0.5 rounded border border-[var(--code-border)] text-[10px] text-[var(--text-secondary)] font-mono tracking-wide">
            {language || "text"}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
            {lineCount} 行
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isLong && (
            <button onClick={() => setExpanded((prev) => !prev)} className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-all">
              {expanded ? "收起" : "展开"}
            </button>
          )}
          <button onClick={handleCopy} className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-all">
            {copied ? "已复制" : "复制"}
          </button>
        </div>
      </div>
      <div className={`relative ${!expanded && isLong ? "max-h-80 overflow-hidden" : ""}`}>
        <pre className="code-block-pre !m-0 !rounded-none border-0 p-3 overflow-x-auto" style={{ background: "var(--code-bg)", color: "var(--code-text)" }}>
          {children}
        </pre>
        {!expanded && isLong && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 code-block-fade" />}
      </div>
    </div>
  );
}

/* ─── Message Bubble ─── */
function MessageBubble({ isUser, children }: { isUser: boolean; children: React.ReactNode }) {
  const baseClass = isUser
    ? "bg-[var(--bubble-user)] text-[var(--bubble-user-text)] shadow-[var(--shadow-soft)] max-w-[80%]"
    : "bg-[var(--bubble-assistant)] text-[var(--bubble-assistant-text)] border border-[var(--border-light)] max-w-[90%] md:max-w-[var(--content-width)]";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`px-5 py-3 ${baseClass}`}>{children}</div>
    </div>
  );
}

/* ─── Message Card ─── */
interface Props {
  message: Message;
  isStreaming?: boolean;
  isLast?: boolean;
}

export function MessageCard({ message, isStreaming, isLast }: Props) {
  const isUser = message.role === "user";
  const hasThinking = !isUser && !!message.thinking;
  const hasTools = !isUser && !!message.toolCalls && message.toolCalls.length > 0;
  const hasContent = !!message.content;

  return (
    <div className={`${isLast && !isStreaming ? "animate-slide-up" : ""}`}>
      <div className={`flex items-center gap-2 mb-1 ${isUser ? "justify-end" : ""}`}>
        <span className={`text-[10px] tracking-widest font-medium ${isUser ? "text-[var(--accent-warm)]" : "text-[var(--accent)]"}`}>
          {isUser ? "你" : "π"}
        </span>
        <span className="text-[10px] text-[var(--text-tertiary)] font-mono opacity-60">
          {new Date(message.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {hasThinking && <ThinkingBlock thinking={message.thinking!} />}
      {hasTools && <ToolCallBlock toolCalls={message.toolCalls!} />}

      {hasContent && (
        <MessageBubble isUser={isUser}>
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : (
            <div className="prose max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  pre({ children, node }) {
                    const codeElement = findCodeElement(children);

                    /* language — 从 HAST 节点取，比从 className 提取更可靠 */
                    const codeNode = (node as any)?.children?.find((child: any) => child.tagName === "code");
                    const classList: string[] = codeNode?.properties?.className || [];
                    const languageClass = classList.find((c: string) => c.startsWith("language-"));
                    const language = languageClass ? languageClass.replace("language-", "") : "";

                    /* plain text — 从 React 子节点提取，用于行数和复制 */
                    const raw = codeElement
                      ? toCodeText((codeElement as React.ReactElement<any>).props.children).replace(/\n$/, "")
                      : toCodeText(children).replace(/\n$/, "");
                    const code = raw || "";

                    return <CodeBlock code={code} language={language}>{children}</CodeBlock>;
                  },
                  code({ className, children, ...props }) {
                    return <code className={className} {...props}>{children}</code>;
                  },
                }}
              >
                {message.content || (isStreaming ? "" : "")}
              </ReactMarkdown>
            </div>
          )}
        </MessageBubble>
      )}

      {isStreaming && (
        <div className="flex items-center gap-2 mt-1 ml-1">
          <span className="inline-block w-1 h-4 bg-[var(--accent)] animate-blink rounded-sm" />
          <span className="text-[10px] text-[var(--text-tertiary)] tracking-wider">生成中</span>
        </div>
      )}
    </div>
  );
}

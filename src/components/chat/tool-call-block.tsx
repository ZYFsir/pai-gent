"use client";

import { useCallback, useMemo, useState } from "react";
import type { ToolCall } from "@/stores/chat-store";

function stringifyArgs(args: unknown) {
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args ?? "");
  }
}

function ToolSection({
  label,
  value,
  copyLabel,
}: {
  label: string;
  value: string;
  copyLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [value]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] tracking-widest" style={{ color: "var(--text-tertiary)" }}>
          {label}
        </span>
        <button
          onClick={handleCopy}
          className="text-[10px] transition-colors hover:text-[var(--accent)]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {copied ? "已复制" : copyLabel}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed overflow-x-auto border bg-[var(--code-bg)] border-[var(--code-border)] text-[var(--text-secondary)]">
        {value}
      </pre>
    </div>
  );
}

function ToolCallItem({ tc }: { tc: ToolCall }) {
  const [expanded, setExpanded] = useState(tc.status !== "done" || !!tc.toolOutput || !!tc.toolError);
  const isRunning = tc.status === "running" || tc.status === "pending";
  const isDone = tc.status === "done";
  const isError = tc.status === "error";
  const statusLabel = isRunning ? "执行中" : isDone ? "完成" : isError ? "失败" : "等待";
  const statusColor = isRunning ? "var(--accent)" : isDone ? "var(--success)" : isError ? "var(--error)" : "var(--text-tertiary)";
  const output = tc.toolOutput?.trim() || "";
  const argsText = useMemo(() => stringifyArgs(tc.args), [tc.args]);

  return (
    <div className="border" style={{ borderColor: "var(--border-light)", background: "var(--bg-surface)" }}>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors"
      >
        <span className="font-mono text-[10px] opacity-50">{expanded ? "▾" : "▸"}</span>
        <span className="font-mono text-xs truncate" style={{ color: "var(--text-primary)" }}>
          {tc.toolName}
        </span>
        {isRunning && <span className="animate-spin text-[10px]" style={{ color: statusColor }}>◎</span>}
        <span className="flex-1" />
        <span className="text-[10px] tracking-wide" style={{ color: statusColor }}>
          {statusLabel}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t" style={{ borderColor: "var(--border-light)" }}>
          <div className="pt-3">
            <ToolSection label="参数" value={argsText} copyLabel="复制参数" />
          </div>

          {!!output && <ToolSection label="输出" value={output} copyLabel="复制输出" />}

          {isError && tc.toolError && (
            <div className="space-y-1.5">
              <span className="text-[10px] tracking-widest" style={{ color: "var(--error)" }}>
                错误
              </span>
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed overflow-x-auto border" style={{ borderColor: "rgba(145,64,73,0.25)", background: "var(--error-bg)", color: "var(--error)" }}>
                {tc.toolError}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props { toolCalls: ToolCall[]; }

export function ToolCallBlock({ toolCalls }: Props) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="space-y-1.5 mb-2.5">
      <div className="text-[10px] text-[var(--text-tertiary)] tracking-widest ml-1 mb-1">
        工具调用 · {toolCalls.length}
      </div>
      {toolCalls.map((tc, i) => (
        <ToolCallItem key={tc.toolCallId || `tc-${i}`} tc={tc} />
      ))}
    </div>
  );
}

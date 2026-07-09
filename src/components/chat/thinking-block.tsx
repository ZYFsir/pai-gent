"use client";

import { useState } from "react";

interface Props { thinking: string; }

export function ThinkingBlock({ thinking }: Props) {
  const [open, setOpen] = useState(false);
  const lines = thinking.split("\n").length;

  return (
    <div className="mb-2.5 ml-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors group"
      >
        <span className="text-xs font-mono opacity-50 group-hover:opacity-100 transition-opacity">
          {open ? "▾" : "▸"}
        </span>
        <span className="tracking-wide font-medium">
          {open ? "收起" : "展开"} 思考过程
        </span>
        <span className="font-mono text-[10px] opacity-40">
          {lines} 行
        </span>
      </button>
      {open && (
        <div className="mt-1.5 p-3 bg-[var(--bg-surface)] border border-[var(--border-light)]">
          <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed font-mono">
            {thinking}
          </pre>
        </div>
      )}
    </div>
  );
}

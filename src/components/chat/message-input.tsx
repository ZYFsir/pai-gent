"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { useChatStore } from "@/stores/chat-store";

export function MessageInput() {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const abort = useChatStore((s) => s.abort);

  // Auto-resize textarea
  useEffect(() => {
    const ta = taRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
    }
  }, [text]);

  const handleSubmit = useCallback(() => {
    if (isStreaming) {
      abort();
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    sendMessage(trimmed);
  }, [text, isStreaming, abort, sendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape" && isStreaming) {
      abort();
    }
  };

  const canSend = text.trim().length > 0;

  return (
    <div
      style={{
        borderTop: "1px solid var(--border-light)",
        flexShrink: 0,
        background: "var(--bg-page)",
      }}
    >
      <div style={{ padding: "12px 16px" }}>
        {/* Input row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            borderRadius: "12px",
            border: isStreaming
              ? "2px solid var(--accent-soft)"
              : "2px solid var(--border-light)",
            background: isStreaming
              ? "var(--accent-bg)"
              : "var(--bg-elevated)",
            transition: "border-color 0.2s, background 0.2s",
            overflow: "hidden",
          }}
        >
          {/* Prompt indicator */}
          <span
            style={{
              flexShrink: 0,
              padding: "12px 0 12px 16px",
              alignSelf: "flex-end",
              fontSize: "14px",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: "var(--accent)",
              userSelect: "none",
              lineHeight: 1,
            }}
          >
            »
          </span>

          {/* Textarea */}
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? "助手正在回复……" : "输入消息……"}
            rows={1}
            disabled={isStreaming}
            style={{
              flex: 1,
              background: "transparent",
              resize: "none",
              border: "none",
              outline: "none",
              padding: "12px 8px",
              fontSize: "14px",
              lineHeight: 1.6,
              color: "var(--text-primary)",
              fontFamily: "inherit",
              maxHeight: "200px",
              opacity: isStreaming ? 0.5 : 1,
              cursor: isStreaming ? "not-allowed" : "text",
            }}
          />

          {/* Send / Stop button */}
          <div style={{ flexShrink: 0, padding: "0 8px 8px 0", alignSelf: "flex-end" }}>
            {isStreaming ? (
              <button
                onClick={abort}
                style={{
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "8px",
                  background: "var(--error)",
                  color: "var(--text-inverse)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 700,
                  transition: "opacity 0.15s",
                }}
                title="停止生成 (Esc)"
              >
                ■
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSend}
                style={{
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "8px",
                  background: canSend ? "var(--accent)" : "var(--border-light)",
                  color: canSend ? "var(--text-inverse)" : "var(--text-tertiary)",
                  border: "none",
                  cursor: canSend ? "pointer" : "not-allowed",
                  fontSize: "14px",
                  fontWeight: 700,
                  transition: "all 0.15s",
                  opacity: canSend ? 1 : 0.4,
                }}
                title="发送 (Enter)"
              >
                ↑
              </button>
            )}
          </div>
        </div>

        {/* Hint text */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "6px",
            padding: "0 4px",
          }}
        >
          <span
            style={{
              fontSize: "10px",
              color: "var(--text-tertiary)",
              letterSpacing: "0.08em",
            }}
          >
            Enter 发送 · Shift+Enter 换行
          </span>
          {isStreaming && (
            <span
              style={{
                fontSize: "10px",
                color: "var(--text-tertiary)",
                letterSpacing: "0.08em",
              }}
            >
              Esc 停止
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

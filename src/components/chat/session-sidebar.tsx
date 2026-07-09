"use client";

import { useEffect, useMemo, useState } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useChatSidebar } from "./sidebar-layout";

interface Props {
  onOpenSettings: () => void;
}

function formatActivityLabel(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = now.toDateString() === date.toDateString();
  const isYesterday = new Date(Date.now() - 86400000).toDateString() === date.toDateString();

  if (isToday) return `今天 ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
  if (isYesterday) return `昨天 ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
  return `${date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })} ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
}

export function SessionSidebar({ onOpenSettings }: Props) {
  const { isDesktop, closeMobileSidebar } = useChatSidebar();
  const sessions = useChatStore((s) => s.sessions);
  const currentId = useChatStore((s) => s.currentSessionId);
  const openSession = useChatStore((s) => s.openSession);
  const createSession = useChatStore((s) => s.createSession);
  const removeSession = useChatStore((s) => s.removeSession);
  const renameSession = useChatStore((s) => s.renameSession);
  const modelName = useChatStore((s) => s.modelName);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.lastActivity - a.lastActivity),
    [sessions]
  );

  useEffect(() => {
    if (editingId && !sessions.some((session) => session.id === editingId)) {
      setEditingId(null);
      setDraftTitle("");
    }
  }, [editingId, sessions]);

  const closeSidebar = () => {
    if (!isDesktop) closeMobileSidebar();
  };

  const beginRename = (id: string, title: string) => {
    setEditingId(id);
    setDraftTitle(title);
  };

  const commitRename = async () => {
    if (!editingId) return;
    const id = editingId;
    const title = draftTitle;
    setEditingId(null);
    setDraftTitle("");
    await renameSession(id, title);
  };

  return (
    <aside className="flex flex-col h-full" style={{ background: "var(--bg-surface)" }}>
      <div
        className="flex items-center justify-between px-4 h-12 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border-light)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg leading-none select-none flex-shrink-0 font-serif" style={{ color: "var(--accent)" }}>
            π
          </span>
          <span className="text-sm font-semibold truncate tracking-wide" style={{ color: "var(--text-primary)" }}>
            会话记录
          </span>
        </div>
        <button
          onClick={() => { createSession(); closeSidebar(); }}
          className="px-2 py-1 text-xs rounded-md transition-colors hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--text-tertiary)" }}
          title="新建会话"
        >
          ＋ 新建
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sortedSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <span className="text-2xl mb-2 opacity-20 font-serif">—</span>
            <p className="text-xs tracking-wide" style={{ color: "var(--text-tertiary)" }}>
              暂无会话
            </p>
          </div>
        ) : (
          sortedSessions.map((s) => {
            const active = s.id === currentId;
            const isEditing = editingId === s.id;

            return (
              <div
                key={s.id}
                className={`group border transition-all ${active ? "bg-[var(--bg-page)] border-[var(--border)]" : "border-transparent hover:bg-[var(--bg-hover)]"}`}
              >
                <button
                  onClick={() => { if (!isEditing) { openSession(s.id); closeSidebar(); } }}
                  className="w-full px-3 py-2.5 text-left"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-mono mt-0.5 flex-shrink-0 opacity-40">#</span>
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") {
                              setEditingId(null);
                              setDraftTitle("");
                            }
                          }}
                          className="w-full bg-transparent text-xs outline-none border-b border-[var(--border)] pb-1"
                          style={{ color: "var(--text-primary)" }}
                        />
                      ) : (
                        <div className="text-xs truncate font-medium" style={{ color: "var(--text-primary)" }}>
                          {s.title}
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-2 text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                        <span>{formatActivityLabel(s.lastActivity)}</span>
                        <span>·</span>
                        <span>{s.messageCount} 条消息</span>
                      </div>
                    </div>
                  </div>
                </button>

                <div className="flex items-center justify-end gap-1 px-2 pb-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      beginRename(s.id, s.title);
                    }}
                    className="px-1.5 py-0.5 text-[10px] rounded hover:bg-[var(--bg-page)]"
                    style={{ color: "var(--text-tertiary)" }}
                    title="重命名会话"
                  >
                    改名
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSession(s.id);
                    }}
                    className="px-1.5 py-0.5 text-[10px] rounded hover:bg-[var(--bg-page)]"
                    style={{ color: "var(--text-tertiary)" }}
                    title="删除会话"
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-2 flex-shrink-0 space-y-1" style={{ borderTop: "1px solid var(--border-light)" }}>
        {modelName && (
          <div className="px-3 py-1.5 text-[10px] truncate tracking-wide" style={{ color: "var(--text-tertiary)" }}>
            模型：{modelName}
          </div>
        )}
        <button
          onClick={() => {
            onOpenSettings();
            closeSidebar();
          }}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors hover:bg-[var(--bg-hover)]"
          style={{ color: "var(--text-tertiary)" }}
        >
          <span className="font-mono text-xs">⚙</span>
          <span>设置</span>
        </button>
      </div>
    </aside>
  );
}

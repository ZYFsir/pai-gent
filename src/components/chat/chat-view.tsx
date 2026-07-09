"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useChatStore } from "@/stores/chat-store";
import { MessageCard } from "./message-card";
import { MessageInput } from "./message-input";
import { SessionSidebar } from "./session-sidebar";
import { SettingsPanel } from "./settings-panel";
import { ChatSidebarInset, ChatSidebarProvider, ChatSidebarTrigger } from "./sidebar-layout";


/* ─── Session Card ─── */
function SessionCard({
  title,
  createdAt,
  messageCount,
  onClick,
}: {
  title: string;
  createdAt: number;
  messageCount: number;
  onClick: () => void;
}) {
  const date = new Date(createdAt);
  const dateStr = date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  const timeStr = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  const weekday = date.toLocaleDateString("zh-CN", { weekday: "short" });
  const isToday = new Date().toDateString() === date.toDateString();
  const isYesterday = new Date(Date.now() - 86400000).toDateString() === date.toDateString();
  const label = isToday ? "今日" : isYesterday ? "昨日" : dateStr;

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col gap-2 p-5 border transition-all animate-slide-up text-left"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-light)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.background = "#d3d2d0";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-light)";
        e.currentTarget.style.background = "var(--bg-surface)";
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] tracking-widest font-semibold" style={{ color: "var(--text-tertiary)" }}>
          {label}
        </span>
        <span className="text-[10px] font-mono opacity-40" style={{ color: "var(--text-tertiary)" }}>
          {timeStr}
        </span>
      </div>
      <div className="section-rule-sm" style={{ margin: "2px 0" }} />
      <div className="text-sm line-clamp-2 min-h-10" style={{ color: "var(--text-primary)" }}>
        {title}
      </div>
      <div className="flex items-center justify-between gap-2 mt-0.5 text-[11px] tracking-wide" style={{ color: "var(--text-secondary)" }}>
        <span>{weekday} · 编码会话</span>
        <span className="font-mono text-[10px]">{messageCount} 条消息</span>
      </div>
    </button>
  );
}

/* ─── Home Page ─── */
function HomePage({ sessions, onStart, onSwitch }: {
  sessions: Array<{ id: string; createdAt: number; title: string; messageCount: number; lastActivity: number }>;
  onStart: () => void;
  onSwitch: (id: string) => void;
}) {
  const loading = useChatStore((s) => s.sessionLoading);
  const models = useChatStore((s) => s.models);

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.lastActivity - a.lastActivity).slice(0, 12),
    [sessions]
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div
            className="w-5 h-5 border-2 rounded-full animate-spin"
            style={{ borderColor: "var(--accent-soft)", borderTopColor: "var(--accent)" }}
          />
          <span className="text-sm tracking-wide" style={{ color: "var(--text-tertiary)" }}>
            加载中……
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex justify-center min-h-full">
      <div data-layout="msg-container" data-role="msg-container" className="w-full px-6 py-12 max-w-[var(--content-narrow)] mx-auto">

        {/* ═══ Masthead — 刊头 ═══ */}
        <div className="text-center mb-14">
          <span
            className="text-8xl leading-none select-none block mb-4 font-serif"
            style={{ color: "var(--accent)", opacity: 0.85 }}
          >
            π
          </span>
          <h1
            className="text-2xl font-bold mb-3 tracking-[0.15em]"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
          >
            编码助手
          </h1>
          <div style={{ display: 'flex', justifyContent: 'center' }}><div data-layout="section-rule-masthead" className="section-rule" style={{ width: 320, maxWidth: '100%' }} /></div>
          <p
            className="text-sm mt-4 leading-relaxed tracking-wide"
            style={{ color: "var(--text-secondary)" }}
          >
            AI 编码代理 — 阅读、编写、编辑、执行、搜索，
            <br />
            以报刊之姿，呈代码之美。
          </p>
        </div>

        {/* ═══ CTA — 新会话 ═══ */}
        <div className="text-center mb-14">
          <button
            onClick={onStart}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm tracking-widest transition-all hover:opacity-90 active:scale-[0.97] shadow-[var(--shadow-soft)]"
            style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
          >
            ＋ 新建会话
          </button>
          <p className="text-[10px] mt-3 tracking-widest" style={{ color: "var(--text-tertiary)" }}>
            开始一次新的编码对话
          </p>
        </div>

        {/* ═══ Recent Sessions — 近期会话 ═══ */}
        {sortedSessions.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="section-rule-sm" style={{ margin: 0, flex: "none" }} />
              <h2 className="text-xs font-semibold tracking-[0.15em]" style={{ color: "var(--text-tertiary)" }}>
                近期会话
              </h2>
              <span className="text-[10px] font-mono opacity-40" style={{ color: "var(--text-tertiary)" }}>
                {sessions.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 stagger" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
              {sortedSessions.map((s) => (
                <SessionCard key={s.id} title={s.title} createdAt={s.createdAt} messageCount={s.messageCount} onClick={() => onSwitch(s.id)} />
              ))}
            </div>
          </div>
        )}

        {/* ═══ Available Tools — 可用工具 ═══ */}
        <div className="mt-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="section-rule-sm" style={{ margin: 0, flex: "none" }} />
            <h2 className="text-xs font-semibold tracking-[0.15em]" style={{ color: "var(--text-tertiary)" }}>
              可用工具
            </h2>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
            {[
              { name: "read", desc: "读取文件内容", key: "读" },
              { name: "bash", desc: "执行命令行", key: "令" },
              { name: "edit", desc: "编辑文件", key: "改" },
              { name: "write", desc: "创建文件", key: "写" },
              { name: "grep", desc: "代码搜索", key: "搜" },
              { name: "find", desc: "查找文件", key: "寻" },
            ].map((tool) => (
              <div
                key={tool.name}
                className="flex items-center gap-3 p-3.5 border transition-all hover:border-[var(--border)]"
                style={{ background: "var(--bg-surface)", borderColor: "var(--border-light)" }}
              >
                <span
                  className="w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: "var(--bg-page)", color: "var(--text-tertiary)" }}
                >
                  {tool.key}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-mono font-medium" style={{ color: "var(--text-primary)" }}>
                    {tool.name}
                  </div>
                  <div className="text-[10px] truncate tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                    {tool.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ Models — 可用模型 ═══ */}
        {models.length > 0 && (
          <div className="mt-12 mb-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="section-rule-sm" style={{ margin: 0, flex: "none" }} />
              <h2 className="text-xs font-semibold tracking-[0.15em]" style={{ color: "var(--text-tertiary)" }}>
                可用模型
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {models.map((m) => (
                <span
                  key={m.id}
                  className="px-3 py-1 text-[10px] font-mono tracking-wide border"
                  style={{
                    background: "var(--bg-elevated)",
                    color: "var(--text-tertiary)",
                    borderColor: "var(--border-light)",
                  }}
                >
                  {m.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Footer — 页脚 ═══ */}
        <div className="text-center mt-16 mb-8">
          <div className="flex justify-center"><div data-layout="section-rule-footer" className="section-rule mb-4" style={{ width: 320, maxWidth: '100%' }} /></div>
          <p className="text-[10px] tracking-[0.2em]" style={{ color: "var(--text-tertiary)" }}>
            莫兰迪色系 · 报刊排版 · 流式交互
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}

/* ─── Loading State ─── */
function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div
          className="w-5 h-5 border-2 rounded-full animate-spin"
          style={{ borderColor: "var(--accent-soft)", borderTopColor: "var(--accent)" }}
        />
        <span className="text-sm tracking-wide" style={{ color: "var(--text-tertiary)" }}>
          加载会话……
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Main Chat View — with resizable sidebar
   ══════════════════════════════════════════════ */

export function ChatView() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const sessionId = useChatStore((s) => s.currentSessionId);
  const sessionLoading = useChatStore((s) => s.sessionLoading);
  const messages = useChatStore((s) => s.messages);
  const sessions = useChatStore((s) => s.sessions);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamContent = useChatStore((s) => s.streamContent);
  const streamThinking = useChatStore((s) => s.streamThinking);
  const streamToolCalls = useChatStore((s) => s.streamToolCalls);
  const error = useChatStore((s) => s.error);
  const currentSession = useMemo(
    () => sessions.find((session) => session.id === sessionId) || null,
    [sessions, sessionId]
  );
  const clearError = useChatStore((s) => s.clearError);
  const fetchSessions = useChatStore((s) => s.fetchSessions);
  const bootstrap = useChatStore((s) => s.bootstrap);
  const goHome = useChatStore((s) => s.goHome);
  const createSession = useChatStore((s) => s.createSession);
  const openSession = useChatStore((s) => s.openSession);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollTicking = useRef(false);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!sessionId) fetchSessions();
  }, [sessionId, fetchSessions]);

  useEffect(() => {
    if (!autoScroll || !scrollRef.current || !sessionId) return;
    if (scrollTicking.current) return;
    scrollTicking.current = true;
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      scrollTicking.current = false;
    });
  }, [messages, streamContent, streamThinking, autoScroll, sessionId]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (!atBottom && autoScroll) setAutoScroll(false);
    if (atBottom && !autoScroll) setAutoScroll(true);
  }, [autoScroll]);

  const hasMessages = (messages.length > 0 || isStreaming) && !!sessionId;

  return (
    <ChatSidebarProvider
      sidebar={<SessionSidebar onOpenSettings={() => setSettingsOpen(true)} />}
    >
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      <ChatSidebarInset>
        {sessionId && (
          <header
            className="flex-shrink-0 backdrop-blur-sm"
            style={{ background: "rgba(243, 238, 234, 0.85)", borderBottom: "1px solid var(--border-light)" }}
          >
            <div className="flex items-center justify-between h-11 px-4 gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <ChatSidebarTrigger />
                <button
                  onClick={() => {
                    goHome();
                  }}
                  className="flex items-center gap-1 text-xs transition-colors hover:text-[var(--accent)] flex-shrink-0"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <span>←</span>
                  <span className="tracking-wide">首页</span>
                </button>
                {currentSession && (
                  <div className="min-w-0 hidden sm:block">
                    <div className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
                      {currentSession.title}
                    </div>
                    <div className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                      {currentSession.messageCount} 条消息
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  goHome();
                  createSession();
                }}
                className="px-2 py-1 text-xs rounded-md transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-tertiary)" }}
                title="新建会话"
              >
                ＋ 新建
              </button>
            </div>
          </header>
        )}

        {sessionLoading && !sessionId ? (
          <LoadingState />
        ) : !sessionId ? (
          <HomePage sessions={sessions} onStart={createSession} onSwitch={openSession} />
        ) : (
          <>
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto overscroll-contain"
              style={{ scrollBehavior: "smooth" }}
            >
              {hasMessages ? (
                <div className="flex justify-center min-h-full py-4">
                  <div
                    data-layout="msg-container-session"
                    data-role="msg-container"
                    className="px-4 space-y-5 w-full max-w-[var(--content-width)] mx-auto"
                  >
                    {messages.map((msg, i) => (
                      <MessageCard
                        key={msg.id}
                        message={msg}
                        isLast={i === messages.length - 1 && !isStreaming}
                      />
                    ))}

                    {isStreaming && (streamContent || streamThinking || streamToolCalls.length > 0) && (
                      <MessageCard
                        message={{
                          id: "streaming",
                          role: "assistant",
                          content: streamContent,
                          thinking: streamThinking || undefined,
                          toolCalls: streamToolCalls,
                          timestamp: Date.now(),
                        }}
                        isStreaming={true}
                      />
                    )}

                    {isStreaming && !streamContent && !streamThinking && streamToolCalls.length === 0 && (
                      <div className="flex items-center gap-2 pl-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse-soft" style={{ background: "var(--accent)", animationDelay: "0ms" }} />
                        <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse-soft" style={{ background: "var(--accent)", animationDelay: "200ms" }} />
                        <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse-soft" style={{ background: "var(--accent)", animationDelay: "400ms" }} />
                        <span className="text-xs tracking-wide ml-1" style={{ color: "var(--text-tertiary)" }}>
                          思考中……
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-5xl font-serif block mb-4 opacity-20" style={{ color: "var(--text-tertiary)" }}>
                      π
                    </span>
                    <p className="text-sm tracking-wide" style={{ color: "var(--text-tertiary)" }}>
                      发送消息开始对话
                    </p>
                    <div className="flex justify-center"><div data-layout="section-rule-empty" className="section-rule-sm mt-4" style={{ width: 48 }} /></div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div
                className="flex-shrink-0"
                style={{ borderTop: "1px solid rgba(145,64,73,0.2)", background: "var(--error-bg)" }}
              >
                <div className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold flex-shrink-0" style={{ color: "var(--error)" }}>※</span>
                    <p className="text-xs truncate" style={{ color: "var(--error)" }}>{error}</p>
                  </div>
                  <button
                    onClick={clearError}
                    className="text-xs ml-2 flex-shrink-0 transition-colors hover:text-[var(--text-primary)]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    关闭
                  </button>
                </div>
              </div>
            )}

            {!autoScroll && hasMessages && (
              <div className="relative flex-shrink-0 h-0 pointer-events-none">
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
                  <button
                    onClick={() => {
                      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
                      setAutoScroll(true);
                    }}
                    className="px-4 py-1.5 text-xs rounded-full shadow-[var(--shadow-md)] transition-colors border"
                    style={{
                      background: "var(--bg-elevated)",
                      borderColor: "var(--border-light)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    ↓ 回到底部
                  </button>
                </div>
              </div>
            )}

            <MessageInput />
          </>
        )}
      </ChatSidebarInset>
    </ChatSidebarProvider>
  );
}

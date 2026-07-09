"use client";

import { create } from "zustand";

export type MessageRole = "user" | "assistant" | "tool" | "system";

export interface ToolCall {
  toolCallId: string;
  toolName: string;
  args: unknown;
  status: "pending" | "running" | "done" | "error";
  toolOutput?: string;
  toolError?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  timestamp: number;
}

export interface SessionMeta {
  id: string;
  createdAt: number;
  lastActivity: number;
  title: string;
  messageCount: number;
}

export interface ProviderInfo {
  id: string;
  name: string;
  hasKey: boolean;
}

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

type ModelInfo = { id: string; name: string; provider: string };

interface ChatState {
  currentSessionId: string | null;
  sessions: SessionMeta[];
  sessionLoading: boolean;
  messages: Message[];
  isStreaming: boolean;
  streamContent: string;
  streamThinking: string;
  streamToolCalls: ToolCall[];
  modelId: string;
  modelName: string;
  models: ModelInfo[];
  modelsLoading: boolean;
  thinkingLevel: ThinkingLevel;
  providers: ProviderInfo[];
  error: string | null;

  bootstrap: () => Promise<void>;
  goHome: () => void;
  createSession: () => Promise<void>;
  openSession: (id: string) => Promise<void>;
  removeSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;

  restoreSession: () => Promise<void>;
  initSession: () => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;

  sendMessage: (text: string) => Promise<void>;
  abort: () => void;
  commitStream: () => void;
  handleSSEEvent: (type: string, data: any) => void;
  loadModels: () => Promise<void>;
  fetchSessions: () => Promise<SessionMeta[]>;
  clearError: () => void;
  setThinkingLevel: (level: ThinkingLevel) => Promise<void>;
  setApiKey: (provider: string, key: string) => Promise<void>;
  switchModel: (modelId: string, modelName: string) => Promise<void>;
  loadSettings: () => Promise<void>;
}

const SESSION_KEY = "pai-gent-session-id";

function saveId(id: string | null) {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}

function loadId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function genId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

let abortCtrl: AbortController | null = null;

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function resetStreamingState() {
  return {
    streamContent: "",
    streamThinking: "",
    streamToolCalls: [],
    isStreaming: false,
  };
}

export const useChatStore = create<ChatState>((set, get) => ({
  currentSessionId: null,
  sessions: [],
  sessionLoading: false,
  messages: [],
  isStreaming: false,
  streamContent: "",
  streamThinking: "",
  streamToolCalls: [],
  modelId: "",
  modelName: "",
  models: [],
  modelsLoading: false,
  thinkingLevel: "off",
  providers: [],
  error: null,

  clearError: () => set({ error: null }),

  loadSettings: async () => {
    try {
      const data = await getJson<{
        thinkingLevel?: ThinkingLevel;
        providers?: ProviderInfo[];
        modelId?: string;
        modelName?: string;
      }>("/api/settings");

      set({
        thinkingLevel: data.thinkingLevel || "off",
        providers: data.providers || [],
        modelId: data.modelId || "",
        modelName: data.modelName || "",
      });
    } catch {}
  },

  setThinkingLevel: async (level: ThinkingLevel) => {
    set({ thinkingLevel: level });
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thinkingLevel: level }),
      });
    } catch {}
  },

  setApiKey: async (provider: string, key: string) => {
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: { provider, key } }),
      });

      set((state) => ({
        providers: state.providers.map((item) =>
          item.id === provider || item.name === provider ? { ...item, hasKey: Boolean(key) } : item
        ),
      }));

      await get().loadModels();
    } catch {}
  },

  switchModel: async (modelId: string, modelName: string) => {
    set({ modelId, modelName });
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId }),
      });
    } catch {}
  },

  loadModels: async () => {
    set({ modelsLoading: true });
    try {
      const data = await getJson<{ models?: ModelInfo[] }>("/api/models");
      const models = data.models || [];
      set((state) => ({
        models,
        modelsLoading: false,
        modelId: state.modelId || models[0]?.id || "",
        modelName: state.modelName || models[0]?.name || "",
      }));
    } catch {
      set({ modelsLoading: false });
    }
  },

  fetchSessions: async () => {
    try {
      const data = await getJson<{
        sessions?: Array<{
          id: string;
          createdAt: number;
          lastActivity?: number;
          title?: string;
          messageCount?: number;
        }>;
      }>("/api/sessions");
      const sessions = (data.sessions || []).map((session) => ({
        id: session.id,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity || session.createdAt,
        title: session.title || "新会话",
        messageCount: session.messageCount || 0,
      }));
      set({ sessions });
      return sessions;
    } catch {
      return [];
    }
  },

  bootstrap: async () => {
    set({ sessionLoading: true, error: null });

    const [sessions] = await Promise.all([
      get().fetchSessions(),
      get().loadModels(),
      get().loadSettings(),
    ]);

    const savedId = loadId();
    if (!savedId || !sessions.some((session) => session.id === savedId)) {
      if (savedId) saveId(null);
      set({ currentSessionId: null, messages: [], sessionLoading: false, ...resetStreamingState() });
      return;
    }

    await get().openSession(savedId);
  },

  goHome: () => {
    set({
      currentSessionId: null,
      messages: [],
      sessionLoading: false,
      error: null,
      ...resetStreamingState(),
    });
  },

  createSession: async () => {
    set({ sessionLoading: true, error: null, ...resetStreamingState() });
    try {
      const data = await getJson<{ id?: string; error?: string }>("/api/sessions", { method: "POST" });
      if (!data.id) {
        set({ sessionLoading: false, error: data.error || "Failed to create session" });
        return;
      }

      saveId(data.id);
      set({
        currentSessionId: data.id,
        messages: [],
        sessionLoading: false,
        error: null,
        ...resetStreamingState(),
      });

      await get().fetchSessions();
    } catch (error) {
      set({
        sessionLoading: false,
        error: error instanceof Error ? error.message : "Failed to create session",
      });
    }
  },

  openSession: async (id: string) => {
    saveId(id);
    set({
      currentSessionId: id,
      messages: [],
      sessionLoading: true,
      error: null,
      ...resetStreamingState(),
    });

    try {
      const data = await getJson<{ messages?: Message[]; error?: string }>(`/api/sessions/${id}/messages`);
      if (data.error) throw new Error(data.error);
      set({ messages: data.messages || [], sessionLoading: false });
    } catch {
      saveId(null);
      set({ currentSessionId: null, messages: [], sessionLoading: false });
      await get().fetchSessions();
    }
  },

  removeSession: async (id: string) => {
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      const currentId = get().currentSessionId;
      const sessions = await get().fetchSessions();

      if (currentId === id) {
        saveId(null);
        set({ currentSessionId: null, messages: [], ...resetStreamingState() });
      } else if (!sessions.some((session) => session.id === currentId)) {
        saveId(null);
        set({ currentSessionId: null, messages: [], ...resetStreamingState() });
      }
    } catch {}
  },

  renameSession: async (id: string, title: string) => {
    const normalized = title.replace(/\s+/g, " ").trim() || "新会话";
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id
          ? { ...session, title: normalized, lastActivity: Date.now() }
          : session
      ),
    }));

    try {
      await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: normalized }),
      });
      await get().fetchSessions();
    } catch {
      await get().fetchSessions();
    }
  },

  restoreSession: async () => {
    await get().bootstrap();
  },

  initSession: async () => {
    await get().createSession();
  },

  switchSession: async (id: string) => {
    await get().openSession(id);
  },

  deleteSession: async (id: string) => {
    await get().removeSession(id);
  },

  sendMessage: async (text: string) => {
    const state = get();
    if (!state.currentSessionId || !text.trim() || state.isStreaming) return;

    const userMsg: Message = {
      id: genId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    set({
      messages: [...state.messages, userMsg],
      isStreaming: true,
      streamContent: "",
      streamThinking: "",
      streamToolCalls: [],
      error: null,
    });

    abortCtrl = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: state.currentSessionId, message: text }),
        signal: abortCtrl.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        set({ isStreaming: false, error: err.error || `HTTP ${res.status}` });
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        set({ isStreaming: false, error: "No response body" });
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (let i = 0; i < lines.length; ) {
          const line = lines[i];
          if (!line.startsWith("event: ")) {
            i += 1;
            continue;
          }

          const eventType = line.slice(7).trim();
          const dataLine = lines[i + 1];
          if (dataLine?.startsWith("data: ")) {
            try {
              get().handleSSEEvent(eventType, JSON.parse(dataLine.slice(6)));
            } catch {}
          }

          i += 2;
        }
      }

      get().commitStream();
      await get().fetchSessions();
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        set({ isStreaming: false, error: error?.message || "Connection lost" });
      }
    } finally {
      set({ isStreaming: false });
      abortCtrl = null;
    }
  },

  handleSSEEvent: (type: string, data: any) => {
    const state = get();

    switch (type) {
      case "text_delta":
        set({ streamContent: state.streamContent + (data.delta || "") });
        break;
      case "thinking_delta":
        set({ streamThinking: state.streamThinking + (data.delta || "") });
        break;
      case "tool_start":
        set({
          streamToolCalls: [
            ...state.streamToolCalls,
            {
              toolCallId: data.toolCallId,
              toolName: data.toolName,
              args: data.args,
              status: "pending",
            },
          ],
        });
        break;
      case "tool_execution_start":
        set({
          streamToolCalls: state.streamToolCalls.map((toolCall) =>
            toolCall.toolCallId === data.toolCallId
              ? { ...toolCall, status: "running", toolOutput: "" }
              : toolCall
          ),
        });
        break;
      case "tool_execution_update":
        set({
          streamToolCalls: state.streamToolCalls.map((toolCall) =>
            toolCall.toolCallId === data.toolCallId
              ? { ...toolCall, toolOutput: (toolCall.toolOutput || "") + (data.delta || "") }
              : toolCall
          ),
        });
        break;
      case "tool_execution_end":
        set({
          streamToolCalls: state.streamToolCalls.map((toolCall) =>
            toolCall.toolCallId === data.toolCallId
              ? {
                  ...toolCall,
                  status: data.isError ? "error" : "done",
                  toolOutput: data.output || toolCall.toolOutput || "",
                  toolError: data.error,
                }
              : toolCall
          ),
        });
        break;
      case "compaction_start":
        set({ error: "Compacting context..." });
        break;
      case "compaction_end":
        set({ error: null });
        break;
      case "retry_start":
        set({ error: `Retrying (${data.attempt}/${data.maxAttempts})...` });
        break;
      case "retry_end":
        set({ error: data.success ? null : `Retry exhausted after ${data.attempt} attempts` });
        break;
      case "error":
        set({ error: data.message || "Unknown error" });
        break;
    }
  },

  commitStream: () => {
    const state = get();
    if (!state.streamContent && !state.streamThinking && state.streamToolCalls.length === 0) return;

    const message: Message = {
      id: genId(),
      role: "assistant",
      content: state.streamContent,
      thinking: state.streamThinking || undefined,
      toolCalls: state.streamToolCalls.length > 0 ? state.streamToolCalls : undefined,
      timestamp: Date.now(),
    };

    set({
      messages: [...state.messages, message],
      streamContent: "",
      streamThinking: "",
      streamToolCalls: [],
    });
  },

  abort: () => {
    abortCtrl?.abort();
    abortCtrl = null;
    get().commitStream();
    set({ isStreaming: false });
  },
}));

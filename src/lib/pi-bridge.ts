import {
  AuthStorage,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  DefaultResourceLoader,
  createAgentSession,
  getAgentDir,
  type AgentSession,
  type AgentSessionEvent,
} from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, rmSync } from "fs";
import { join } from "path";

const SESSIONS_DIR = join(process.cwd(), ".pi", "web-sessions");
const META_FILE = join(SESSIONS_DIR, "sessions.json");
const DEFAULT_TITLE_FALLBACK = "新会话";
const DEFAULT_TITLE_PREVIEW_CHARS = 32;

function extractTextFromContent(content: any): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  let text = "";
  for (const block of content) {
    if (typeof block === "string") text += block;
    else if (block?.type === "text") text += block.text || "";
    else if (block?.type === "tool_result" && typeof block.content === "string") text += block.content;
  }
  return text;
}

function normalizeSessionTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim();
}

function deriveSessionTitle(messages: any[]): string {
  const firstUser = messages.find((msg) => msg?.role === "user");
  const raw = normalizeSessionTitle(extractTextFromContent(firstUser?.content));

  if (!raw) return DEFAULT_TITLE_FALLBACK;
  return raw.length > DEFAULT_TITLE_PREVIEW_CHARS
    ? `${raw.slice(0, DEFAULT_TITLE_PREVIEW_CHARS).trimEnd()}…`
    : raw;
}

function countRenderableMessages(messages: any[]): number {
  return messages.filter((msg) => msg?.role === "user" || msg?.role === "assistant" || msg?.role === "system").length;
}

/** Merge two message arrays, keeping the longer one and adding new unique messages */
function mergeMessages(existing: any[], incoming: any[]): any[] {
  if (existing.length >= incoming.length) return existing;
  // If incoming has messages that existing doesn't, append them
  const existingIds = new Set(existing.map((m) => m.id).filter(Boolean));
  const newOnes = incoming.filter((m) => m.id && !existingIds.has(m.id));
  if (newOnes.length === 0) return existing;
  return [...existing, ...newOnes];
}

export interface PiSessionInstance {
  session: AgentSession;
  createdAt: number;
}

interface PersistedSessionMeta {
  id: string;
  createdAt: number;
  lastActivity: number;
  title?: string;
  messageCount?: number;
  titleManuallySet?: boolean;
}

function stripNumericSuffix(title: string): string {
  return title.replace(/ \((\d+)\)$/, "");
}

class PiBridgeServer {
  private authStorage!: AuthStorage;
  private modelRegistry!: ModelRegistry;
  private settingsManager!: SettingsManager;
  private sessions: Map<string, PiSessionInstance> = new Map();
  private initialized = false;
  private persistedMeta: PersistedSessionMeta[] = [];
  private ready = false;

  async init() {
    if (this.initialized) return;
    this.authStorage = AuthStorage.create();
    this.modelRegistry = ModelRegistry.create(this.authStorage);
    this.settingsManager = SettingsManager.create(process.cwd());
    this.initialized = true;
    this.loadPersistedMeta();
    this.ready = true;
  }

  /** Wait for init to complete */
  async waitReady() {
    await this.init();
  }

  // ─── Disk Persistence ───

  private ensureDir() {
    if (!existsSync(SESSIONS_DIR)) {
      mkdirSync(SESSIONS_DIR, { recursive: true });
    }
  }

  private loadPersistedMeta() {
    this.ensureDir();
    try {
      if (existsSync(META_FILE)) {
        const raw = readFileSync(META_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        this.persistedMeta = Array.isArray(parsed)
          ? parsed.map((item: any) => ({
              id: item.id,
              createdAt: item.createdAt,
              lastActivity: item.lastActivity || item.createdAt || Date.now(),
              title: item.title,
              messageCount: typeof item.messageCount === "number" ? item.messageCount : undefined,
              titleManuallySet: !!item.titleManuallySet,
            }))
          : [];
        // Remove sessions that are too old (> 24h)
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        this.persistedMeta = this.persistedMeta.filter((m) => m.lastActivity > cutoff);
      }
    } catch {
      this.persistedMeta = [];
    }
  }

  private savePersistedMeta() {
    this.ensureDir();
    writeFileSync(META_FILE, JSON.stringify(this.persistedMeta, null, 2), "utf-8");
  }

  private getSessionMessagesPath(id: string): string {
    return join(SESSIONS_DIR, `${id}.json`);
  }

  private ensureUniqueSessionTitle(title: string, excludeId?: string): string {
    const normalized = normalizeSessionTitle(title) || DEFAULT_TITLE_FALLBACK;
    const base = stripNumericSuffix(normalized) || DEFAULT_TITLE_FALLBACK;
    const existing = new Set(
      this.persistedMeta
        .filter((item) => item.id !== excludeId)
        .map((item) => normalizeSessionTitle(item.title || ""))
        .filter(Boolean)
    );

    if (!existing.has(base)) return base;

    let suffix = 2;
    let candidate = `${base} (${suffix})`;
    while (existing.has(candidate)) {
      suffix += 1;
      candidate = `${base} (${suffix})`;
    }
    return candidate;
  }

  /** Save session messages to disk */
  saveSessionToDisk(id: string) {
    const inst = this.sessions.get(id);
    if (!inst) return;

    try {
      this.ensureDir();
      const messages = inst.session.agent.state.messages || [];

      // Safety check: never overwrite a larger file with a smaller one
      // (prevents history loss when a restored session hasn't loaded cached messages)
      const existingPath = this.getSessionMessagesPath(id);
      if (existsSync(existingPath)) {
        try {
          const existingRaw = readFileSync(existingPath, "utf-8");
          const existingMessages = JSON.parse(existingRaw);
          if (Array.isArray(existingMessages) && existingMessages.length > messages.length) {
            console.warn(`[pi-bridge] Disk has ${existingMessages.length} msgs > memory ${messages.length} for ${id}, merging`);
            // Use the larger set (disk has history the fresh session doesn't)
            const merged = mergeMessages(existingMessages, messages);
            const data = JSON.stringify(merged, (key, value) => {
              if (key === "parent" || key === "children") return undefined;
              return value;
            }, 2);
            writeFileSync(existingPath, data, "utf-8");
            // Also update the in-memory session
            try { inst.session.agent.state.messages = merged; } catch {}
            this.updateActivity(id);
            return;
          }
        } catch { /* ignore read errors */ }
      }

      const data = JSON.stringify(messages, (key, value) => {
        // Skip circular references and complex objects
        if (key === "parent" || key === "children") return undefined;
        return value;
      }, 2);
      writeFileSync(existingPath, data, "utf-8");

      // Update metadata
      const existing = this.persistedMeta.find((m) => m.id === id);
      const rawTitle = existing?.titleManuallySet ? existing.title || DEFAULT_TITLE_FALLBACK : deriveSessionTitle(messages);
      const title = this.ensureUniqueSessionTitle(rawTitle, id);
      const messageCount = countRenderableMessages(messages);
      if (existing) {
        existing.lastActivity = Date.now();
        existing.title = title;
        existing.messageCount = messageCount;
      } else {
        this.persistedMeta.push({
          id,
          createdAt: inst.createdAt,
          lastActivity: Date.now(),
          title,
          messageCount,
          titleManuallySet: false,
        });
      }
      this.savePersistedMeta();
    } catch (err) {
      console.error(`[pi-bridge] Failed to save session ${id}:`, err);
    }
  }

  /** Load messages from disk */
  loadSessionFromDisk(id: string): any[] | null {
    try {
      const path = this.getSessionMessagesPath(id);
      if (!existsSync(path)) return null;
      const raw = readFileSync(path, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private deleteSessionFromDisk(id: string) {
    try {
      const path = this.getSessionMessagesPath(id);
      if (existsSync(path)) unlinkSync(path);
      this.persistedMeta = this.persistedMeta.filter((m) => m.id !== id);
      this.savePersistedMeta();
    } catch {
      // silent
    }
  }

  /** Build a mock agent state with messages loaded from disk */
  buildMockAgentState(messages: any[]) {
    return { messages };
  }

  // ─── Session Management ───

  async getAvailableModels() {
    await this.init();
    try {
      return await this.modelRegistry.getAvailable();
    } catch {
      return [];
    }
  }

  async createSession(modelId?: string): Promise<{ id: string; session: AgentSession }> {
    await this.init();

    const available = await this.getAvailableModels();
    const targetModel = modelId
      ? available.find((m: any) => m.id === modelId || `${m.provider}/${m.id}` === modelId)
      : available[0];

    const loader = new DefaultResourceLoader({
      cwd: process.cwd(),
      agentDir: getAgentDir(),
      systemPromptOverride: () =>
        "You are an expert coding assistant. Be concise and helpful. Use the provided tools to fulfill user requests.",
    });
    await loader.reload();

    const { session } = await createAgentSession({
      model: targetModel,
      tools: ["read", "bash", "edit", "write", "grep", "find", "ls"],
      resourceLoader: loader,
      sessionManager: SessionManager.inMemory(),
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      settingsManager: this.settingsManager,
    });

    const id = crypto.randomUUID();
    const createdAt = Date.now();
    this.sessions.set(id, { session, createdAt });

    // Persist session metadata immediately so it survives restart
    this.ensureDir();
    this.persistedMeta.push({
      id,
      createdAt,
      lastActivity: Date.now(),
      title: DEFAULT_TITLE_FALLBACK,
      messageCount: 0,
      titleManuallySet: false,
    });
    this.savePersistedMeta();

    return { id, session };
  }

  /** Restore a session from disk: creates a new AgentSession with cached messages */
  async restoreSession(id: string): Promise<{ session: AgentSession } | null> {
    // If already in memory, return it
    const existing = this.sessions.get(id);
    if (existing) return { session: existing.session };

    // Check if we have it on disk
    const meta = this.persistedMeta.find((m) => m.id === id);
    if (!meta) return null;

    try {
      await this.init();
      const available = await this.getAvailableModels();
      const loader = new DefaultResourceLoader({
        cwd: process.cwd(),
        agentDir: getAgentDir(),
        systemPromptOverride: () =>
          "You are an expert coding assistant. Be concise and helpful. Use the provided tools to fulfill user requests.",
      });
      await loader.reload();

      const { session } = await createAgentSession({
        model: available[0],
        tools: ["read", "bash", "edit", "write", "grep", "find", "ls"],
        resourceLoader: loader,
        sessionManager: SessionManager.inMemory(),
        authStorage: this.authStorage,
        modelRegistry: this.modelRegistry,
        settingsManager: this.settingsManager,
      });

      // Load cached messages into the new session so agent has full context
      const cachedMessages = this.loadSessionFromDisk(id);
      if (cachedMessages && cachedMessages.length > 0) {
        try {
          session.agent.state.messages = cachedMessages;
        } catch (e) {
          console.error(`[pi-bridge] Failed to inject messages into restored session ${id}:`, e);
        }
      }

      this.sessions.set(id, { session, createdAt: meta.createdAt });
      return { session };
    } catch (err) {
      console.error(`[pi-bridge] Failed to restore session ${id}:`, err);
      return null;
    }
  }

  getSession(id: string): PiSessionInstance | undefined {
    return this.sessions.get(id);
  }

  /** Check if a session exists in memory OR on disk */
  hasSession(id: string): boolean {
    if (this.sessions.has(id)) return true;
    return this.persistedMeta.some((m) => m.id === id);
  }

  /** Check if a session exists on disk (after init) */
  hasSessionOnDisk(id: string): boolean {
    return this.persistedMeta.some((m) => m.id === id);
  }

  /** Update lastActivity timestamp for a session */
  private updateActivity(id: string) {
    const meta = this.persistedMeta.find((m) => m.id === id);
    if (meta) {
      meta.lastActivity = Date.now();
      this.savePersistedMeta();
    }
  }

  async deleteSession(id: string) {
    const inst = this.sessions.get(id);
    if (inst) {
      inst.session.dispose();
      this.sessions.delete(id);
    }
    this.deleteSessionFromDisk(id);
  }

  async listSessions(): Promise<Array<{ id: string; createdAt: number; lastActivity: number; title: string; messageCount: number }>> {
    await this.init();
    const result: Array<{ id: string; createdAt: number; lastActivity: number; title: string; messageCount: number }> = [];

    // From memory
    for (const [id, inst] of this.sessions) {
      const meta = this.persistedMeta.find((item) => item.id === id);
      result.push({
        id,
        createdAt: inst.createdAt,
        lastActivity: meta?.lastActivity || inst.createdAt,
        title: meta?.title || DEFAULT_TITLE_FALLBACK,
        messageCount: meta?.messageCount || 0,
      });
    }

    // From disk (add any not already in memory)
    for (const meta of this.persistedMeta) {
      if (!this.sessions.has(meta.id)) {
        result.push({
          id: meta.id,
          createdAt: meta.createdAt,
          lastActivity: meta.lastActivity,
          title: meta.title || DEFAULT_TITLE_FALLBACK,
          messageCount: meta.messageCount || 0,
        });
      }
    }

    return result.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  async renameSession(id: string, title: string) {
    await this.init();
    const meta = this.persistedMeta.find((item) => item.id === id);
    if (!meta) throw new Error("Session not found");

    const normalized = normalizeSessionTitle(title);
    meta.title = this.ensureUniqueSessionTitle(normalized || DEFAULT_TITLE_FALLBACK, id);
    meta.titleManuallySet = !!normalized;
    meta.lastActivity = Date.now();
    this.savePersistedMeta();
  }

  /** 根据实际消息数组刷新 session 的 messageCount 和 title */
  refreshSessionMeta(id: string, messages: any[]) {
    const meta = this.persistedMeta.find((item) => item.id === id);
    if (!meta) return;

    meta.messageCount = countRenderableMessages(messages);
    if (!meta.titleManuallySet) {
      meta.title = this.ensureUniqueSessionTitle(deriveSessionTitle(messages), id);
    }
    meta.lastActivity = Date.now();
    this.savePersistedMeta();
  }

  // ─── Settings ───

  setApiKey(provider: string, key: string) {
    this.authStorage.setRuntimeApiKey(provider, key);
  }

  switchModel(modelId: string): { model?: any; error?: string } {
    // Try to find the model in memory
    for (const [, inst] of this.sessions) {
      const available = this.modelRegistry.find("", modelId) || this.modelRegistry.find(modelId.split("/")[0], modelId.split("/")[1]);
      if (available) {
        inst.session.setModel(available).catch(() => {});
        return { model: available };
      }
      break; // Just check one session
    }
    return { error: "Model not found" };
  }

  setThinkingLevel(level: string) {
    const validLevels = ["off", "minimal", "low", "medium", "high", "xhigh"];
    if (!validLevels.includes(level)) return;
    for (const [, inst] of this.sessions) {
      inst.session.setThinkingLevel(level as any);
    }
  }

  cleanupStale() {
    // Clean memory sessions older than 30 min
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [id, inst] of this.sessions) {
      if (inst.createdAt < cutoff) {
        // Save to disk before removing from memory
        this.saveSessionToDisk(id);
        inst.session.dispose();
        this.sessions.delete(id);
      }
    }

    // Clean disk sessions older than 24h
    const diskCutoff = Date.now() - 24 * 60 * 60 * 1000;
    const before = this.persistedMeta.length;
    const removed = this.persistedMeta.filter((m) => m.lastActivity <= diskCutoff);
    this.persistedMeta = this.persistedMeta.filter((m) => m.lastActivity > diskCutoff);
    if (removed.length > 0) {
      // Delete orphaned files
      for (const meta of removed) {
        const path = this.getSessionMessagesPath(meta.id);
        try { if (existsSync(path)) unlinkSync(path); } catch {}
      }
      this.savePersistedMeta();
    }
  }
}

// Singleton
export const piBridge = new PiBridgeServer();

// Start cleanup interval
if (typeof setInterval !== "undefined") {
  setInterval(() => piBridge.cleanupStale(), 5 * 60 * 1000);
}

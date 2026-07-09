"use client";

import { useState, useCallback } from "react";
import { useChatStore, type ThinkingLevel } from "@/stores/chat-store";
import { OverlayPanel } from "@/components/ui/overlay-panel";

interface Props { onClose: () => void; }

const THINKING_OPTIONS: { value: ThinkingLevel; label: string; desc: string }[] = [
  { value: "off", label: "关闭", desc: "无思考过程，响应最快" },
  { value: "minimal", label: "极少", desc: "最低限度思考" },
  { value: "low", label: "低", desc: "较少思考" },
  { value: "medium", label: "中", desc: "均衡思考" },
  { value: "high", label: "高", desc: "深度思考" },
  { value: "xhigh", label: "极高", desc: "最大思考量，最佳推理" },
];

export function SettingsPanel({ onClose }: Props) {
  const models = useChatStore((s) => s.models);
  const modelId = useChatStore((s) => s.modelId);
  const thinkingLevel = useChatStore((s) => s.thinkingLevel);
  const providers = useChatStore((s) => s.providers);
  const switchModel = useChatStore((s) => s.switchModel);
  const setThinkingLevel = useChatStore((s) => s.setThinkingLevel);
  const setApiKey = useChatStore((s) => s.setApiKey);

  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const handleSaveKey = useCallback(async (provider: string) => {
    const key = apiKeys[provider]?.trim();
    if (!key) return;
    setSavingKey(provider);
    await setApiKey(provider, key);
    setSavedKeys((prev) => new Set(prev).add(provider));
    setSavingKey(null);
    setTimeout(() => setSavedKeys((prev) => { const n = new Set(prev); n.delete(provider); return n; }), 2000);
  }, [apiKeys, setApiKey]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, provider: string) => {
    if (e.key === "Enter") handleSaveKey(provider);
  }, [handleSaveKey]);

  // Group models by provider
  const modelsByProvider: Record<string, typeof models> = {};
  for (const m of models) {
    const p = m.provider || "unknown";
    if (!modelsByProvider[p]) modelsByProvider[p] = [];
    modelsByProvider[p].push(m);
  }

  return (
    <OverlayPanel open={true} onClose={onClose} title="设置" side="center" maxWidthClassName="max-w-lg">
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-3 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--border-light)" }}
          >
            <h2 className="text-sm font-semibold tracking-wider" style={{ color: "var(--text-primary)" }}>
              设置
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--text-tertiary)" }}
            >
              <span className="text-sm">×</span>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">

            {/* ── Model Selection ── */}
            <section>
              <div className="text-[10px] tracking-widest font-semibold mb-3" style={{ color: "var(--text-tertiary)" }}>
                模型选择
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
                  <div key={provider}>
                    <div
                      className="text-[10px] tracking-wider px-3 py-1 font-semibold uppercase"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {provider}
                    </div>
                    {providerModels.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => switchModel(m.id, m.name)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all text-xs ${
                          m.id === modelId
                            ? "bg-[var(--accent-bg)] border border-[var(--accent-soft)]"
                            : "hover:bg-[var(--bg-hover)]"
                        }`}
                        style={{ color: m.id === modelId ? "var(--accent)" : "var(--text-secondary)" }}
                      >
                        <span
                          className="text-[10px] flex-shrink-0"
                          style={{ color: m.id === modelId ? "var(--accent)" : "var(--text-tertiary)" }}
                        >
                          {m.id === modelId ? "●" : "○"}
                        </span>
                        <span className="truncate">{m.name}</span>
                      </button>
                    ))}
                  </div>
                ))}
                {models.length === 0 && (
                  <p className="text-xs px-3 py-2" style={{ color: "var(--text-tertiary)" }}>
                    暂无可选模型。请在下方设置 API 密钥。
                  </p>
                )}
              </div>
            </section>

            {/* ── Thinking Level ── */}
            <section>
              <div className="text-[10px] tracking-widest font-semibold mb-3" style={{ color: "var(--text-tertiary)" }}>
                思考层级
              </div>
              <div className="space-y-1">
                {THINKING_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setThinkingLevel(opt.value)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                      thinkingLevel === opt.value
                        ? "bg-[var(--accent-bg)] border border-[var(--accent-soft)]"
                        : "hover:bg-[var(--bg-hover)]"
                    }`}
                    style={{ color: thinkingLevel === opt.value ? "var(--accent)" : "var(--text-secondary)" }}
                  >
                    <span
                      className="text-[10px] flex-shrink-0"
                      style={{ color: thinkingLevel === opt.value ? "var(--accent)" : "var(--text-tertiary)" }}
                    >
                      {thinkingLevel === opt.value ? "●" : "○"}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium">{opt.label}</div>
                      <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* ── API Keys ── */}
            <section>
              <div className="text-[10px] tracking-widest font-semibold mb-3" style={{ color: "var(--text-tertiary)" }}>
                API 密钥
              </div>
              <div className="space-y-3">
                {providers.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>未检测到服务商。</p>
                ) : (
                  providers.map((p) => (
                    <div key={p.id}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs" style={{ color: "var(--text-secondary)" }}>{p.name}</label>
                        <span
                          className="text-[10px]"
                          style={{ color: p.hasKey ? "var(--success)" : "var(--text-tertiary)" }}
                        >
                          {p.hasKey ? "已设置" : "未设置"}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="password"
                          value={apiKeys[p.id] || ""}
                          onChange={(e) => setApiKeys((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          onKeyDown={(e) => handleKeyDown(e, p.id)}
                          placeholder={`sk-...`}
                          className="flex-1 px-3 py-2 text-xs rounded-lg outline-none transition-colors border"
                          style={{
                            background: "var(--bg-surface)",
                            borderColor: "var(--border-light)",
                            color: "var(--text-primary)",
                          }}
                        />
                        <button
                          onClick={() => handleSaveKey(p.id)}
                          disabled={!apiKeys[p.id]?.trim() || savingKey === p.id}
                          className="px-3 py-2 text-xs rounded-lg font-medium transition-colors disabled:opacity-40 flex-shrink-0"
                          style={{
                            background: savedKeys.has(p.id) ? "var(--success)" : "var(--accent)",
                            color: "var(--text-inverse)",
                          }}
                        >
                          {savingKey === p.id ? "…" : savedKeys.has(p.id) ? "已保存" : "设置"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Footer */}
          <div
            className="px-5 py-3 flex justify-end flex-shrink-0"
            style={{ borderTop: "1px solid var(--border-light)" }}
          >
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs rounded-lg transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--text-tertiary)" }}
            >
              关闭
            </button>
          </div>
    </OverlayPanel>
  );
}

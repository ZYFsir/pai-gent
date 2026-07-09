"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const redirect = searchParams.get("redirect") || "/";
        router.push(redirect);
      } else {
        setError("凭据无效");
      }
    } catch {
      setError("连接失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
          用户名
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-sm outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-all duration-200 focus:border-[var(--border-focus)]"
          placeholder="输入用户名"
          autoFocus
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
          密码
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-sm outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-all duration-200 focus:border-[var(--border-focus)]"
          placeholder="输入密码"
          required
        />
      </div>
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--error-bg)] border border-[rgba(145,64,73,0.2)]">
          <span className="text-xs text-[var(--error)]">※ {error}</span>
        </div>
      )}
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "登录中……" : "登 录"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-page)] p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <span className="text-6xl leading-none text-[var(--accent)] select-none block font-serif">
            π
          </span>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mt-4 tracking-widest">
            pi · 编码助手
          </h1>
          <div className="section-rule-sm mx-auto mt-4" />
          <p className="text-xs text-[var(--text-tertiary)] mt-3 tracking-wide">
            报刊排版 · 莫兰迪色
          </p>
        </div>
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-light)] p-6 shadow-[var(--shadow-md)]">
          <Suspense
            fallback={
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-[var(--accent-soft)] border-t-[var(--accent)] rounded-full animate-spin mx-auto" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)] text-center mt-6 tracking-widest">
          仅限授权访问
        </p>
      </div>
    </div>
  );
}

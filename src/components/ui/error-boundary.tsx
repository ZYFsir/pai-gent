"use client";

import { Component, type ReactNode } from "react";
import { Button } from "./button";

interface Props { children: ReactNode; fallback?: ReactNode; }

interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("[pai-gent ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex items-center justify-center h-full p-8">
          <div className="max-w-md text-center space-y-4">
            <div className="text-4xl opacity-50">—</div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              出错了
            </h2>
            <p className="text-sm font-mono text-[var(--text-secondary)] bg-[var(--bg-surface)] p-3 text-left break-all">
              {this.state.error?.message || "未知错误"}
            </p>
            <Button
              variant="primary"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              重新加载
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

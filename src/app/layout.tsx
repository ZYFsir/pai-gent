import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "pi · 编码助手",
  description: "pi coding agent 网页对话界面 — 报刊式排版 · 莫兰迪色系 · 流式交互",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90' fill='%23849b91'>π</text></svg>" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* display=swap ensures text is visible in system fonts immediately */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600;700&family=ZCOOL+XiaoWei&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}

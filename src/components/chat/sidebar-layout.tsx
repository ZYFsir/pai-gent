"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { OverlayPanel } from "@/components/ui/overlay-panel";

const SIDEBAR_WIDTH_KEY = "pai-gent-sidebar-w";
const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 500;
const DESKTOP_BREAKPOINT = "(min-width: 1024px)";

type ChatSidebarContextValue = {
  isDesktop: boolean;
  mobileOpen: boolean;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
};

const ChatSidebarContext = createContext<ChatSidebarContextValue | null>(null);

export function useChatSidebar() {
  const context = useContext(ChatSidebarContext);
  if (!context) throw new Error("useChatSidebar must be used within ChatSidebarProvider");
  return context;
}

function getInitialWidth() {
  if (typeof window === "undefined") return 260;
  try {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (!saved) return 260;
    const width = parseInt(saved, 10);
    if (width >= SIDEBAR_MIN_WIDTH && width <= SIDEBAR_MAX_WIDTH) return width;
  } catch {}
  return 260;
}

export function ChatSidebarProvider({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const sidebarWidthRef = useRef(260);
  const isDragging = useRef(false);

  useLayoutEffect(() => {
    sidebarWidthRef.current = getInitialWidth();
    if (sidebarRef.current) {
      sidebarRef.current.style.setProperty("--sidebar-w", `${sidebarWidthRef.current}px`);
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_BREAKPOINT);
    const sync = () => {
      const desktop = mediaQuery.matches;
      setIsDesktop(desktop);
      if (desktop) setMobileOpen(false);
    };

    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const toggleSidebar = useCallback(() => {
    if (isDesktop) {
      const sidebar = sidebarRef.current;
      if (sidebar) sidebar.classList.remove("no-transition");
      setSidebarCollapsed((prev) => !prev);
      return;
    }
    setMobileOpen((prev) => !prev);
  }, [isDesktop]);

  const openMobileSidebar = useCallback(() => {
    setMobileOpen(true);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const startResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    event.preventDefault();
    sidebar.classList.add("no-transition");
    isDragging.current = true;

    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (moveEvent: PointerEvent) => {
      if (!isDragging.current) return;
      const width = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, moveEvent.clientX));
      sidebarWidthRef.current = width;
      sidebar.style.setProperty("--sidebar-w", `${width}px`);
    };

    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      sidebar.classList.remove("no-transition");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidthRef.current));
      } catch {}
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }, []);

  const value = useMemo(
    () => ({
      isDesktop,
      mobileOpen,
      sidebarCollapsed,
      toggleSidebar,
      openMobileSidebar,
      closeMobileSidebar,
    }),
    [isDesktop, mobileOpen, sidebarCollapsed, toggleSidebar, openMobileSidebar, closeMobileSidebar]
  );

  return (
    <ChatSidebarContext.Provider value={value}>
      <div className="h-full flex relative">
        <div
          ref={sidebarRef}
          data-role="sidebar-panel"
          className="relative hidden lg:flex flex-col flex-shrink-0 overflow-hidden sidebar-panel"
          style={{
            width: sidebarCollapsed ? "0px" : "var(--sidebar-w)",
            minWidth: sidebarCollapsed ? "0px" : undefined,
            borderRight: sidebarCollapsed ? "none" : "1px solid var(--border-light)",
            background: "var(--bg-surface)",
            "--sidebar-w": `${sidebarWidthRef.current}px`,
          } as CSSProperties}
          aria-hidden={sidebarCollapsed}
        >
          <div
            className="absolute top-3 z-10"
            style={{
              right: sidebarCollapsed ? "-24px" : "-12px",
              transition: "right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <button
              onClick={toggleSidebar}
              className="w-6 h-6 flex items-center justify-center rounded-full text-xs transition-colors shadow-[var(--shadow-soft)] border"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border-light)",
                color: "var(--text-tertiary)",
              }}
              title={sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
              aria-label={sidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
            >
              {sidebarCollapsed ? "▸" : "◂"}
            </button>
          </div>
          {sidebar}
        </div>

        {!sidebarCollapsed && (
          <div
            className="hidden lg:block divider-handle"
            onPointerDown={startResize}
            title="拖拽调整宽度"
            role="separator"
            aria-orientation="vertical"
            aria-label="调整侧边栏宽度"
          />
        )}

        <OverlayPanel open={mobileOpen} onClose={closeMobileSidebar} title="会话侧边栏" side="right">
          <div className="h-full flex flex-col" style={{ background: "var(--bg-surface)" }}>
            {sidebar}
          </div>
        </OverlayPanel>

        {children}
      </div>
    </ChatSidebarContext.Provider>
  );
}

export function ChatSidebarInset({ children }: { children: ReactNode }) {
  return (
    <div
      data-layout="main-area"
      data-role="main-area"
      className="flex-1 flex flex-col min-w-0"
      style={{ background: "var(--bg-page)" }}
    >
      {children}
    </div>
  );
}

export function ChatSidebarTrigger({ className = "" }: { className?: string }) {
  const { isDesktop, sidebarCollapsed, toggleSidebar } = useChatSidebar();

  return (
    <button
      onClick={toggleSidebar}
      className={`px-2 py-1 text-xs rounded-md transition-colors hover:bg-[var(--bg-hover)] ${className}`.trim()}
      style={{ color: "var(--text-tertiary)" }}
      title="切换侧边栏"
      aria-label="切换侧边栏"
    >
      <span className="lg:hidden">目录</span>
      <span className="hidden lg:inline">{isDesktop ? (sidebarCollapsed ? "☰" : "✕") : "目录"}</span>
    </button>
  );
}

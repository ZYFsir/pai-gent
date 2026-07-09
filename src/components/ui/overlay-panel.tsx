"use client";

import { useEffect, useId, type ReactNode } from "react";

type OverlayPanelProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  side?: "center" | "left" | "right";
  maxWidthClassName?: string;
  children: ReactNode;
};

export function OverlayPanel({
  open,
  onClose,
  title,
  side = "center",
  maxWidthClassName = "max-w-lg",
  children,
}: OverlayPanelProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const containerClassName =
    side === "center"
      ? `w-full ${maxWidthClassName} max-h-[85vh]`
      : "w-[260px] h-full";

  const wrapperClassName =
    side === "center"
      ? "fixed inset-0 z-50 flex items-center justify-center p-4"
      : `fixed inset-0 z-50 flex ${side === "left" ? "justify-start" : "justify-end"}`;

  return (
    <div className={wrapperClassName} onClick={onClose}>
      <div className="absolute inset-0 bg-black/15" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`relative bg-[var(--bg-elevated)] border border-[var(--border-light)] shadow-[var(--shadow-md)] flex flex-col animate-fade-in ${containerClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
        {title ? <h2 id={titleId} className="sr-only">{title}</h2> : null}
        {children}
      </div>
    </div>
  );
}

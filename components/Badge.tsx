import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "default",
  className = "",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "muted";
  className?: string;
}) {
  const tones = {
    default: "bg-card border-border text-foreground",
    accent: "bg-accent-soft/40 border-accent-soft text-foreground",
    muted: "bg-background border-border text-muted",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tight ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

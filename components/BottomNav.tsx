"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderHeart, Globe, Search, Settings, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Discover", icon: Sparkles },
  { href: "/research", label: "Research", icon: Search },
  { href: "/folders", label: "Folders", icon: FolderHeart },
  { href: "/sources", label: "Sources", icon: Globe },
  { href: "/settings", label: "Settings", icon: Settings },
];

const HIDDEN_PATHS = ["/login", "/auth"];

export function BottomNav() {
  const pathname = usePathname();
  if (HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md pb-safe"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-around">
        {TABS.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname === tab.href || pathname.startsWith(tab.href + "/");
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium tracking-tight transition-colors ${
                  active ? "text-foreground" : "text-muted-2 hover:text-muted"
                }`}
              >
                <Icon
                  className="h-5 w-5"
                  strokeWidth={active ? 2.4 : 1.8}
                  fill={active ? "currentColor" : "none"}
                  fillOpacity={active ? 0.12 : 0}
                />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

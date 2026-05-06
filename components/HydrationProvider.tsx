"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";

/**
 * On mount, fetch the authenticated user's data from Supabase into zustand.
 * Failures (no auth, network, etc.) leave the store with hydrationError set,
 * but pages still mount — /login doesn't depend on any store data.
 */
export function HydrationProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  return <>{children}</>;
}

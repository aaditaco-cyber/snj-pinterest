"use client";

import { Loader2, LogIn } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("aaditaco@gmail.com");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setState({ kind: "submitting" });
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setState({ kind: "error", message: error.message });
      } else {
        router.replace("/");
        router.refresh();
      }
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  };

  const submitting = state.kind === "submitting";

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 pb-safe pt-safe">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground">
            <span className="font-serif text-3xl font-semibold text-accent">S</span>
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">
            SNJ Pinterest
          </h1>
          <p className="mt-1 text-xs text-muted">
            Wholesale jewelry discovery
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-border bg-card px-4 py-3 text-base outline-none focus:border-accent"
              disabled={submitting}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your passcode"
              className="rounded-xl border border-border bg-card px-4 py-3 text-base outline-none focus:border-accent"
              disabled={submitting}
            />
          </label>
          <button
            type="submit"
            disabled={!email.trim() || !password || submitting}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition disabled:opacity-40"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" /> Sign in
              </>
            )}
          </button>
          {state.kind === "error" && (
            <p className="rounded-md bg-skip/10 px-3 py-2 text-xs text-skip">
              {state.message}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}

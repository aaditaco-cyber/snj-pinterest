"use client";

import { Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setState({ kind: "sending" });
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setState({ kind: "error", message: error.message });
      } else {
        setState({ kind: "sent", email: trimmed });
      }
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  };

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

        {state.kind === "sent" ? (
          <SentState email={state.email} onReset={() => setState({ kind: "idle" })} />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">Your email</span>
              <input
                autoFocus
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="off"
                autoCorrect="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="rounded-xl border border-border bg-card px-4 py-3 text-base outline-none focus:border-accent"
                disabled={state.kind === "sending"}
              />
            </label>
            <button
              type="submit"
              disabled={!email.trim() || state.kind === "sending"}
              className="flex items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition disabled:opacity-40"
            >
              {state.kind === "sending" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending link…
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" /> Email me a magic link
                </>
              )}
            </button>
            {state.kind === "error" && (
              <p className="rounded-md bg-skip/10 px-3 py-2 text-xs text-skip">
                {state.message}
              </p>
            )}
            <p className="mt-1 text-center text-[11px] text-muted-2">
              No password — we send a one-tap link to your inbox.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}

function SentState({ email, onReset }: { email: string; onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-save/10">
        <Mail className="h-5 w-5 text-save" />
      </div>
      <h2 className="mt-3 text-base font-semibold">Check your inbox</h2>
      <p className="mt-1 text-sm text-muted">
        We sent a magic link to <strong>{email}</strong>. Tap the link on this
        device to sign in.
      </p>
      <p className="mt-3 text-[11px] text-muted-2">
        Not seeing it? Check spam, or{" "}
        <button onClick={onReset} className="underline hover:text-foreground">
          try a different email
        </button>
        .
      </p>
    </div>
  );
}

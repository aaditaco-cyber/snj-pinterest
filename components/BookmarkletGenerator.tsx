"use client";

import { AnimatePresence, motion } from "motion/react";
import { Copy, Loader2, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { Source } from "@/lib/types";

/**
 * Modal that shows a draggable bookmarklet bound to a specific research
 * source. Used for sites we can't scrape server-side (Cloudflare, headless
 * stores, etc.) — the user runs the JS in their own browser, so it inherits
 * their real fingerprint and cookies.
 */
export function BookmarkletGenerator({
  source,
  onClose,
}: {
  source: Source | null;
  onClose: () => void;
}) {
  const getToken = useStore((s) => s.getBookmarkletToken);
  const regenerate = useStore((s) => s.regenerateBookmarkletToken);

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const open = source !== null;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getToken().then((t) => {
      if (cancelled) return;
      if (!t) setError("Couldn't load your bookmarklet token.");
      setToken(t);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, getToken]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const apiUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/research/bookmarklet/ingest`
      : "";

  const bookmarklet =
    token && source
      ? buildBookmarklet({ apiUrl, token, sourceId: source.id })
      : "";
  // Same code, but unwrapped from the `javascript:` URL so it can be pasted
  // into DevTools console on sites with strict CSP that block bookmarklets.
  const consoleCode =
    token && source
      ? buildConsoleCode({ apiUrl, token, sourceId: source.id })
      : "";
  const linkLabel = source ? `SNJ → ${source.name}` : "SNJ";

  const handleRegenerate = async () => {
    if (!confirm("Regenerating invalidates any bookmarks already in your bar. Continue?")) {
      return;
    }
    setLoading(true);
    const t = await regenerate();
    if (!t) setError("Couldn't regenerate token.");
    setToken(t);
    setLoading(false);
  };

  const handleCopy = async () => {
    if (!bookmarklet) return;
    try {
      await navigator.clipboard.writeText(bookmarklet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fall through silently
    }
  };

  const handleCopyConsole = async () => {
    if (!consoleCode) return;
    try {
      await navigator.clipboard.writeText(consoleCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fall through silently
    }
  };

  return (
    <AnimatePresence>
      {open && source && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] bg-foreground/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
            className="fixed inset-x-0 bottom-0 z-[70] max-h-[90vh] overflow-hidden rounded-t-3xl bg-card shadow-2xl pb-safe"
          >
            <div className="mx-auto mt-2.5 flex h-1.5 w-10 items-center justify-center rounded-full bg-border" />
            <div className="flex items-center justify-between px-5 pt-3 pb-2">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-2">
                  Bookmarklet
                </p>
                <h3 className="truncate text-base font-semibold">
                  {source.name}
                </h3>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-background"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-6">
              <p className="text-sm text-muted">
                For sites that block our scraper (Cloudflare, headless storefronts).
                Drag the button below to your bookmarks bar, then click it any
                time you&apos;re on a relevant retailer page in your browser.
              </p>

              <div className="mt-4 rounded-2xl border border-border bg-background p-4">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading token…
                  </div>
                ) : error ? (
                  <p className="rounded-md bg-skip/10 px-3 py-2 text-xs text-skip">
                    {error}
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-muted-2">
                      Drag this to your bookmarks bar
                    </p>
                    {/*
                       React 18+ sanitizes any javascript: URL it sees in href
                       props or setAttribute calls inside its render. Inserting
                       the anchor as raw HTML via dangerouslySetInnerHTML keeps
                       React out of the path entirely, so the dragged bookmark
                       gets the actual code instead of React's error stub.
                    */}
                    <div
                      className="flex justify-center"
                      dangerouslySetInnerHTML={{
                        __html: buildLinkHtml(bookmarklet, linkLabel),
                      }}
                    />
                    <button
                      onClick={handleCopy}
                      className="mt-3 flex w-full items-center justify-center gap-1 rounded-full border border-border bg-card py-1.5 text-xs font-medium text-muted hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />
                      {copied ? "Copied!" : "Copy raw bookmarklet code"}
                    </button>
                  </>
                )}
              </div>

              <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-xs text-muted">
                <li>
                  Show your bookmarks bar:{" "}
                  <kbd className="rounded bg-background px-1 font-mono text-[10px]">
                    Cmd+Shift+B
                  </kbd>{" "}
                  (Mac) or{" "}
                  <kbd className="rounded bg-background px-1 font-mono text-[10px]">
                    Ctrl+Shift+B
                  </kbd>{" "}
                  (Windows).
                </li>
                <li>
                  Drag the button above onto the bar. It becomes a normal
                  bookmark.
                </li>
                <li>
                  Visit any jewelry page on the source site (best-sellers,
                  category page, or a single product).
                </li>
                <li>
                  Click the bookmark. You&apos;ll see an alert with how many
                  products were captured. They&apos;ll appear in
                  <strong className="text-foreground"> {source.name} </strong>
                  on /research immediately.
                </li>
              </ol>

              <details className="mt-4 rounded-2xl border border-border bg-background p-3 text-xs">
                <summary className="cursor-pointer font-medium text-muted">
                  Bookmarklet didn&apos;t work? Run from console
                </summary>
                <p className="mt-2 text-muted-2">
                  Some sites (Cloudflare-protected, strict CSP) block
                  bookmarklets from running. The browser&apos;s DevTools
                  Console doesn&apos;t enforce the same restrictions, so
                  pasting the code there usually works.
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
                  <li>
                    On the retailer page, open DevTools:{" "}
                    <kbd className="rounded bg-card px-1 font-mono text-[10px]">
                      Cmd+Opt+I
                    </kbd>{" "}
                    (Mac) or{" "}
                    <kbd className="rounded bg-card px-1 font-mono text-[10px]">
                      F12
                    </kbd>
                  </li>
                  <li>Click the <strong>Console</strong> tab.</li>
                  <li>
                    Click <strong>Copy code</strong> below, paste into the
                    console, hit Enter.
                  </li>
                </ol>
                <button
                  onClick={handleCopyConsole}
                  className="mt-3 flex w-full items-center justify-center gap-1 rounded-full border border-border bg-card py-1.5 text-xs font-medium text-muted hover:text-foreground"
                >
                  <Copy className="h-3 w-3" />
                  {copied ? "Copied!" : "Copy console code"}
                </button>
              </details>

              <details className="mt-3 rounded-2xl border border-border bg-background p-3 text-xs">
                <summary className="cursor-pointer font-medium text-muted">
                  Security &amp; token regeneration
                </summary>
                <p className="mt-2 text-muted-2">
                  Each user has one personal token. Anyone who can use this
                  bookmarklet can post products to your account, so don&apos;t
                  share it. If you ever shared the bar or pasted the code
                  somewhere public, regenerate below — the old token stops
                  working immediately.
                </p>
                <button
                  onClick={handleRegenerate}
                  disabled={loading}
                  className="mt-3 flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-foreground hover:text-background disabled:opacity-50"
                >
                  <RefreshCw className="h-3 w-3" />
                  Regenerate token
                </button>
              </details>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Build the `javascript:` URL the user drags to their bookmark bar. We embed
 * the per-user token, the target source id, and our deployed API URL.
 *
 * The bookmarklet code intentionally avoids ES syntax that older browsers
 * can't parse (no optional chaining or nullish coalescing) so it works on a
 * wide range of retailer sites.
 */
function buildBookmarklet({
  apiUrl,
  token,
  sourceId,
}: {
  apiUrl: string;
  token: string;
  sourceId: string;
}) {
  // Single-statement IIFE. Sends Content-Type: text/plain so the request stays
  // a "simple request" and doesn't trigger a CORS preflight.
  const code = bookmarkletBody({ apiUrl, token, sourceId });
  return `javascript:${encodeURIComponent(code)}`;
}

function buildLinkHtml(bookmarklet: string, label: string): string {
  // dangerouslySetInnerHTML doesn't go through React's URL sanitizer, so the
  // javascript: href stays intact. Both bookmarklet and label are escaped to
  // prevent any HTML/JS injection through unexpected source-name characters.
  const safeHref = escapeHtmlAttr(bookmarklet);
  const safeLabel = escapeHtml(label);
  return `<a
    href="${safeHref}"
    draggable="true"
    onclick="event.preventDefault();alert('Drag this to your bookmarks bar — clicking it here won\\'t run the script.');return false;"
    class="flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background no-underline shadow-sm hover:opacity-90"
  ><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:0.375rem"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>${safeLabel}</a>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlAttr(str: string): string {
  // Same as escapeHtml but used in a contexts where we know it's an attribute
  // value. Kept separate in case we want to relax HTML-text escapes someday.
  return escapeHtml(str);
}

/** Same code, unwrapped — for paste into DevTools console. */
function buildConsoleCode({
  apiUrl,
  token,
  sourceId,
}: {
  apiUrl: string;
  token: string;
  sourceId: string;
}) {
  return bookmarkletBody({ apiUrl, token, sourceId });
}

function bookmarkletBody({
  apiUrl,
  token,
  sourceId,
}: {
  apiUrl: string;
  token: string;
  sourceId: string;
}) {
  // The console.log calls help debug when this runs in DevTools — bookmarklet
  // path benefits too if the user has the console open.
  return `(async()=>{try{console.log('[SNJ] bookmarklet running…');var blocks=Array.prototype.map.call(document.querySelectorAll('script[type="application/ld+json"]'),function(s){return s.textContent;}).filter(Boolean);var parsed=[];for(var i=0;i<blocks.length;i++){try{parsed.push(JSON.parse(blocks[i]));}catch(_){}}console.log('[SNJ] ld+json blocks parsed:',parsed.length);var og={};Array.prototype.forEach.call(document.querySelectorAll('meta'),function(m){var k=m.getAttribute('property')||m.getAttribute('name');var v=m.getAttribute('content');if(k&&v&&(k.indexOf('og:')===0||k.indexOf('product:')===0||k.indexOf('twitter:')===0))og[k]=v;});console.log('[SNJ] og keys:',Object.keys(og).length);var r=await fetch(${JSON.stringify(apiUrl)},{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({token:${JSON.stringify(token)},sourceId:${JSON.stringify(sourceId)},url:location.href,title:document.title,ldBlocks:parsed,og:og})});var d=await r.json();console.log('[SNJ] result:',d);alert('SNJ: '+(d.message||d.reason||'done'));}catch(e){console.error('[SNJ] error:',e);alert('SNJ error: '+(e&&e.message||e));}})();`;
}

"use client";

/**
 * WaChat AI Copilot dock
 *
 * A reusable slide-in copilot panel for the inbox, templates, broadcasts and
 * flows. Streams reply drafts / summaries live from the SSE route
 * (/api/v1/wachat/ai/stream) with a blinking caret, and runs one-shot actions
 * (translate, sentiment) via server actions. Render it once per surface and
 * control with `open`/`onOpenChange`; wire `onInsert` to drop a draft into the
 * composer.
 *
 * Motion: framer-motion for the slide-in (separate instance from the app's
 * motion/react LazyMotion — safe), plus the WaChat motion kit primitives.
 */

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Copy,
  CornerDownLeft,
  Languages,
  ListChecks,
  Smile,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/sabcrm/20ui";
import { cn } from "@/lib/utils";
import { aiSentiment, aiTranslate } from "@/lib/wachat/ai/copilot-actions";
import type { BrandVoiceInput, TranscriptTurn } from "@/lib/wachat/ai/types";

import { ProcessingDots, StreamingText } from "../motion";

export type CopilotContext = "inbox" | "template" | "broadcast" | "flow";

export interface CopilotDockProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** The active conversation (required for inbox draft/summarize/sentiment). */
  transcript?: TranscriptTurn[];
  brand?: BrandVoiceInput;
  /** Drop a generated draft into the surface's composer/editor. */
  onInsert?: (text: string) => void;
  context?: CopilotContext;
  className?: string;
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const LANGS = ["English", "Hindi", "Spanish", "Arabic", "Portuguese", "French"];

export function CopilotDock({
  open,
  onOpenChange,
  projectId,
  transcript,
  brand,
  onInsert,
  context = "inbox",
  className,
}: CopilotDockProps) {
  const [output, setOutput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [instruction, setInstruction] = React.useState("");
  const [showLangs, setShowLangs] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const outRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    outRef.current?.scrollTo({ top: outRef.current.scrollHeight });
  }, [output]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const hasConvo = Array.isArray(transcript) && transcript.length > 0;

  async function runStream(mode: "draft" | "summary") {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setError(null);
    setOutput("");
    setStreaming(true);
    try {
      const res = await fetch("/api/v1/wachat/ai/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, mode, transcript, brand, instruction: instruction || undefined }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        setError(res.status === 401 ? "Please sign in again." : `Request failed (${res.status}).`);
        setStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          try {
            const evt = JSON.parse(line.slice(5).trim()) as {
              delta?: string;
              done?: boolean;
              error?: string;
            };
            if (evt.error) setError(evt.error);
            if (evt.delta) setOutput((o) => o + evt.delta);
          } catch {
            /* keep-alive */
          }
        }
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError(e instanceof Error ? e.message : "AI stream failed.");
      }
    } finally {
      setStreaming(false);
    }
  }

  async function runTranslate(lang: string) {
    setShowLangs(false);
    const source = output || transcript?.filter((t) => t.direction === "out").slice(-1)[0]?.text || "";
    if (!source.trim()) {
      setError("Nothing to translate yet — draft or pick a message first.");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await aiTranslate({ text: source, targetLanguage: lang });
    setBusy(false);
    if (r.ok) setOutput(r.text);
    else setError(r.error ?? "Translation failed.");
  }

  async function runSentiment() {
    if (!hasConvo) return;
    setBusy(true);
    setError(null);
    const r = await aiSentiment({ transcript: transcript! });
    setBusy(false);
    if (!r.ok) {
      setError(r.error ?? "Could not analyze sentiment.");
      return;
    }
    const pct = Math.round(((r.score + 1) / 2) * 100);
    setOutput(
      `Sentiment: ${r.label.toUpperCase()} (${pct}% positive)${r.emotion ? `\nEmotion: ${r.emotion}` : ""}`,
    );
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => onOpenChange(false)}
            aria-hidden
          />
          <motion.aside
            className={cn(
              "ui20 fixed right-0 top-0 z-50 flex h-full w-[min(420px,92vw)] flex-col border-l border-[var(--st-border)] bg-[var(--st-bg)] shadow-2xl",
              className,
            )}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            role="dialog"
            aria-label="AI copilot"
          >
            {/* header */}
            <header className="flex items-center justify-between gap-2 border-b border-[var(--st-border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--st-accent)] text-[var(--st-bg)]">
                  <Sparkles size={15} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--st-text)]">AI Copilot</p>
                  <p className="text-[11px] text-[var(--st-text-secondary)]">Powered by Claude</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" iconLeft={X} aria-label="Close copilot" onClick={() => onOpenChange(false)} />
            </header>

            {/* quick actions */}
            <div className="flex flex-wrap gap-2 border-b border-[var(--st-border)] px-4 py-3">
              {context === "inbox" || hasConvo ? (
                <>
                  <Button size="sm" variant="primary" iconLeft={Sparkles} loading={streaming} disabled={!hasConvo || busy} onClick={() => runStream("draft")}>
                    Draft reply
                  </Button>
                  <Button size="sm" variant="secondary" iconLeft={ListChecks} disabled={!hasConvo || streaming || busy} onClick={() => runStream("summary")}>
                    Summarize
                  </Button>
                  <Button size="sm" variant="secondary" iconLeft={Smile} loading={busy} disabled={!hasConvo || streaming} onClick={runSentiment}>
                    Sentiment
                  </Button>
                </>
              ) : null}
              <div className="relative">
                <Button size="sm" variant="secondary" iconLeft={Languages} disabled={streaming} onClick={() => setShowLangs((s) => !s)}>
                  Translate
                </Button>
                {showLangs ? (
                  <div className="absolute left-0 top-full z-10 mt-1 w-40 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] p-1 shadow-lg">
                    {LANGS.map((l) => (
                      <button
                        key={l}
                        type="button"
                        className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
                        onClick={() => runTranslate(l)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* output */}
            <div ref={outRef} className="flex-1 overflow-y-auto px-4 py-4">
              {error ? (
                <p className="rounded-lg border border-[var(--st-danger,#dc2626)]/30 bg-[var(--st-danger,#dc2626)]/8 px-3 py-2 text-sm text-[var(--st-danger,#dc2626)]">
                  {error}
                </p>
              ) : null}
              {!output && !streaming && !busy && !error ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-[var(--st-text-secondary)]">
                  <Sparkles size={26} className="opacity-50" />
                  <p className="max-w-[240px] text-sm">
                    {hasConvo
                      ? "Draft a reply, summarize the chat, gauge sentiment, or translate — all grounded in this conversation."
                      : "Open a conversation to draft replies, or use Translate on your text."}
                  </p>
                </div>
              ) : null}
              {busy && !output ? <ProcessingDots className="text-[var(--st-accent)]" /> : null}
              {output || streaming ? (
                <div className="whitespace-pre-wrap rounded-xl border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3.5 py-3 text-sm leading-relaxed text-[var(--st-text)]">
                  <StreamingText text={output} streaming={streaming} />
                </div>
              ) : null}
            </div>

            {/* footer: instruction + insert/copy */}
            <footer className="space-y-2 border-t border-[var(--st-border)] px-4 py-3">
              <input
                className="w-full rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-sm text-[var(--st-text)] outline-none focus:border-[var(--st-accent)]"
                placeholder="Steer the draft (e.g. 'offer a 10% discount, keep it short')"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && hasConvo && !streaming) runStream("draft");
                }}
              />
              {output && !streaming ? (
                <div className="flex gap-2">
                  {onInsert ? (
                    <Button size="sm" variant="primary" iconLeft={CornerDownLeft} onClick={() => onInsert(output)}>
                      Insert
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    iconLeft={Copy}
                    onClick={() => navigator.clipboard?.writeText(output).catch(() => {})}
                  >
                    Copy
                  </Button>
                </div>
              ) : null}
            </footer>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export default CopilotDock;

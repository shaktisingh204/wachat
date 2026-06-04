'use client';

/**
 * SabCRM — AI Assistant surface (`/sabcrm/ai`), Twenty-faithful.
 *
 * A chat UI rendered in Twenty's visual language (`.st-*` classes + the
 * `@/components/sabcrm/twenty` kit + the sibling `./ai.css` — NO ZoruUI /
 * Tailwind / clay). It posts the running transcript to `/api/sabcrm/ai` (the
 * existing, gated AI backend route — there is no AI server action in
 * `sabcrm*.actions.ts`, this dedicated route IS the backend) and streams the
 * assistant reply back into the transcript.
 *
 * Twenty parity notes (mirrors `twenty-front/src/modules/ai/components`):
 *   - Assistant messages render flush-left with a transparent background and
 *     no avatar (Twenty's `AiChatMessage` / `StyledMessageText` for non-user).
 *   - User messages get a small tinted bubble, right-aligned.
 *   - Each message gets a hover footer with a relative timestamp + a copy
 *     button (Twenty's `StyledMessageFooter` + `LightCopyIconButton`).
 *   - A floating "scroll to bottom" button appears when scrolled up
 *     (Twenty's `AiChatScrollToBottomButton`).
 *   - Streaming "thinking" indicator while the first token is in flight.
 *
 * Honesty: when the route reports it has no provider key configured (HTTP 503
 * with `{ ok:false, error }`), we surface a clear "AI isn't configured yet"
 * banner instead of pretending to answer (mirrors Twenty's
 * `AiChatApiKeyNotConfiguredMessage`).
 */

export const dynamic = 'force-dynamic';

import * as React from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  AlertTriangle,
  ArrowDown,
  Check,
  Copy,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';

import '@/styles/sabcrm-twenty.css';
import './ai.css';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
}

const SUGGESTED_PROMPTS: readonly string[] = [
  'Summarize my open opportunities',
  'Draft a follow-up note for a stalled deal',
  'What should I prioritize today?',
  'Write a cold outreach email for a new lead',
];

function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Lightweight relative timestamp ("just now", "2m", "3h", or a date). */
function relativeTime(then: number, now: number): string {
  const secs = Math.max(0, Math.round((now - then) / 1000));
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Copy button (Twenty's LightCopyIconButton equivalent)
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onCopy = React.useCallback(() => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1200);
    });
  }, [text]);

  return (
    <button
      type="button"
      className="st-ai__copy"
      onClick={onCopy}
      aria-label={copied ? 'Copied' : 'Copy message'}
      title={copied ? 'Copied' : 'Copy'}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmAiPage(): React.JSX.Element {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [unconfigured, setUnconfigured] = React.useState(false);
  const [atBottom, setAtBottom] = React.useState(true);
  const [nowTick, setNowTick] = React.useState(() => Date.now());

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const stickRef = React.useRef(true);

  // Auto-grow the composer textarea up to its CSS max-height.
  React.useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // Keep the newest message in view as the transcript / stream grows — but
  // only while the user hasn't scrolled up (Twenty's auto-scroll behaviour).
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  // Refresh relative timestamps periodically.
  React.useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const onScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isBottom = distance < 32;
    stickRef.current = isBottom;
    setAtBottom(isBottom);
  }, []);

  const scrollToBottom = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;

      setError(null);
      setUnconfigured(false);
      stickRef.current = true;

      const now = Date.now();
      const userMsg: ChatMessage = {
        id: newId(),
        role: 'user',
        content: trimmed,
        createdAt: now,
      };
      const assistantId = newId();

      // Snapshot the transcript we send (history + this turn) BEFORE state
      // updates, so the request payload is exact.
      const payload = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: 'assistant', content: '', createdAt: now },
      ]);
      setInput('');
      setPending(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/sabcrm/ai', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messages: payload }),
          signal: controller.signal,
        });

        // Non-OK → parse the JSON error body and surface it honestly.
        if (!res.ok) {
          let message = `Request failed (${res.status}).`;
          try {
            const data = (await res.json()) as { error?: string };
            if (data?.error) message = data.error;
          } catch {
            /* keep the generic message */
          }
          if (res.status === 503) setUnconfigured(true);
          else setError(message);
          // Drop the empty assistant placeholder we optimistically added.
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          return;
        }

        // Stream the plain-text body into the assistant message.
        const reader = res.body?.getReader();
        if (!reader) {
          const fallback = await res.text();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: fallback } : m,
            ),
          );
          return;
        }

        const decoder = new TextDecoder();
        let acc = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: acc } : m,
            ),
          );
        }
        acc += decoder.decode();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: acc || 'No response.' }
              : m,
          ),
        );
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setError(
          err instanceof Error ? err.message : 'Something went wrong.',
        );
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setPending(false);
        abortRef.current = null;
      }
    },
    [messages, pending],
  );

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const onSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void send(input);
    },
    [input, send],
  );

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void send(input);
      }
    },
    [input, send],
  );

  const isEmpty = messages.length === 0;

  return (
    <div className="st-ai">
      <TwentyPageHeader title="AI Assistant" icon={Sparkles} />

      <div className="st-ai__body">
        <div className="st-ai__scroll" ref={scrollRef} onScroll={onScroll}>
          {isEmpty ? (
            <div className="st-ai__welcome">
              <span className="st-ai__welcome-icon" aria-hidden="true">
                <Sparkles size={22} />
              </span>
              <h2 className="st-ai__welcome-title">How can I help?</h2>
              <p className="st-ai__welcome-sub">
                Ask about your opportunities, contacts, and tasks — or have me
                draft a note or email.
              </p>
              <div className="st-ai__chips">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="st-ai__chip"
                    onClick={() => void send(prompt)}
                    disabled={pending}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="st-ai__messages">
              {messages.map((m) => {
                const isUser = m.role === 'user';
                const streaming =
                  pending && m.role === 'assistant' && m.content === '';
                return (
                  <li
                    key={m.id}
                    className={`st-ai__msg st-ai__msg--${m.role}`}
                  >
                    <div className="st-ai__bubble">
                      {m.content ? (
                        m.content
                      ) : streaming ? (
                        <span
                          className="st-ai__typing"
                          aria-label="Thinking"
                        >
                          <Loader2 size={14} className="st-ai__spin" />
                          Thinking…
                        </span>
                      ) : (
                        ''
                      )}
                    </div>
                    {m.content && !streaming ? (
                      <div className="st-ai__footer">
                        <span className="st-ai__timestamp">
                          {relativeTime(m.createdAt, nowTick)}
                        </span>
                        <CopyButton text={m.content} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {unconfigured ? (
            <div className="st-ai__notice st-ai__notice--info" role="status">
              <AlertTriangle size={16} aria-hidden="true" />
              <div>
                <strong>AI isn’t configured yet.</strong>
                <p>
                  Add a provider key (<code>AI_GATEWAY_API_KEY</code>,{' '}
                  <code>ANTHROPIC_API_KEY</code>, or{' '}
                  <code>OPENAI_API_KEY</code>) to enable the assistant.
                </p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="st-ai__notice st-ai__notice--error" role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>

        {!isEmpty && !atBottom ? (
          <button
            type="button"
            className="st-ai__scroll-bottom"
            onClick={scrollToBottom}
            aria-label="Scroll to latest"
            title="Scroll to latest"
          >
            <ArrowDown size={16} />
          </button>
        ) : null}

        <form className="st-ai__composer" onSubmit={onSubmit}>
          <textarea
            ref={inputRef}
            className="st-ai__input"
            placeholder="Message the AI Assistant…"
            aria-label="Message the AI Assistant"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
          />
          {pending ? (
            <TwentyButton variant="secondary" type="button" onClick={stop}>
              Stop
            </TwentyButton>
          ) : (
            <TwentyButton
              variant="primary"
              type="submit"
              icon={Send}
              disabled={input.trim().length === 0}
            >
              Send
            </TwentyButton>
          )}
        </form>
      </div>
    </div>
  );
}

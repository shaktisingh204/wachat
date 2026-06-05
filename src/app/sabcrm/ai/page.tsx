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
 *   - Assistant replies render as sanitized Markdown (Twenty's
 *     `LazyMarkdownRenderer`), via the dependency-free
 *     `@/components/sabcrm/twenty/markdown` renderer.
 *   - The chat thread is persisted to `localStorage`, scoped per active
 *     project, with a "New chat" control to clear it (Twenty's thread list /
 *     new-thread affordance, collapsed to a single workspace thread here).
 *
 * CRM grounding: before each request we gather a lightweight context snapshot
 * (per-object record counts via the existing gated `listSabcrmObjectsTw` +
 * `countSabcrmRecordsTw` actions) and prepend it to the transcript as a
 * `system` message — a role the `/api/sabcrm/ai` route already accepts. If the
 * actions are missing or fail, we degrade gracefully and send the chat as-is.
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
  AlertTriangle,
  ArrowDown,
  Check,
  Copy,
  Plus,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import { TwentyMarkdown } from '@/components/sabcrm/twenty/markdown';
import {
  Button,
  IconButton,
  Textarea,
  Alert,
  Spinner,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';

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
// Thread persistence (localStorage, scoped per active project)
// ---------------------------------------------------------------------------

/** Storage key for a project's saved transcript. */
function threadKey(projectId: string | null): string {
  return `sabcrm.ai.thread.${projectId ?? 'default'}`;
}

/** Read + validate a saved transcript; tolerant of corrupt/legacy data. */
function loadThread(projectId: string | null): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(threadKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ChatMessage[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const { id, role, content, createdAt } = item as Partial<ChatMessage>;
      if (
        typeof id === 'string' &&
        (role === 'user' || role === 'assistant') &&
        typeof content === 'string' &&
        typeof createdAt === 'number'
      ) {
        out.push({ id, role, content, createdAt });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Persist (or clear) a project's transcript. */
function saveThread(projectId: string | null, messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    const key = threadKey(projectId);
    if (messages.length === 0) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(messages));
    }
  } catch {
    /* storage full / disabled — non-fatal, the thread just won't persist */
  }
}

// ---------------------------------------------------------------------------
// CRM context — lightweight object counts for grounding the assistant
// ---------------------------------------------------------------------------

/**
 * Gather per-object record counts via the existing gated actions and format
 * them as a single `system` context line. Degrades to `null` on any failure
 * (missing action, gate denial, network) so the chat still works ungrounded.
 */
async function gatherCrmContext(
  projectId: string | null,
): Promise<string | null> {
  try {
    const mod = (await import(
      '@/app/actions/sabcrm-twenty.actions'
    )) as typeof import('@/app/actions/sabcrm-twenty.actions');

    const listFn = mod.listSabcrmObjectsTw;
    const countFn = mod.countSabcrmRecordsTw;
    if (typeof listFn !== 'function' || typeof countFn !== 'function') {
      return null;
    }

    const pid = projectId ?? undefined;
    const objectsRes = await listFn(pid);
    if (!objectsRes?.ok || !Array.isArray(objectsRes.data)) return null;

    // Cap the breadth so the context line stays "lightweight".
    const objects = objectsRes.data.slice(0, 12);
    const counts = await Promise.all(
      objects.map(async (obj) => {
        try {
          const res = await countFn(obj.slug, {}, pid);
          if (res?.ok && typeof res.data?.count === 'number') {
            return { label: obj.labelPlural, count: res.data.count };
          }
        } catch {
          /* skip this object */
        }
        return null;
      }),
    );

    const parts = counts
      .filter((c): c is { label: string; count: number } => c !== null)
      .map((c) => `${c.label}: ${c.count}`);
    if (parts.length === 0) return null;

    return (
      'Current CRM record counts for this workspace — ' +
      parts.join(', ') +
      '. Use these figures when the user asks about totals or volume.'
    );
  } catch {
    return null;
  }
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
    <IconButton
      className="st-ai__copy"
      size="sm"
      variant="ghost"
      icon={copied ? Check : Copy}
      label={copied ? 'Copied' : 'Copy message'}
      onClick={onCopy}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmAiPage(): React.JSX.Element {
  const { activeProjectId } = useProject();

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [unconfigured, setUnconfigured] = React.useState(false);
  const [atBottom, setAtBottom] = React.useState(true);
  const [nowTick, setNowTick] = React.useState(() => Date.now());
  const [hydrated, setHydrated] = React.useState(false);

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

  // Hydrate the saved transcript for the active project (and re-hydrate when
  // the user switches projects, so each workspace keeps its own thread).
  React.useEffect(() => {
    setMessages(loadThread(activeProjectId));
    setError(null);
    setUnconfigured(false);
    setHydrated(true);
    stickRef.current = true;
  }, [activeProjectId]);

  // Persist on every transcript change (after the initial hydration), skipping
  // any in-flight empty assistant placeholder so we never store a half-written
  // streaming turn.
  React.useEffect(() => {
    if (!hydrated) return;
    const persistable = messages.filter(
      (m) => !(m.role === 'assistant' && m.content === ''),
    );
    saveThread(activeProjectId, persistable);
  }, [messages, activeProjectId, hydrated]);

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
      const transcript = [...messages, userMsg].map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
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
        // Ground the assistant with lightweight CRM context (object counts) as
        // a leading `system` message. Best-effort: null on any failure.
        const context = await gatherCrmContext(activeProjectId);
        const payload = context
          ? [{ role: 'system' as const, content: context }, ...transcript]
          : transcript;

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
    [messages, pending, activeProjectId],
  );

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Start a fresh thread: abort any stream, clear the transcript + notices,
  // and drop the saved copy for this project (Twenty's "new chat").
  const newChat = React.useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setInput('');
    setError(null);
    setUnconfigured(false);
    saveThread(activeProjectId, []);
    stickRef.current = true;
    inputRef.current?.focus();
  }, [activeProjectId]);

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
      <TwentyPageHeader
        title="AI Assistant"
        icon={Sparkles}
        actions={
          <TwentyButton
            variant="secondary"
            type="button"
            icon={Plus}
            onClick={newChat}
            disabled={isEmpty && input.trim().length === 0}
          >
            New chat
          </TwentyButton>
        }
      />

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
                  <Button
                    key={prompt}
                    variant="outline"
                    size="sm"
                    onClick={() => void send(prompt)}
                    disabled={pending}
                  >
                    {prompt}
                  </Button>
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
                        isUser ? (
                          m.content
                        ) : (
                          <TwentyMarkdown className="st-ai__md">
                            {m.content}
                          </TwentyMarkdown>
                        )
                      ) : streaming ? (
                        <span className="st-ai__typing">
                          <Spinner size="sm" label="Thinking" />
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
            <Alert
              className="st-ai__notice"
              tone="info"
              icon={AlertTriangle}
              title="AI isn’t configured yet."
            >
              Add a provider key (<code>AI_GATEWAY_API_KEY</code>,{' '}
              <code>ANTHROPIC_API_KEY</code>, or <code>OPENAI_API_KEY</code>) to
              enable the assistant.
            </Alert>
          ) : null}

          {error ? (
            <Alert className="st-ai__notice" tone="danger">
              {error}
            </Alert>
          ) : null}
        </div>

        {!isEmpty && !atBottom ? (
          <IconButton
            className="st-ai__scroll-bottom"
            icon={ArrowDown}
            label="Scroll to latest"
            onClick={scrollToBottom}
          />
        ) : null}

        <form className="st-ai__composer" onSubmit={onSubmit}>
          <Textarea
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

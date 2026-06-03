'use client';

/**
 * SabCRM — AI Assistant surface (`/sabcrm/ai`), Twenty-faithful.
 *
 * A chat UI rendered in Twenty's visual language (`.st-*` classes + the
 * `@/components/sabcrm/twenty` kit + the sibling `./ai.css` — NO ZoruUI /
 * Tailwind / clay). It posts the running transcript to `/api/sabcrm/ai` and
 * streams the assistant reply back into a bubble.
 *
 * Honesty: when the route reports it has no provider key configured (HTTP 503
 * with `{ ok:false, error }`), we surface a clear "AI isn't configured yet"
 * state instead of pretending to answer.
 */

export const dynamic = 'force-dynamic';

import * as React from 'react';
import { Sparkles, Send, Loader2, AlertTriangle, User } from 'lucide-react';

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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmAiPage(): React.JSX.Element {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [unconfigured, setUnconfigured] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    // Keep the newest message in view as the transcript / stream grows.
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const send = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;

      setError(null);
      setUnconfigured(false);

      const userMsg: ChatMessage = {
        id: newId(),
        role: 'user',
        content: trimmed,
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
        { id: assistantId, role: 'assistant', content: '' },
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

        // Stream the plain-text body into the assistant bubble.
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
        <div className="st-ai__scroll" ref={scrollRef}>
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
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={`st-ai__msg st-ai__msg--${m.role}`}
                >
                  <span className="st-ai__avatar" aria-hidden="true">
                    {m.role === 'assistant' ? (
                      <Sparkles size={14} />
                    ) : (
                      <User size={14} />
                    )}
                  </span>
                  <div className="st-ai__bubble">
                    {m.content ? (
                      m.content
                    ) : pending && m.role === 'assistant' ? (
                      <span className="st-ai__typing" aria-label="Thinking">
                        <Loader2 size={14} className="st-ai__spin" />
                        Thinking…
                      </span>
                    ) : (
                      ''
                    )}
                  </div>
                </li>
              ))}
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

        <form className="st-ai__composer" onSubmit={onSubmit}>
          <textarea
            className="st-ai__input"
            placeholder="Message the AI Assistant…"
            aria-label="Message the AI Assistant"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            disabled={pending}
          />
          <TwentyButton
            variant="primary"
            type="submit"
            icon={pending ? Loader2 : Send}
            disabled={pending || input.trim().length === 0}
            className={pending ? 'st-ai__send--busy' : undefined}
          >
            {pending ? 'Sending' : 'Send'}
          </TwentyButton>
        </form>
      </div>
    </div>
  );
}

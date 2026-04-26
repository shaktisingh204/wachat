'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
} from 'react';
import type { OutgoingMessage, InputRequest, SabFlowTheme } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { LuSend, LuLoader, LuRotateCcw, LuChevronRight } from 'react-icons/lu';

/* ── API helpers ────────────────────────────────────────── */

async function createSession(
  flowId: string,
  variables?: Record<string, string>,
): Promise<{ sessionId: string }> {
  const res = await fetch('/api/sabflow/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowId, variables }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? 'Failed to start session');
  }
  return res.json().then((d) => ({ sessionId: d.sessionId as string }));
}

async function executeStep(
  sessionId: string,
  input?: string,
): Promise<{ messages: OutgoingMessage[]; nextInput?: InputRequest; isCompleted: boolean }> {
  const res = await fetch('/api/sabflow/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, input }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? 'Execution failed');
  }
  return res.json();
}

/* ── Message types ──────────────────────────────────────── */

type ChatMessage =
  | { role: 'bot'; content: OutgoingMessage }
  | { role: 'user'; text: string }
  | { role: 'error'; text: string };

/* ── Props ──────────────────────────────────────────────── */

interface Props {
  /** MongoDB ID of the published SabFlow. */
  flowId: string;
  /** Optional pre-seeded variable values passed to the session. */
  initialVariables?: Record<string, string>;
  /** Theming — if not provided the flow's stored theme is used (server-side).
   *  For client-side preview pass directly. */
  theme?: SabFlowTheme;
  /** Extra CSS class on the root wrapper. */
  className?: string;
  /** Height of the chat container. Defaults to `100%`. */
  height?: string;
}

/* ── Bubble renderers ───────────────────────────────────── */

function BotBubble({
  msg,
  hostBg,
  hostColor,
}: {
  msg: OutgoingMessage;
  hostBg: string;
  hostColor: string;
}) {
  if (msg.type === 'text') {
    // Handle synthetic protocol messages from the engine
    if (msg.content.startsWith('__redirect__:')) {
      const url = msg.content.slice('__redirect__:'.length);
      return (
        <div className="flex items-center gap-2 text-[12px] text-[var(--gray-9)] italic px-1">
          <LuChevronRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span>Redirect to <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#f76808]">{url}</a></span>
        </div>
      );
    }
    if (msg.content.startsWith('__wait__:')) {
      return null; // silent wait block
    }

    return (
      <div
        className="max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-[13px] leading-relaxed shadow-sm"
        style={{ backgroundColor: hostBg, color: hostColor }}
      >
        {msg.content}
      </div>
    );
  }

  if (msg.type === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={msg.url}
        alt={msg.alt ?? ''}
        className="max-w-[240px] rounded-2xl rounded-tl-sm shadow-sm object-cover"
      />
    );
  }

  if (msg.type === 'video') {
    return (
      <video
        src={msg.url}
        controls
        className="max-w-[240px] rounded-2xl rounded-tl-sm shadow-sm"
      />
    );
  }

  if (msg.type === 'audio') {
    return (
      <audio src={msg.url} controls className="max-w-[240px]" />
    );
  }

  if (msg.type === 'embed') {
    return (
      <iframe
        src={msg.url}
        title="Embedded content"
        className="max-w-[280px] h-[180px] rounded-2xl border-none shadow-sm"
      />
    );
  }

  return null;
}

function UserBubble({
  text,
  guestBg,
  guestColor,
}: {
  text: string;
  guestBg: string;
  guestColor: string;
}) {
  return (
    <div
      className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13px] leading-relaxed shadow-sm self-end"
      style={{ backgroundColor: guestBg, color: guestColor }}
    >
      {text}
    </div>
  );
}

/* ── Typing indicator ───────────────────────────────────── */

function TypingDots({ bg }: { bg: string }) {
  return (
    <div
      className="flex items-center gap-1 rounded-2xl rounded-tl-sm px-4 py-3 w-fit shadow-sm"
      style={{ backgroundColor: bg }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current opacity-50 animate-bounce"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}

/* ── Choice buttons ─────────────────────────────────────── */

function ChoiceButtons({
  choices,
  onChoose,
  accentColor,
}: {
  choices: NonNullable<InputRequest['choices']>;
  onChoose: (id: string) => void;
  accentColor: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-1 self-start max-w-[90%]">
      {choices.map((c) => (
        <button
          key={c.id}
          onClick={() => onChoose(c.id)}
          className="rounded-xl border px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:opacity-80"
          style={{ borderColor: accentColor, color: accentColor }}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/* ── SabFlowChat ────────────────────────────────────────── */

export function SabFlowChat({
  flowId,
  initialVariables,
  theme,
  className,
  height = '100%',
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [nextInput, setNextInput] = useState<InputRequest | undefined>();
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [textValue, setTextValue] = useState('');
  const [initError, setInitError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Theming ──────────────────────────────────────────── */
  // Coerce string | ThemeColor objects into a CSS-applicable string.
  const toCss = (v: unknown, fb: string): string => {
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object') {
      const o = v as { type?: string; value?: string };
      if (o.type === 'Color' && typeof o.value === 'string') return o.value;
    }
    return fb;
  };
  const hostBg    = toCss(theme?.chat?.hostBubble?.backgroundColor,  '#f0f0f0');
  const hostColor = toCss(theme?.chat?.hostBubble?.color,            '#161616');
  const guestBg   = toCss(theme?.chat?.guestBubble?.backgroundColor, '#f76808');
  const guestColor= toCss(theme?.chat?.guestBubble?.color,           '#ffffff');
  const inputBg   = toCss(theme?.chat?.input?.backgroundColor,       '#ffffff');
  const inputColor= toCss(theme?.chat?.input?.color,                 '#161616');
  const chatBg    = theme?.general?.background?.content       ?? 'transparent';
  const font      = theme?.general?.font                      ?? 'inherit';

  /* ── Auto-scroll ──────────────────────────────────────── */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  /* ── Apply step result ────────────────────────────────── */
  const applyStepResult = useCallback(
    (result: { messages: OutgoingMessage[]; nextInput?: InputRequest; isCompleted: boolean }) => {
      const newMsgs: ChatMessage[] = result.messages.map((m) => ({
        role: 'bot' as const,
        content: m,
      }));
      setMessages((prev) => [...prev, ...newMsgs]);
      setNextInput(result.nextInput);
      setIsCompleted(result.isCompleted);
    },
    [],
  );

  /* ── Init session ─────────────────────────────────────── */
  const initSession = useCallback(async () => {
    setMessages([]);
    setNextInput(undefined);
    setIsCompleted(false);
    setTextValue('');
    setInitError(null);
    setIsLoading(true);

    try {
      const { sessionId: sid } = await createSession(flowId, initialVariables);
      setSessionId(sid);
      const result = await executeStep(sid);
      applyStepResult(result);
    } catch (err: any) {
      setInitError(err?.message ?? 'Could not start flow.');
    } finally {
      setIsLoading(false);
    }
  }, [flowId, initialVariables, applyStepResult]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  /* ── Submit user input ────────────────────────────────── */
  const submitInput = useCallback(
    async (inputValue: string) => {
      if (!sessionId || !inputValue.trim()) return;

      setMessages((prev) => [...prev, { role: 'user', text: inputValue }]);
      setTextValue('');
      setNextInput(undefined);
      setIsLoading(true);

      try {
        const result = await executeStep(sessionId, inputValue);
        applyStepResult(result);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          { role: 'error', text: err?.message ?? 'Something went wrong.' },
        ]);
      } finally {
        setIsLoading(false);
        // Re-focus input after bot replies
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [sessionId, applyStepResult],
  );

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitInput(textValue);
  };

  const showInput = !isCompleted && !isLoading && nextInput &&
    nextInput.inputType !== 'choice_input' &&
    nextInput.inputType !== 'picture_choice_input';

  const showChoices = !isCompleted && !isLoading && nextInput &&
    (nextInput.inputType === 'choice_input' || nextInput.inputType === 'picture_choice_input');

  const inputPlaceholder = getInputPlaceholder(nextInput?.inputType);

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div
      className={cn('flex flex-col overflow-hidden', className)}
      style={{ height, backgroundColor: chatBg, fontFamily: font }}
    >
      {/* Error banner */}
      {initError && (
        <div className="mx-3 mt-3 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12.5px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
          <span className="flex-1">{initError}</span>
          <button
            onClick={initSession}
            className="flex items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-[11.5px] font-medium hover:bg-red-100 transition-colors dark:border-red-800 dark:hover:bg-red-900/40"
          >
            <LuRotateCcw className="h-3 w-3" strokeWidth={2} /> Retry
          </button>
        </div>
      )}

      {/* Message stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2.5"
      >
        {messages.map((msg, i) => {
          if (msg.role === 'bot') {
            return (
              <div key={i} className="flex justify-start">
                <BotBubble msg={msg.content} hostBg={hostBg} hostColor={hostColor} />
              </div>
            );
          }
          if (msg.role === 'user') {
            return (
              <div key={i} className="flex justify-end">
                <UserBubble text={msg.text} guestBg={guestBg} guestColor={guestColor} />
              </div>
            );
          }
          // error
          return (
            <div key={i} className="text-center text-[11.5px] text-red-500 italic px-2">
              {msg.text}
            </div>
          );
        })}

        {/* Typing indicator */}
        {isLoading && <div className="flex justify-start"><TypingDots bg={hostBg} /></div>}

        {/* Choice buttons */}
        {showChoices && nextInput?.choices && (
          <ChoiceButtons
            choices={nextInput.choices}
            onChoose={submitInput}
            accentColor={guestBg}
          />
        )}

        {/* Completed state */}
        {isCompleted && !isLoading && (
          <div className="flex flex-col items-center gap-2.5 py-6 text-center">
            <span className="text-[12.5px] text-[var(--gray-9)]">Flow completed</span>
            <button
              onClick={initSession}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--gray-5)] px-3 py-1.5 text-[12px] font-medium text-[var(--gray-11)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
            >
              <LuRotateCcw className="h-3.5 w-3.5" strokeWidth={2} /> Restart
            </button>
          </div>
        )}
      </div>

      {/* Text input bar */}
      {showInput && (
        <form
          onSubmit={handleFormSubmit}
          className="shrink-0 flex items-center gap-2 border-t border-[var(--gray-5)] px-3 py-2.5"
          style={{ backgroundColor: inputBg }}
        >
          <input
            ref={inputRef}
            type={getInputType(nextInput?.inputType)}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder={inputPlaceholder}
            autoFocus
            className="flex-1 min-w-0 bg-transparent text-[13px] outline-none placeholder:text-[var(--gray-8)]"
            style={{ color: inputColor }}
          />
          <button
            type="submit"
            disabled={!textValue.trim()}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors',
              textValue.trim()
                ? 'bg-[#f76808] text-white hover:bg-[#e25c00]'
                : 'bg-[var(--gray-4)] text-[var(--gray-8)] cursor-not-allowed',
            )}
          >
            <LuSend className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </form>
      )}

      {/* Idle state while loading and no messages yet */}
      {isLoading && messages.length === 0 && !initError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <LuLoader className="h-5 w-5 animate-spin text-[var(--gray-8)]" strokeWidth={2} />
        </div>
      )}
    </div>
  );
}

/* ── Input type helpers ─────────────────────────────────── */

function getInputType(inputType?: string): string {
  switch (inputType) {
    case 'email_input': return 'email';
    case 'number_input': return 'number';
    case 'url_input': return 'url';
    case 'phone_input': return 'tel';
    case 'date_input': return 'date';
    case 'time_input': return 'time';
    default: return 'text';
  }
}

function getInputPlaceholder(inputType?: string): string {
  switch (inputType) {
    case 'email_input': return 'Your email address…';
    case 'number_input': return 'Enter a number…';
    case 'url_input': return 'https://…';
    case 'phone_input': return 'Your phone number…';
    case 'date_input': return 'Select a date…';
    case 'time_input': return 'Select a time…';
    case 'rating_input': return 'Your rating (1–10)…';
    case 'file_input': return 'File URL…';
    default: return 'Type your answer…';
  }
}

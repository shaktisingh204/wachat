'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
  type ChangeEvent,
} from 'react';
import {
  Send,
  RotateCcw,
  Star,
  Upload,
  CreditCard,
  Zap,
} from 'lucide-react';

import { Button, IconButton, Field, Input, Alert } from '@/components/sabcrm/20ui';

import type { SabFlowDoc } from '@/lib/sabflow/types';
import type { FlowSession, ExecutionStep } from '@/lib/sabflow/execution/types';
import { startSession, processInput } from '@/lib/sabflow/execution/engine';
import { TypingIndicator } from './TypingIndicator';
import { ChatBubble } from './ChatBubble';

/* ── Serialisable SabFlowDoc (ObjectIds serialised to strings) ──────────── */

type SerialisedFlow = Omit<SabFlowDoc, '_id'> & { _id: string };

/* ── Message shapes rendered in the UI ─────────────────────────────────── */

type UiMessage =
  | { kind: 'text';    role: 'bot' | 'user'; text: string }
  | { kind: 'image';   url: string; alt?: string }
  | { kind: 'video';   url: string }
  | { kind: 'audio';   url: string }
  | { kind: 'embed';   url: string }
  | { kind: 'error';   text: string }
  | { kind: 'redirect'; url: string };

/* ── Pending input descriptor ─────────────────────────────────────────── */

type PendingInput =
  | { type: 'text_input' | 'email_input' | 'phone_input' | 'url_input' | 'number_input' | 'date_input' | 'time_input' }
  | { type: 'rating_input'; length: number }
  | { type: 'file_input' }
  | { type: 'payment_input' }
  | { type: 'choice_input' | 'picture_choice_input'; choices: { id: string; label: string; imageUrl?: string }[] };

/* ── helpers ────────────────────────────────────────────────────────────── */

function htmlInputType(inputType: PendingInput['type']): React.HTMLInputTypeAttribute {
  switch (inputType) {
    case 'email_input':  return 'email';
    case 'number_input': return 'number';
    case 'url_input':    return 'url';
    case 'phone_input':  return 'tel';
    case 'date_input':   return 'date';
    case 'time_input':   return 'time';
    default:             return 'text';
  }
}

function inputPlaceholder(inputType: PendingInput['type']): string {
  switch (inputType) {
    case 'email_input':  return 'Your email address...';
    case 'number_input': return 'Enter a number...';
    case 'url_input':    return 'https://...';
    case 'phone_input':  return 'Your phone number...';
    case 'date_input':   return 'Select a date...';
    case 'time_input':   return 'Select a time...';
    case 'rating_input': return 'Your rating...';
    case 'file_input':   return 'File upload...';
    default:             return 'Type your answer...';
  }
}

/** Convert ExecutionStep[] emitted by the engine into UiMessage[]. */
function stepsToUiMessages(steps: ExecutionStep[]): UiMessage[] {
  return steps
    .filter((s) => s.type === 'message' || s.type === 'redirect')
    .map((s): UiMessage | null => {
      if (s.type === 'redirect') {
        const url = s.payload.url as string | undefined;
        return url ? { kind: 'redirect', url } : null;
      }
      // s.type === 'message'
      const msgType = s.payload.messageType as string | undefined;
      const content = s.payload.content as string | undefined ?? '';

      if (msgType === 'text')  return { kind: 'text', role: 'bot', text: content };
      if (msgType === 'image') return { kind: 'image', url: content };
      if (msgType === 'video') return { kind: 'video', url: content };
      if (msgType === 'audio') return { kind: 'audio', url: content };
      if (msgType === 'embed') return { kind: 'embed', url: content };

      return { kind: 'text', role: 'bot', text: content };
    })
    .filter((m): m is UiMessage => m !== null);
}

/** Extract the pending input request from steps (if any). */
function stepsToNextInput(steps: ExecutionStep[]): PendingInput | undefined {
  const step = steps.find((s) => s.type === 'input');
  if (!step) return undefined;

  const inputType = step.payload.inputType as string;
  const rawChoices = step.payload.choices as Array<{ id: string; label: string; imageUrl?: string }> | undefined;

  if (inputType === 'rating_input') {
    const len = (step.payload.validation as { length?: number } | undefined)?.length ?? 5;
    return { type: 'rating_input', length: len };
  }
  if (inputType === 'choice_input' || inputType === 'picture_choice_input') {
    return {
      type: inputType as 'choice_input' | 'picture_choice_input',
      choices: rawChoices ?? [],
    };
  }
  if (inputType === 'file_input') return { type: 'file_input' };
  if (inputType === 'payment_input') return { type: 'payment_input' };

  return { type: inputType as PendingInput['type'] } as unknown as PendingInput;
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function StarRating({
  length,
  onRate,
  accentColor,
}: {
  length: number;
  onRate: (value: string) => void;
  accentColor: string;
}) {
  const [hovered, setHovered] = useState<number>(0);
  const [selected, setSelected] = useState<number>(0);

  const handleClick = (i: number) => {
    setSelected(i);
    onRate(String(i));
  };

  return (
    <div className="flex items-center gap-1.5 py-1 self-start">
      {Array.from({ length }, (_, idx) => idx + 1).map((i) => {
        const active = i <= (hovered || selected);
        return (
          <IconButton
            key={i}
            label={`Rate ${i} out of ${length}`}
            icon={Star}
            variant="ghost"
            onClick={() => handleClick(i)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(0)}
            className="transition-transform hover:scale-110"
            style={{ color: active ? accentColor : 'var(--st-text-tertiary)' }}
          />
        );
      })}
    </div>
  );
}

function ChoiceButtonList({
  choices,
  onChoose,
  accentColor,
}: {
  choices: { id: string; label: string }[];
  onChoose: (label: string) => void;
  accentColor: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 self-start max-w-[90%] py-1">
      {choices.map((c) => (
        <Button
          key={c.id}
          variant="outline"
          size="sm"
          onClick={() => onChoose(c.label)}
          style={{ borderColor: accentColor, color: accentColor }}
        >
          {c.label}
        </Button>
      ))}
    </div>
  );
}

/* ── Main ChatWindow component ──────────────────────────────────────────── */

interface ChatWindowProps {
  flow: SerialisedFlow;
}

/** Coerce a `ThemeColor` (or legacy plain string) into a CSS-applicable string. */
function toCssColor(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const v = value as { type?: string; value?: string; id?: string };
    if (v.type === 'Color' && typeof v.value === 'string') return v.value;
    // 'Variable' references resolve at runtime; until then, render the fallback.
  }
  return fallback;
}

export function ChatWindow({ flow }: ChatWindowProps) {
  /* ── theme ──────────────────────────────────────────────── */
  const theme = flow.theme;
  const containerBg     = toCssColor(theme?.chat?.container?.backgroundColor,  'var(--st-bg)');
  const headerBg        = toCssColor(theme?.chat?.header?.backgroundColor,     'var(--st-bg-secondary)');
  const headerColor     = toCssColor(theme?.chat?.header?.color,               'var(--st-text)');
  const hostBubbleBg    = toCssColor(theme?.chat?.hostBubble?.backgroundColor, 'var(--st-bg-secondary)');
  const hostBubbleColor = toCssColor(theme?.chat?.hostBubble?.color,           'var(--st-text)');
  const guestBubbleBg   = toCssColor(theme?.chat?.guestBubble?.backgroundColor,'var(--st-accent)');
  const guestBubbleColor= toCssColor(theme?.chat?.guestBubble?.color,          'var(--st-text-inverted)');
  const inputBg         = toCssColor(theme?.chat?.input?.backgroundColor,      'var(--st-bg)');
  const inputColor      = toCssColor(theme?.chat?.input?.color,                'var(--st-text)');
  const buttonBg        = toCssColor(theme?.chat?.button?.backgroundColor,     'var(--st-accent)');
  const buttonColor     = toCssColor(theme?.chat?.button?.color,               'var(--st-text-inverted)');
  const pageBg          = theme?.general?.background?.type === 'Color'
    ? (theme.general.background.content ?? 'var(--st-bg-secondary)')
    : 'var(--st-bg-secondary)';
  const fontFamily      = theme?.general?.font                     ?? 'inherit';

  /* ── state ──────────────────────────────────────────────── */
  const [messages,    setMessages]    = useState<UiMessage[]>([]);
  const [session,     setSession]     = useState<FlowSession | null>(null);
  const [nextInput,   setNextInput]   = useState<PendingInput | undefined>();
  const [isCompleted, setIsCompleted] = useState(false);
  const [isTyping,    setIsTyping]    = useState(false);
  const [textValue,   setTextValue]   = useState('');
  const [error,       setError]       = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  /* ── auto-scroll ────────────────────────────────────────── */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isTyping]);

  /* ── init (start session + run initial steps) ───────────── */
  const initFlow = useCallback(async () => {
    setMessages([]);
    setNextInput(undefined);
    setIsCompleted(false);
    setTextValue('');
    setError(null);
    setIsTyping(true);

    // startSession is synchronous / pure
    const newSession = startSession(flow as unknown as SabFlowDoc);
    setSession(newSession);

    // Kick the engine with an empty input to run bubble blocks up to the
    // first input request (same pattern as processInput with empty string).
    const { session: advanced, nextSteps } = await processInput(
      newSession,
      flow as unknown as SabFlowDoc,
      '',
    );

    // Simulate typing delay proportional to number of messages
    const delay = Math.min(600 + nextSteps.filter((s) => s.type === 'message').length * 200, 1800);

    setTimeout(() => {
      setSession(advanced);
      setMessages(stepsToUiMessages(nextSteps));
      setNextInput(stepsToNextInput(nextSteps));
      setIsCompleted(advanced.status === 'completed');
      setIsTyping(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }, delay);
  }, [flow]);

  useEffect(() => {
    initFlow();
    // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── submit user answer ─────────────────────────────────── */
  const submitAnswer = useCallback(
    async (answer: string) => {
      if (!session || !answer.trim() || isTyping) return;

      // Append user bubble immediately
      setMessages((prev) => [...prev, { kind: 'text', role: 'user', text: answer }]);
      setTextValue('');
      setNextInput(undefined);
      setIsTyping(true);

      try {
        const { session: advanced, nextSteps } = await processInput(
          session,
          flow as unknown as SabFlowDoc,
          answer,
        );

        const botMessages = stepsToUiMessages(nextSteps);
        const delay = Math.min(400 + botMessages.length * 250, 1600);

        setTimeout(() => {
          setSession(advanced);
          setMessages((prev) => [...prev, ...botMessages]);
          setNextInput(stepsToNextInput(nextSteps));
          setIsCompleted(advanced.status === 'completed');
          setIsTyping(false);
          requestAnimationFrame(() => inputRef.current?.focus());
        }, delay);

        // Handle redirect steps
        const redirectStep = nextSteps.find((s) => s.type === 'redirect');
        if (redirectStep) {
          const url = redirectStep.payload.url as string | undefined;
          if (url) {
            setTimeout(() => {
              window.location.href = url;
            }, 1200);
          }
        }
      } catch (err) {
        setIsTyping(false);
        const msg = err instanceof Error ? err.message : 'Something went wrong.';
        setError(msg);
      }
    },
    [session, isTyping, flow],
  );

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void submitAnswer(textValue);
  };

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTextValue(e.target.value);
  };

  /* ── derived flags ──────────────────────────────────────── */
  const isChoiceInput =
    !isCompleted &&
    !isTyping &&
    nextInput !== undefined &&
    (nextInput.type === 'choice_input' || nextInput.type === 'picture_choice_input');

  const isRatingInput =
    !isCompleted &&
    !isTyping &&
    nextInput !== undefined &&
    nextInput.type === 'rating_input';

  const isFileInput =
    !isCompleted &&
    !isTyping &&
    nextInput !== undefined &&
    nextInput.type === 'file_input';

  const isPaymentInput =
    !isCompleted &&
    !isTyping &&
    nextInput !== undefined &&
    nextInput.type === 'payment_input';

  const showTextInput =
    !isCompleted &&
    !isTyping &&
    nextInput !== undefined &&
    !isChoiceInput &&
    !isRatingInput &&
    !isFileInput &&
    !isPaymentInput;

  /* ── render ─────────────────────────────────────────────── */
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: pageBg, fontFamily }}
    >
      <div
        className="w-full flex flex-col overflow-hidden shadow-2xl rounded-[var(--st-radius)]"
        style={{
          backgroundColor: containerBg,
          maxWidth:  theme?.chat?.container?.maxWidth  ?? '640px',
          maxHeight: theme?.chat?.container?.maxHeight ?? '700px',
          height: '100dvh',
        }}
      >
        {/* ── Header ────────────────────────────────────────── */}
        {theme?.chat?.header?.isEnabled !== false && (
          <div
            className="shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-[var(--st-border)]"
            style={{ backgroundColor: headerBg }}
          >
            {/* Avatar circle */}
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
              style={{ backgroundColor: buttonBg, color: buttonColor }}
            >
              <Zap className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            </div>
            <div>
              <p
                className="text-[14px] font-semibold leading-tight"
                style={{ color: headerColor }}
              >
                {flow.name}
              </p>
              <p className="text-[11.5px] opacity-60" style={{ color: headerColor }}>
                Automated assistant
              </p>
            </div>
          </div>
        )}

        {/* ── Message stream ────────────────────────────────── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2.5 scroll-smooth"
          style={{ backgroundColor: containerBg }}
        >
          {messages.map((msg, i) => {
            if (msg.kind === 'text' && msg.role === 'user') {
              return (
                <ChatBubble
                  key={i}
                  variant="user"
                  backgroundColor={guestBubbleBg}
                  color={guestBubbleColor}
                >
                  {msg.text}
                </ChatBubble>
              );
            }

            if (msg.kind === 'text' && msg.role === 'bot') {
              return (
                <ChatBubble
                  key={i}
                  variant="bot"
                  backgroundColor={hostBubbleBg}
                  color={hostBubbleColor}
                >
                  {msg.text}
                </ChatBubble>
              );
            }

            if (msg.kind === 'image') {
              return (
                <div key={i} className="flex justify-start">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={msg.url}
                    alt={msg.alt ?? 'Image'}
                    className="max-w-[260px] rounded-2xl rounded-tl-sm shadow-sm object-cover"
                  />
                </div>
              );
            }

            if (msg.kind === 'video') {
              return (
                <div key={i} className="flex justify-start">
                  <video
                    src={msg.url}
                    controls
                    className="max-w-[280px] rounded-2xl rounded-tl-sm shadow-sm"
                  />
                </div>
              );
            }

            if (msg.kind === 'audio') {
              return (
                <div key={i} className="flex justify-start">
                  <audio src={msg.url} controls className="max-w-[280px]" />
                </div>
              );
            }

            if (msg.kind === 'embed') {
              return (
                <div key={i} className="flex justify-start">
                  <iframe
                    src={msg.url}
                    title="Embedded content"
                    className="w-[280px] h-[180px] rounded-2xl border-none shadow-sm"
                  />
                </div>
              );
            }

            if (msg.kind === 'redirect') {
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 text-[12px] italic self-start text-[var(--st-text-tertiary)]"
                >
                  <span>Redirecting to</span>
                  <a
                    href={msg.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                    style={{ color: buttonBg }}
                  >
                    {msg.url}
                  </a>
                </div>
              );
            }

            if (msg.kind === 'error') {
              return (
                <div
                  key={i}
                  className="text-center text-[12px] italic px-2 py-1 text-[var(--st-text)]"
                >
                  {msg.text}
                </div>
              );
            }

            return null;
          })}

          {/* Typing indicator */}
          {isTyping && (
            <TypingIndicator backgroundColor={hostBubbleBg} />
          )}

          {/* Choice buttons */}
          {isChoiceInput && nextInput !== undefined && (nextInput.type === 'choice_input' || nextInput.type === 'picture_choice_input') && (
            <ChoiceButtonList
              choices={nextInput.choices}
              onChoose={submitAnswer}
              accentColor={guestBubbleBg}
            />
          )}

          {/* Star rating */}
          {isRatingInput && nextInput !== undefined && nextInput.type === 'rating_input' && (
            <StarRating
              length={nextInput.length}
              onRate={submitAnswer}
              accentColor={guestBubbleBg}
            />
          )}

          {/* File upload placeholder */}
          {isFileInput && (
            <div className="flex justify-start py-1">
              <Button
                variant="outline"
                size="md"
                iconLeft={Upload}
                onClick={() => submitAnswer('file_uploaded')}
                style={{ borderColor: buttonBg, color: buttonBg }}
              >
                Upload file
              </Button>
            </div>
          )}

          {/* Payment placeholder */}
          {isPaymentInput && (
            <div className="flex justify-start py-1">
              <Button
                variant="primary"
                size="md"
                iconLeft={CreditCard}
                onClick={() => submitAnswer('payment_completed')}
                style={{ backgroundColor: buttonBg, color: buttonColor }}
              >
                Complete payment
              </Button>
            </div>
          )}

          {/* Completed state */}
          {isCompleted && !isTyping && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: hostBubbleBg }}
              >
                <Zap className="h-5 w-5" style={{ color: buttonBg }} strokeWidth={2.5} aria-hidden="true" />
              </div>
              <p className="text-[13px] text-[var(--st-text-tertiary)]">
                Flow completed
              </p>
              <Button
                variant="outline"
                size="sm"
                iconLeft={RotateCcw}
                onClick={initFlow}
              >
                Restart
              </Button>
            </div>
          )}
        </div>

        {/* ── Error banner ──────────────────────────────────── */}
        {error && (
          <div className="shrink-0 px-3 py-2 border-t border-[var(--st-border)]">
            <Alert tone="danger" onClose={() => setError(null)}>
              {error}
            </Alert>
          </div>
        )}

        {/* ── Text input bar ────────────────────────────────── */}
        {showTextInput && nextInput !== undefined && (
          <form
            onSubmit={handleFormSubmit}
            className="shrink-0 flex items-end gap-2.5 border-t border-[var(--st-border)] px-3 py-2.5"
            style={{ backgroundColor: inputBg }}
          >
            <Field className="flex-1 min-w-0" label="Your answer">
              <Input
                ref={inputRef}
                type={htmlInputType(nextInput.type)}
                value={textValue}
                onChange={handleTextChange}
                placeholder={inputPlaceholder(nextInput.type)}
                autoFocus
                autoComplete="off"
                style={{ color: inputColor }}
              />
            </Field>
            <IconButton
              type="submit"
              label="Send"
              icon={Send}
              variant="primary"
              disabled={!textValue.trim()}
              className="shrink-0"
              style={
                textValue.trim()
                  ? { backgroundColor: buttonBg, color: buttonColor }
                  : undefined
              }
            />
          </form>
        )}

        {/* ── Powered-by footer ─────────────────────────────── */}
        <div
          className="shrink-0 flex items-center justify-center gap-1 py-2 text-[11px] text-[var(--st-text-tertiary)]"
          style={{ backgroundColor: containerBg }}
        >
          <Zap className="h-3 w-3" strokeWidth={2.5} style={{ color: buttonBg }} aria-hidden="true" />
          <span>
            Powered by{' '}
            <span className="font-semibold" style={{ color: buttonBg }}>
              SabFlow
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

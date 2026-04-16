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
  LuSend,
  LuRotateCcw,
  LuStar,
  LuUpload,
  LuZap,
  LuLoader,
  LuTriangleAlert,
  LuFileText,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';

import type {
  SabFlowDoc,
  PaymentInputOptions,
  TextInputOptions,
  NumberInputOptions,
  PhoneInputOptions,
  UrlInputOptions,
  DateInputOptions,
  TimeInputOptions,
} from '@/lib/sabflow/types';
import type { FlowSession, ExecutionStep } from '@/lib/sabflow/execution/types';
import { startSession, processInput } from '@/lib/sabflow/execution/engine';
import {
  validateEmail,
  validatePhone,
  validateUrl,
  validateNumber,
  validateText,
  validateDate,
  validateTime,
  type ValidationResult,
} from '@/lib/sabflow/inputs/validation';
import { TypingIndicator } from './TypingIndicator';
import { PaymentBlock } from './blocks/PaymentBlock';
import { TextBubble } from './blocks/TextBubble';
import { ImageBubble } from './blocks/ImageBubble';
import { VideoBubble } from './blocks/VideoBubble';
import { AudioBubble } from './blocks/AudioBubble';
import { EmbedBubble } from './blocks/EmbedBubble';
import { InputFieldError } from './blocks/InputFieldError';
import { EmbedListener, postEmbedEvent } from './EmbedListener';

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

type TextishInputType =
  | 'text_input'
  | 'email_input'
  | 'phone_input'
  | 'url_input'
  | 'number_input'
  | 'date_input'
  | 'time_input';

type TextishInputOptions =
  | TextInputOptions
  | NumberInputOptions
  | PhoneInputOptions
  | UrlInputOptions
  | DateInputOptions
  | TimeInputOptions
  | undefined;

type PendingInput =
  | { type: TextishInputType; options?: TextishInputOptions }
  | { type: 'rating_input'; length: number }
  | { type: 'file_input' }
  | { type: 'payment_input'; options: PaymentInputOptions }
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
    case 'email_input':  return 'Your email address…';
    case 'number_input': return 'Enter a number…';
    case 'url_input':    return 'https://…';
    case 'phone_input':  return 'Your phone number…';
    case 'date_input':   return 'Select a date…';
    case 'time_input':   return 'Select a time…';
    case 'rating_input': return 'Your rating…';
    case 'file_input':   return 'File upload…';
    default:             return 'Type your answer…';
  }
}

/** Substitute `{{varName}}` tokens against the session's variable map. */
function substituteTokens(
  text: string,
  variables: Record<string, string | undefined>,
): string {
  if (!text) return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (match, name: string) => {
    const trimmed = name.trim();
    const value = variables[trimmed];
    return typeof value === 'string' ? value : match;
  });
}

/** Resolve the payment amount, substituting any {{variable}} tokens. */
function resolvePaymentAmount(
  options: PaymentInputOptions,
  variables: Record<string, string | undefined>,
): string {
  return substituteTokens(options.amount ?? '', variables).trim();
}

/** Resolve the payment button label, with {{amount}} pre-substituted. */
function resolvePaymentButtonLabel(
  options: PaymentInputOptions,
  variables: Record<string, string | undefined>,
): string {
  const currency = options.currency ?? 'USD';
  const amount = resolvePaymentAmount(options, variables);
  const displayAmount = amount ? `${amount} ${currency}` : currency;
  const template = options.labels?.button ?? 'Pay {{amount}}';
  const merged = { ...variables, amount: displayAmount };
  return substituteTokens(template, merged);
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
  if (inputType === 'payment_input') {
    const options = (step.payload.options ?? {}) as PaymentInputOptions;
    return { type: 'payment_input', options };
  }

  const textishOptions = step.payload.options as TextishInputOptions;
  return {
    type: inputType as TextishInputType,
    options: textishOptions,
  };
}

/**
 * Runs the correct validator for a pending input and returns a
 * discriminated result.  Phone validation is async (libphonenumber-js
 * loaded on demand) so the function itself returns a Promise.
 */
async function validatePendingInput(
  pending: PendingInput,
  value: string,
): Promise<ValidationResult> {
  switch (pending.type) {
    case 'email_input':
      return validateEmail(value);
    case 'phone_input': {
      const opts = pending.options as PhoneInputOptions | undefined;
      return validatePhone(value, { country: opts?.country ?? opts?.defaultCountryCode });
    }
    case 'url_input': {
      const opts = pending.options as UrlInputOptions | undefined;
      return validateUrl(value, { requireHttps: opts?.requireHttps });
    }
    case 'number_input': {
      const opts = pending.options as NumberInputOptions | undefined;
      const toNum = (v: number | string | undefined): number | undefined => {
        if (v === undefined || v === '') return undefined;
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : undefined;
      };
      return validateNumber(value, {
        min: toNum(opts?.min),
        max: toNum(opts?.max),
        step: toNum(opts?.step),
        integer: opts?.integer,
      });
    }
    case 'text_input': {
      const opts = pending.options as TextInputOptions | undefined;
      return validateText(value, {
        minLength: opts?.minLength,
        maxLength: opts?.maxLength,
        pattern: opts?.pattern,
        patternMessage: opts?.patternMessage,
      });
    }
    case 'date_input': {
      const opts = pending.options as DateInputOptions | undefined;
      return validateDate(value, {
        min: opts?.minDate,
        max: opts?.maxDate,
        format: opts?.hasTime ? 'datetime' : 'date',
      });
    }
    case 'time_input': {
      const opts = pending.options as TimeInputOptions | undefined;
      return validateTime(value, {
        min: opts?.minTime,
        max: opts?.maxTime,
      });
    }
    default:
      return { valid: true };
  }
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
      {Array.from({ length }, (_, idx) => idx + 1).map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => handleClick(i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          aria-label={`Rate ${i} out of ${length}`}
          className="transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{ color: i <= (hovered || selected) ? accentColor : 'var(--gray-6)' }}
        >
          <LuStar
            className="h-7 w-7"
            strokeWidth={1.5}
            fill={i <= (hovered || selected) ? 'currentColor' : 'none'}
          />
        </button>
      ))}
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
        <button
          key={c.id}
          type="button"
          onClick={() => onChoose(c.label)}
          className="rounded-xl border px-3.5 py-1.5 text-[13px] font-medium transition-all hover:opacity-80 active:scale-95 focus:outline-none focus-visible:ring-2"
          style={{ borderColor: accentColor, color: accentColor }}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/* ── File upload input (for file_input blocks) ─────────────────────────── */

function FileUploadBlock({
  flowId,
  sessionId,
  accentColor,
  onUploaded,
}: {
  flowId: string;
  sessionId: string;
  accentColor: string;
  onUploaded: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFilename, setLastFilename] = useState<string | null>(null);

  const upload = useCallback(
    (file: File) => {
      setError(null);
      setProgress(0);

      const fd = new FormData();
      fd.append('file', file);
      fd.append('flowId', flowId);
      fd.append('sessionId', sessionId);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/sabflow/upload');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        setProgress(null);
        let parsed:
          | { url: string; filename: string }
          | { error?: string }
          | null = null;
        try {
          parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          parsed = null;
        }
        if (
          xhr.status >= 200 &&
          xhr.status < 300 &&
          parsed &&
          'url' in parsed
        ) {
          setLastFilename(parsed.filename);
          onUploaded(parsed.url);
        } else {
          const msg =
            (parsed && 'error' in parsed && parsed.error) ||
            `Upload failed (${xhr.status})`;
          setError(msg);
        }
      };

      xhr.onerror = () => {
        setProgress(null);
        setError('Network error — please try again.');
      };

      xhr.send(fd);
    },
    [flowId, sessionId, onUploaded],
  );

  const uploading = progress !== null;

  return (
    <div className="flex flex-col items-start gap-1.5 py-1 max-w-[90%]">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = '';
        }}
      />

      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-2.5 rounded-xl border-2 border-dashed px-5 py-3 text-[13px] font-medium transition-colors hover:opacity-80 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ borderColor: accentColor, color: accentColor }}
      >
        {uploading ? (
          <>
            <LuLoader className="h-4 w-4 animate-spin" strokeWidth={2} />
            Uploading… {progress ?? 0}%
          </>
        ) : (
          <>
            <LuUpload className="h-4 w-4" strokeWidth={2} />
            Upload file
          </>
        )}
      </button>

      {uploading && (
        <div className="h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full transition-[width] duration-200"
            style={{ width: `${progress ?? 0}%`, backgroundColor: accentColor }}
          />
        </div>
      )}

      {lastFilename && !uploading && !error && (
        <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--gray-9)]">
          <LuFileText className="h-3 w-3" strokeWidth={1.8} />
          <span className="truncate max-w-[220px]">{lastFilename}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-1.5 text-[11.5px] text-red-500">
          <LuTriangleAlert className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.8} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

/* ── Main ChatWindow component ──────────────────────────────────────────── */

interface ChatWindowProps {
  flow: SerialisedFlow;
}

export function ChatWindow({ flow }: ChatWindowProps) {
  /* ── theme ──────────────────────────────────────────────── */
  const theme = flow.theme;
  const containerBg     = theme?.chat?.container?.backgroundColor  ?? 'var(--gray-1)';
  const headerBg        = theme?.chat?.header?.backgroundColor     ?? 'var(--gray-2)';
  const headerColor     = theme?.chat?.header?.color               ?? 'var(--gray-12)';
  const hostBubbleBg    = theme?.chat?.hostBubble?.backgroundColor ?? 'var(--gray-3)';
  const hostBubbleColor = theme?.chat?.hostBubble?.color           ?? 'var(--gray-12)';
  const guestBubbleBg   = theme?.chat?.guestBubble?.backgroundColor ?? 'var(--orange-8)';
  const guestBubbleColor= theme?.chat?.guestBubble?.color           ?? '#ffffff';
  const inputBg         = theme?.chat?.input?.backgroundColor      ?? 'var(--gray-1)';
  const inputColor      = theme?.chat?.input?.color                ?? 'var(--gray-12)';
  const buttonBg        = theme?.chat?.button?.backgroundColor     ?? 'var(--orange-8)';
  const buttonColor     = theme?.chat?.button?.color               ?? '#ffffff';
  const pageBg          = theme?.general?.background?.type === 'Color'
    ? (theme.general.background.content ?? 'var(--gray-2)')
    : 'var(--gray-2)';
  const fontFamily      = theme?.general?.font                     ?? 'inherit';

  /* ── state ──────────────────────────────────────────────── */
  const [messages,    setMessages]    = useState<UiMessage[]>([]);
  const [session,     setSession]     = useState<FlowSession | null>(null);
  const [nextInput,   setNextInput]   = useState<PendingInput | undefined>();
  const [isCompleted, setIsCompleted] = useState(false);
  const [isTyping,    setIsTyping]    = useState(false);
  const [textValue,   setTextValue]   = useState('');
  const [error,       setError]       = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  // Incremented by async validations so stale resolutions can be discarded
  // if the user has moved on (different input or different value).
  const validationTokenRef = useRef(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  /* ── auto-scroll ────────────────────────────────────────── */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isTyping]);

  /* ── embed: emit 'completed' to parent frame ─────────────── */
  useEffect(() => {
    if (isCompleted) {
      postEmbedEvent('completed', {
        sessionId: session?.id,
        variables: session?.variables,
      });
    }
  }, [isCompleted, session]);

  /* ── embed: parent → session variable prefill ────────────── */
  const handleEmbedSetVariable = useCallback((name: string, value: unknown) => {
    const stringValue =
      value === null || value === undefined
        ? undefined
        : typeof value === 'string'
          ? value
          : typeof value === 'number' || typeof value === 'boolean'
            ? String(value)
            : (() => {
                try { return JSON.stringify(value); }
                catch { return undefined; }
              })();

    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        variables: { ...prev.variables, [name]: stringValue },
        updatedAt: new Date(),
      };
    });
  }, []);

  /* ── init (start session + run initial steps) ───────────── */
  const initFlow = useCallback(() => {
    setMessages([]);
    setNextInput(undefined);
    setIsCompleted(false);
    setTextValue('');
    setError(null);
    setValidationError(null);
    setIsTyping(true);

    // startSession is synchronous / pure
    const newSession = startSession(flow as unknown as SabFlowDoc);
    setSession(newSession);

    // Kick the engine with an empty input to run bubble blocks up to the
    // first input request (same pattern as processInput with empty string).
    const { session: advanced, nextSteps } = processInput(
      newSession,
      flow as unknown as SabFlowDoc,
      '',
    );

    // Simulate typing delay proportional to number of messages
    const delay = Math.min(600 + nextSteps.filter((s) => s.type === 'message').length * 200, 1800);

    setTimeout(() => {
      setSession(advanced);
      const uiMsgs = stepsToUiMessages(nextSteps);
      setMessages(uiMsgs);
      for (const m of uiMsgs) {
        if (m.kind === 'text') {
          postEmbedEvent('message', { role: 'bot', text: m.text, kind: 'text' });
        } else {
          postEmbedEvent('message', { role: 'bot', kind: m.kind });
        }
      }
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
    async (answer: string, options?: { skipValidation?: boolean }) => {
      if (!session || !answer.trim() || isTyping) return;

      // Run validation for text-ish inputs.  Non-text inputs (choice,
      // rating, file, payment) skip validation because they are rendered
      // as structured widgets and the runtime enforces their shape.
      if (!options?.skipValidation && nextInput) {
        const needsValidation =
          nextInput.type === 'text_input' ||
          nextInput.type === 'email_input' ||
          nextInput.type === 'phone_input' ||
          nextInput.type === 'url_input' ||
          nextInput.type === 'number_input' ||
          nextInput.type === 'date_input' ||
          nextInput.type === 'time_input';

        if (needsValidation) {
          const result = await validatePendingInput(nextInput, answer);
          if (!result.valid) {
            setValidationError(result.error);
            // Preserve the user's value so they can correct it in place.
            // Refocus so keyboard users can keep typing immediately.
            requestAnimationFrame(() => inputRef.current?.focus());
            return;
          }
        }
      }

      setValidationError(null);

      // Append user bubble immediately
      setMessages((prev) => [...prev, { kind: 'text', role: 'user', text: answer }]);
      postEmbedEvent('message', { role: 'user', text: answer, kind: 'text' });
      setTextValue('');
      setNextInput(undefined);
      setIsTyping(true);

      try {
        const { session: advanced, nextSteps } = processInput(
          session,
          flow as unknown as SabFlowDoc,
          answer,
        );

        const botMessages = stepsToUiMessages(nextSteps);
        const delay = Math.min(400 + botMessages.length * 250, 1600);

        setTimeout(() => {
          setSession(advanced);
          setMessages((prev) => [...prev, ...botMessages]);
          for (const m of botMessages) {
            if (m.kind === 'text') {
              postEmbedEvent('message', { role: 'bot', text: m.text, kind: 'text' });
            } else {
              postEmbedEvent('message', { role: 'bot', kind: m.kind });
            }
          }
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
    [session, isTyping, flow, nextInput],
  );

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Fire-and-forget — submitAnswer handles its own async state
    void submitAnswer(textValue);
  };

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTextValue(e.target.value);
    // Dismiss the error as the user edits so they are not scolded on
    // every keystroke; the error will reappear on blur/submit if still
    // invalid.
    if (validationError) setValidationError(null);
  };

  const handleTextBlur = useCallback(() => {
    if (!nextInput) return;
    if (!textValue.trim()) return; // don't scold empty-on-blur
    const token = ++validationTokenRef.current;
    void (async () => {
      const result = await validatePendingInput(nextInput, textValue);
      // Discard if a newer validation has superseded us.
      if (token !== validationTokenRef.current) return;
      setValidationError(result.valid ? null : result.error);
    })();
  }, [nextInput, textValue]);

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
      {/* Bridge to parent frame when embedded (?embed=standard|popup|bubble) */}
      <EmbedListener
        onSetVariable={handleEmbedSetVariable}
        onOpen={initFlow}
        onClose={() => postEmbedEvent('close', { mode: 'requested' })}
      />
      <div
        className="w-full flex flex-col overflow-hidden shadow-2xl"
        style={{
          backgroundColor: containerBg,
          maxWidth:  theme?.chat?.container?.maxWidth  ?? '640px',
          maxHeight: theme?.chat?.container?.maxHeight ?? '700px',
          height: '100dvh',
          borderRadius: '1rem',
        }}
      >
        {/* ── Header ────────────────────────────────────────── */}
        {theme?.chat?.header?.isEnabled !== false && (
          <div
            className="shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-black/5"
            style={{ backgroundColor: headerBg }}
          >
            {/* Avatar circle */}
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm"
              style={{ backgroundColor: buttonBg }}
            >
              <LuZap className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div>
              <p
                className="text-[14px] font-semibold leading-tight"
                style={{ color: headerColor }}
              >
                {flow.name}
              </p>
              <p className="text-[11.5px]" style={{ color: headerColor, opacity: 0.6 }}>
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
                <TextBubble
                  key={i}
                  text={msg.text}
                  variant="user"
                  variables={session?.variables}
                  backgroundColor={guestBubbleBg}
                  color={guestBubbleColor}
                  linkColor={guestBubbleColor}
                />
              );
            }

            if (msg.kind === 'text' && msg.role === 'bot') {
              return (
                <TextBubble
                  key={i}
                  text={msg.text}
                  variant="bot"
                  variables={session?.variables}
                  backgroundColor={hostBubbleBg}
                  color={hostBubbleColor}
                  linkColor={buttonBg}
                />
              );
            }

            if (msg.kind === 'image') {
              return (
                <ImageBubble
                  key={i}
                  url={msg.url}
                  alt={msg.alt}
                  backgroundColor={hostBubbleBg}
                  color={hostBubbleColor}
                />
              );
            }

            if (msg.kind === 'video') {
              return (
                <VideoBubble
                  key={i}
                  url={msg.url}
                  backgroundColor={hostBubbleBg}
                  color={hostBubbleColor}
                />
              );
            }

            if (msg.kind === 'audio') {
              return (
                <AudioBubble
                  key={i}
                  url={msg.url}
                  backgroundColor={hostBubbleBg}
                  color={hostBubbleColor}
                  accentColor={buttonBg}
                />
              );
            }

            if (msg.kind === 'embed') {
              return (
                <EmbedBubble
                  key={i}
                  url={msg.url}
                  backgroundColor={hostBubbleBg}
                  color={hostBubbleColor}
                />
              );
            }

            if (msg.kind === 'redirect') {
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 text-[12px] italic self-start"
                  style={{ color: 'var(--gray-9)' }}
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
                  className="text-center text-[12px] italic px-2 py-1"
                  style={{ color: '#ef4444' }}
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
              onChoose={(label) => { void submitAnswer(label); }}
              accentColor={guestBubbleBg}
            />
          )}

          {/* Star rating */}
          {isRatingInput && nextInput !== undefined && nextInput.type === 'rating_input' && (
            <StarRating
              length={nextInput.length}
              onRate={(value) => { void submitAnswer(value); }}
              accentColor={guestBubbleBg}
            />
          )}

          {/* File upload — uploads through /api/sabflow/upload, then submits
              the returned URL as the answer so it gets stored in the block's
              target variable. */}
          {isFileInput && session && (
            <FileUploadBlock
              flowId={flow._id}
              sessionId={session.id}
              accentColor={buttonBg}
              onUploaded={(url) => { void submitAnswer(url); }}
            />
          )}

          {/* Payment input */}
          {isPaymentInput && nextInput?.type === 'payment_input' && session && (
            <PaymentBlock
              options={nextInput.options}
              flowId={flow._id}
              sessionId={session.id}
              resolvedAmount={resolvePaymentAmount(nextInput.options, session.variables)}
              resolvedButtonLabel={resolvePaymentButtonLabel(nextInput.options, session.variables)}
              buttonBg={buttonBg}
              buttonColor={buttonColor}
              bubbleBg={hostBubbleBg}
              bubbleColor={hostBubbleColor}
              onComplete={(summary) => { void submitAnswer(summary); }}
            />
          )}

          {/* Completed state */}
          {isCompleted && !isTyping && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: hostBubbleBg }}
              >
                <LuZap className="h-5 w-5" style={{ color: buttonBg }} strokeWidth={2.5} />
              </div>
              <p className="text-[13px]" style={{ color: 'var(--gray-9)' }}>
                Flow completed
              </p>
              <button
                type="button"
                onClick={initFlow}
                className="flex items-center gap-1.5 rounded-xl border px-4 py-1.5 text-[12.5px] font-medium transition-colors hover:opacity-80"
                style={{
                  borderColor: 'var(--gray-5)',
                  color: 'var(--gray-11)',
                }}
              >
                <LuRotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                Restart
              </button>
            </div>
          )}
        </div>

        {/* ── Error banner ──────────────────────────────────── */}
        {error && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 text-[12.5px] bg-red-50 border-t border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400">
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 text-[11px] underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Text input bar ────────────────────────────────── */}
        {showTextInput && nextInput !== undefined && (
          <div
            className="shrink-0 border-t"
            style={{
              backgroundColor: inputBg,
              borderColor: 'var(--gray-5)',
            }}
          >
            {validationError && (
              <div className="px-3 pt-2">
                <InputFieldError error={validationError} />
              </div>
            )}
            <form
              onSubmit={handleFormSubmit}
              className="flex items-center gap-2.5 px-3 py-2.5"
            >
              <input
                ref={inputRef}
                type={htmlInputType(nextInput.type)}
                value={textValue}
                onChange={handleTextChange}
                onBlur={handleTextBlur}
                placeholder={inputPlaceholder(nextInput.type)}
                autoFocus
                autoComplete="off"
                aria-invalid={validationError ? true : undefined}
                aria-errormessage={validationError ? 'sabflow-input-error' : undefined}
                className={cn(
                  'flex-1 min-w-0 bg-transparent text-[13.5px] outline-none placeholder:opacity-50',
                  validationError && 'placeholder:text-red-400',
                )}
                style={{ color: inputColor }}
              />
              <button
                type="submit"
                disabled={!textValue.trim()}
                aria-label="Send"
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all',
                  textValue.trim()
                    ? 'hover:opacity-90 active:scale-95'
                    : 'opacity-30 cursor-not-allowed',
                )}
                style={{
                  backgroundColor: textValue.trim() ? buttonBg : 'var(--gray-4)',
                  color: textValue.trim() ? buttonColor : 'var(--gray-8)',
                }}
              >
                <LuSend className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </form>
          </div>
        )}

        {/* ── Powered-by footer ─────────────────────────────── */}
        <div
          className="shrink-0 flex items-center justify-center gap-1 py-2 text-[11px]"
          style={{ color: 'var(--gray-8)', backgroundColor: containerBg }}
        >
          <LuZap className="h-3 w-3" strokeWidth={2.5} style={{ color: buttonBg }} />
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

'use client';

/**
 * 20ui — Toast system.
 *
 * An imperative, queue-driven notification layer built on `@radix-ui/react-toast`
 * (so swipe-to-dismiss, pause-on-hover, duration timers, hotkey focus and the
 * announce/role wiring all come battle-tested) and skinned with 20ui tokens.
 *
 * Wire the viewport once near the app root:
 *
 *   <ToastProvider>
 *     <App />
 *     <Toaster />        // the corner viewport
 *   </ToastProvider>
 *
 * Then fire toasts from ANYWHERE — components, event handlers, async helpers,
 * server-action callbacks — with the standalone `toast()` (sonner-style, no hook
 * required):
 *
 *   import { toast } from '@/components/sabcrm/20ui';
 *   toast({ title: 'Lead saved', tone: 'success' });
 *   toast.error('Could not reach the server');
 *   toast.success('Template saved');
 *   toast({
 *     title: 'Could not reach the server',
 *     description: 'Check your connection and try again.',
 *     tone: 'danger',
 *     action: { label: 'Retry', onClick: refetch },
 *   });
 *
 * The hook still works for parity (`const { toast } = useToast()`) and returns
 * the same imperative function.
 *
 * Tones (info / success / warning / danger / neutral) each render a left tinted
 * edge + a lucide icon. Danger announces assertively (Radix `type="foreground"`,
 * role=alert); the rest are polite (role=status). Emil motion: slide + fade in
 * from the viewport edge, fade + scale out; swipe right to dismiss; reduced
 * motion collapses to a plain fade. The viewport portals to <body> under the
 * `ui20 sabcrm-twenty` class so the `--st-*` tokens resolve app-wide.
 */

import * as React from 'react';
import * as RToast from '@radix-ui/react-toast';
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Bell,
  X,
  type LucideIcon,
} from 'lucide-react';

import './toast.css';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

/** Swipe gesture direction (mirrors Radix's internal union, which is not exported). */
export type ToastSwipeDirection = 'up' | 'down' | 'left' | 'right';

/** An optional inline button rendered after the message. */
export interface ToastAction {
  /** Button label, e.g. "Retry" or "Undo". */
  label: string;
  /** Invoked on click; the toast is dismissed afterwards. */
  onClick: () => void;
}

/** The shape callers pass to `toast()`. */
export interface ToastOptions {
  /** Required, single-line headline. */
  title: React.ReactNode;
  /** Optional supporting copy under the title. */
  description?: React.ReactNode;
  /** Visual + semantic tone. Defaults to `neutral`. */
  tone?: ToastTone;
  /**
   * Back-compat alias for `tone`, accepting shadcn-style variant names. Mapped to
   * a `tone` when `tone` is not given (`destructive` -> `danger`, etc.). Prefer
   * `tone` in new code.
   */
  variant?:
    | 'default'
    | 'destructive'
    | 'success'
    | 'warning'
    | 'info'
    | 'secondary'
    | 'outline';
  /** An optional action button. */
  action?: ToastAction;
  /** Auto-dismiss delay in ms. Defaults to 5000 (8000 when an action is present). */
  duration?: number;
}

/** A live toast in the queue. */
interface ToastRecord {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  tone: ToastTone;
  action?: ToastAction;
  duration?: number;
  open: boolean;
}

const TONE_ICON: Record<ToastTone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  neutral: Bell,
};

const DEFAULT_DURATION = 5000;
const DEFAULT_DURATION_WITH_ACTION = 8000;

/** Maps legacy shadcn `variant` strings onto 20ui tones. */
const VARIANT_TO_TONE: Record<string, ToastTone> = {
  default: 'neutral',
  secondary: 'neutral',
  outline: 'neutral',
  destructive: 'danger',
  error: 'danger',
  success: 'success',
  warning: 'warning',
  info: 'info',
};

function resolveTone(opts: ToastOptions): ToastTone {
  if (opts.tone) return opts.tone;
  if (opts.variant && VARIANT_TO_TONE[opts.variant]) return VARIANT_TO_TONE[opts.variant];
  return 'neutral';
}

/* ------------------------------------------------------------------ *
 * Module-level store
 *
 * Toasts live in a tiny external store rather than React state so that the
 * standalone `toast()` can enqueue from anywhere (outside the React tree) while
 * the `Toaster` viewport subscribes via `useSyncExternalStore`. This is what
 * lets `toast()` be a plain importable function instead of a hook.
 * ------------------------------------------------------------------ */

let records: ToastRecord[] = [];
const listeners = new Set<() => void>();
let idSeq = 0;

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ToastRecord[] {
  return records;
}

function enqueue(options: ToastOptions): string {
  const id = `u-toast-${++idSeq}`;
  records = [
    ...records,
    {
      id,
      title: options.title,
      description: options.description,
      tone: resolveTone(options),
      action: options.action,
      duration: options.duration,
      open: true,
    },
  ];
  emit();
  return id;
}

function setOpen(id: string, open: boolean): void {
  // Flip open=false so Radix plays the exit animation; the unmount happens in
  // onOpenChange once the animation has settled.
  records = records.map((record) => (record.id === id ? { ...record, open } : record));
  emit();
}

function removeRecord(id: string): void {
  records = records.filter((record) => record.id !== id);
  emit();
}

/** Dismiss a specific toast by id (runs its exit animation). */
function dismiss(id: string): void {
  setOpen(id, false);
}

/* ------------------------------------------------------------------ *
 * Imperative API (sonner-style: callable + tone shortcut methods)
 * ------------------------------------------------------------------ */

type ToastInput = string | ToastOptions | null | undefined;

function toOptions(input: ToastInput, tone: ToastTone): ToastOptions {
  if (input == null) {
    return { title: tone === 'danger' ? 'Something went wrong' : 'Done', tone };
  }
  if (typeof input === 'string') return { title: input, tone };
  return { ...input, tone: input.tone ?? tone };
}

export interface ToastFn {
  /** Enqueue a toast. Returns its id so callers can dismiss it early. */
  (options: ToastOptions): string;
  success: (input: ToastInput) => string;
  error: (input: ToastInput) => string;
  warning: (input: ToastInput) => string;
  info: (input: ToastInput) => string;
  neutral: (input: ToastInput) => string;
  /** Alias for the neutral tone. */
  message: (input: ToastInput) => string;
  /** Dismiss a specific toast by id. */
  dismiss: (id: string) => void;
}

const toastBase = (options: ToastOptions): string => enqueue(options);

/**
 * The standalone imperative toast. Call it directly or use a tone shortcut:
 *   toast({ title: 'Saved', tone: 'success' });
 *   toast.error('Could not save');
 *   toast.success('Saved');
 */
export const toast: ToastFn = Object.assign(toastBase, {
  success: (input: ToastInput) => enqueue(toOptions(input, 'success')),
  error: (input: ToastInput) => enqueue(toOptions(input, 'danger')),
  warning: (input: ToastInput) => enqueue(toOptions(input, 'warning')),
  info: (input: ToastInput) => enqueue(toOptions(input, 'info')),
  neutral: (input: ToastInput) => enqueue(toOptions(input, 'neutral')),
  message: (input: ToastInput) => enqueue(toOptions(input, 'neutral')),
  dismiss,
});

/* ------------------------------------------------------------------ *
 * React surface: provider, viewport, hook
 * ------------------------------------------------------------------ */

/**
 * Hosts the Radix toast provider (timers, swipe, hotkey, announce wiring). Place
 * it high in the tree and render `<Toaster />` as a child for the on-screen
 * viewport. State lives in the module store, so no context is required to fire a
 * toast — only to display one.
 */
export function ToastProvider({
  children,
  /** Default auto-dismiss for every toast (overridable per call). */
  duration = DEFAULT_DURATION,
  /** Swipe gesture that dismisses a toast. */
  swipeDirection = 'right',
  /** Landmark label announced to screen readers; `{hotkey}` is substituted. */
  label = 'Notifications ({hotkey})',
}: {
  children: React.ReactNode;
  duration?: number;
  swipeDirection?: ToastSwipeDirection;
  label?: string;
}): React.JSX.Element {
  return (
    <RToast.Provider duration={duration} swipeDirection={swipeDirection} label={label}>
      {children}
    </RToast.Provider>
  );
}

/**
 * The on-screen viewport: a fixed corner stack that renders every live toast.
 * Portals to <body> (via Radix) and carries the `ui20 sabcrm-twenty` class so
 * tokens resolve no matter where the trigger fired from. Subscribes to the
 * module store via `useSyncExternalStore`.
 */
export function Toaster({
  className,
  ...rest
}: React.HTMLAttributes<HTMLOListElement>): React.JSX.Element {
  const toasts = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return (
    <RToast.Viewport
      className={['ui20', 'sabcrm-twenty', 'u-toast-viewport', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {toasts.map((record) => (
        <ToastItem key={record.id} record={record} />
      ))}
    </RToast.Viewport>
  );
}

/** A single rendered toast row. */
function ToastItem({ record }: { record: ToastRecord }): React.JSX.Element {
  const { id, title, description, tone, action, duration, open } = record;
  const Icon = TONE_ICON[tone];
  const isDanger = tone === 'danger';
  const resolvedDuration = duration ?? (action ? DEFAULT_DURATION_WITH_ACTION : undefined);

  return (
    <RToast.Root
      className={`u-toast u-toast--${tone}`}
      open={open}
      duration={resolvedDuration}
      // Danger announces assertively (role=alert + immediate read-out); the rest
      // are background/polite (role=status).
      type={isDanger ? 'foreground' : 'background'}
      onOpenChange={(next) => {
        // Fires both on auto-timeout/swipe (next=false) and after the exit
        // animation settles — drop the record once it is fully closed.
        if (!next) removeRecord(id);
      }}
    >
      <span className="u-toast__edge" aria-hidden="true" />
      <Icon size={17} className="u-toast__icon" aria-hidden="true" />
      <div className="u-toast__body">
        <RToast.Title className="u-toast__title">{title}</RToast.Title>
        {description != null ? (
          <RToast.Description className="u-toast__desc">{description}</RToast.Description>
        ) : null}
      </div>
      {action ? (
        <RToast.Action
          asChild
          altText={action.label}
          // RToast.Action wraps ToastClose, so the toast auto-dismisses after
          // onClick fires — the handler runs before the exit animation starts.
          onClick={action.onClick}
        >
          <button type="button" className="u-toast__action">
            {action.label}
          </button>
        </RToast.Action>
      ) : null}
      <RToast.Close className="u-toast__close" aria-label="Dismiss">
        <X size={14} aria-hidden="true" />
      </RToast.Close>
    </RToast.Root>
  );
}

/**
 * Imperative entry point, kept for parity with hook-based call sites. Returns
 * `{ toast, dismiss }` — the same functions as the standalone `toast` export, so
 * it works whether or not a provider is mounted above the caller (only the
 * `<Toaster />` viewport needs the provider to render).
 *
 *   const { toast } = useToast();
 *   toast({ title: 'Saved', tone: 'success' });
 */
export function useToast(): { toast: ToastFn; dismiss: (id: string) => void } {
  return { toast, dismiss };
}

export default ToastProvider;

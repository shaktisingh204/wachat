'use client';

/**
 * 20ui — Toast system.
 *
 * An imperative, queue-driven notification layer built on `@radix-ui/react-toast`
 * (so swipe-to-dismiss, pause-on-hover, duration timers, hotkey focus and the
 * announce/role wiring all come battle-tested) and skinned with 20ui tokens.
 *
 * Wire it once near the app root:
 *
 *   <ToastProvider>
 *     <App />
 *     <Toaster />        // the corner viewport
 *   </ToastProvider>
 *
 * Then fire toasts from anywhere below it:
 *
 *   const { toast } = useToast();
 *   toast({ title: 'Lead saved', tone: 'success' });
 *   toast({
 *     title: 'Could not reach the server',
 *     description: 'Check your connection and try again.',
 *     tone: 'danger',
 *     action: { label: 'Retry', onClick: refetch },
 *   });
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
  /** An optional action button. */
  action?: ToastAction;
  /** Auto-dismiss delay in ms. Defaults to 5000 (8000 when an action is present). */
  duration?: number;
}

/** A live toast in the queue (an id + its options + its open flag). */
interface ToastRecord extends ToastOptions {
  id: string;
  open: boolean;
}

interface ToastContextValue {
  /** Enqueue a toast. Returns its id so callers can dismiss it early. */
  toast: (options: ToastOptions) => string;
  /** Dismiss a specific toast by id (runs its exit animation). */
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);
// The list of live toasts lives in its own context so `Toaster` can subscribe
// to it without re-rendering every consumer that only needs `toast()`.
const ToastListContext = React.createContext<ToastRecord[]>([]);

const TONE_ICON: Record<ToastTone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  neutral: Bell,
};

const DEFAULT_DURATION = 5000;
const DEFAULT_DURATION_WITH_ACTION = 8000;

let idSeq = 0;

/**
 * Provides the toast queue + `useToast()` hook and the underlying Radix
 * provider. Place it high in the tree; render `<Toaster />` as a child to get
 * the actual on-screen viewport.
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
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);

  const dismiss = React.useCallback((id: string) => {
    // Flip open=false so Radix plays the exit animation; the unmount happens in
    // onOpenChange once the animation has settled.
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, open: false } : t)));
  }, []);

  const remove = React.useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback((options: ToastOptions): string => {
    const id = `u-toast-${++idSeq}`;
    setToasts((list) => [...list, { ...options, id, open: true }]);
    return id;
  }, []);

  const ctx = React.useMemo<ToastContextValue>(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <RToast.Provider duration={duration} swipeDirection={swipeDirection} label={label}>
      <ToastContext.Provider value={ctx}>
        <ToastListContext.Provider value={toasts}>
          <RemoveContext.Provider value={remove}>{children}</RemoveContext.Provider>
        </ToastListContext.Provider>
      </ToastContext.Provider>
    </RToast.Provider>
  );
}

// Internal: lets each rendered toast tell the provider to drop it post-exit.
const RemoveContext = React.createContext<(id: string) => void>(() => {});

/**
 * The on-screen viewport: a fixed corner stack that renders every live toast.
 * Portals to <body> (via Radix) and carries the `ui20 sabcrm-twenty` class so
 * tokens resolve no matter where the trigger fired from.
 */
export function Toaster({
  className,
  ...rest
}: React.HTMLAttributes<HTMLOListElement>): React.JSX.Element {
  const toasts = React.useContext(ToastListContext);
  const remove = React.useContext(RemoveContext);

  return (
    <RToast.Viewport
      className={['ui20', 'sabcrm-twenty', 'u-toast-viewport', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} record={t} onRemove={remove} />
      ))}
    </RToast.Viewport>
  );
}

/** A single rendered toast row. */
function ToastItem({
  record,
  onRemove,
}: {
  record: ToastRecord;
  onRemove: (id: string) => void;
}): React.JSX.Element {
  const { id, title, description, tone = 'neutral', action, duration, open } = record;
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
        if (!next) onRemove(id);
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
          // Avoid the implicit close so the click handler runs first; we close
          // explicitly afterwards.
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
 * Imperative entry point. Returns `{ toast, dismiss }`:
 *   const { toast } = useToast();
 *   toast({ title: 'Saved', tone: 'success' });
 * Must be called inside a `<ToastProvider>`.
 */
export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>.');
  }
  return ctx;
}

export default ToastProvider;

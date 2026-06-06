'use client';

/**
 * PlaybackOnboardingTour
 * ────────────────────────────────────────────────────────────────────────────
 * A 5-step product tour that orients first-time visitors of the SabFlow
 * execution replay view. Steps cover:
 *
 *   1. Open execution      — the page header / status pill
 *   2. See timeline        — the left timeline rail
 *   3. Step frame-by-frame — the bottom scrub bar / transport controls
 *   4. Inspect node config — the right node-detail pane
 *   5. Pin / export        — the header overflow ("…") menu
 *
 * Implementation notes
 * ────────────────────────────────────────────────────────────────────────────
 * SabNode does **not** depend on a third-party onboarding/tour library
 * (no joyride, driver.js, intro.js, shepherd, reactour, etc.). The project
 * does ship Radix UI primitives (`@radix-ui/react-popover`), which already
 * power dozens of in-app popovers — we reuse that primitive here so the tour
 * matches the rest of the design system and ships zero new dependencies.
 *
 * Each step targets a DOM element by `data-tour` attribute. The host page
 * (the replay view) places these attributes on the relevant regions; if a
 * target is missing on the page (e.g. the user is on a stripped-down mobile
 * variant), that step is skipped automatically.
 *
 * Completion is persisted in `localStorage` under
 *   `sabflow:playback-tour:completed` = `'1' | undefined`
 * so the tour only auto-launches on a user's first visit. Calling
 * <PlaybackOnboardingTour autoStart={false} forceOpen={someBoolean} /> from
 * a "Help → Replay tour" menu lets the user replay it on demand without
 * touching localStorage.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  Popover,
  ZoruPopoverContent,
  ZoruPopoverAnchor,
} from '@/components/sabcrm/20ui/compat';
import { cn } from '@/lib/utils';

/* ─── Public API ─────────────────────────────────────────────────────── */

const STORAGE_KEY = 'sabflow:playback-tour:completed';

export interface PlaybackOnboardingTourProps {
  /**
   * If true, the tour auto-launches once per browser (gated on
   * `localStorage[STORAGE_KEY]`). Defaults to `true` — the replay page
   * should set this to true on its first render.
   */
  autoStart?: boolean;
  /**
   * Force the tour open regardless of localStorage. Used by the
   * "Help → Replay tour" menu so a user can replay the tour any time.
   * Toggle from `false → true` to start; the component will toggle it
   * back internally via `onClose`.
   */
  forceOpen?: boolean;
  /** Called when the tour is dismissed or finished. */
  onClose?: (completed: boolean) => void;
}

/* ─── Step content ───────────────────────────────────────────────────── */

interface TourStep {
  /** `data-tour="<id>"` on the target DOM node. */
  targetId: string;
  /** Short heading shown at the top of the popover. */
  title: string;
  /** Body copy — short, conversational, action-focused. */
  body: string;
  /** Side of the target the popover should appear on. */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Alignment along the side. */
  align?: 'start' | 'center' | 'end';
}

const STEPS: readonly TourStep[] = [
  {
    targetId: 'replay-header',
    title: '1. You opened an execution',
    body:
      'This is a recording of one flow run. The pill on the left shows whether it succeeded, errored, or is still in progress. Everything you do here is read-only — no external APIs are called.',
    side: 'bottom',
    align: 'start',
  },
  {
    targetId: 'replay-timeline',
    title: '2. The timeline shows every node',
    body:
      'Each row is one block that ran, in execution order. Green = success, red = error, amber = waiting. Click any row — or press ↑ / ↓ — to jump to that node.',
    side: 'right',
    align: 'start',
  },
  {
    targetId: 'replay-scrubber',
    title: '3. Step through frame-by-frame',
    body:
      'Use the scrub bar to jump anywhere in the run. Press Space to play, or pick a speed (up to 8×). Each bar\'s width matches that node\'s duration — slow steps stand out.',
    side: 'top',
    align: 'center',
  },
  {
    targetId: 'replay-detail',
    title: '4. Inspect node config and data',
    body:
      'The right pane shows the exact input and output JSON for the selected node, plus its duration and any error. Use "Re-run from here" to retry the flow from this block — upstream outputs stay pinned, so it\'s free.',
    side: 'left',
    align: 'start',
  },
  {
    targetId: 'replay-actions',
    title: '5. Pin and export',
    body:
      'The overflow menu lets you pin a node\'s output into the flow editor, or export the whole run as JSON / CSV / HAR for a support ticket or audit trail. That\'s it — happy debugging!',
    side: 'bottom',
    align: 'end',
  },
] as const;

/* ─── Helpers ────────────────────────────────────────────────────────── */

function isCompleted(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Private mode / disabled storage — treat as completed so we never
    // pop the tour repeatedly.
    return true;
  }
}

function markCompleted(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* swallow */
  }
}

/**
 * Resolve a `data-tour` target. Returns `null` if not found — the caller
 * skips that step so the tour gracefully degrades on responsive layouts
 * that hide certain regions.
 */
function findTarget(id: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(`[data-tour="${id}"]`);
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function PlaybackOnboardingTour({
  autoStart = true,
  forceOpen = false,
  onClose,
}: PlaybackOnboardingTourProps): React.ReactElement | null {
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [stepIdx, setStepIdx] = React.useState(0);
  /**
   * Bumped whenever the window resizes or scrolls so the anchor
   * re-measures the target's bounding box. (Radix Popover repositions
   * automatically once mounted, but the *virtual* anchor we render
   * needs to update its inline style.)
   */
  const [, forceRender] = React.useReducer((x: number) => x + 1, 0);

  // Decide whether to start on mount.
  React.useEffect(() => {
    setMounted(true);
    if (forceOpen || (autoStart && !isCompleted())) {
      // Defer one frame so the host page has a chance to render its
      // `data-tour="…"` targets before we measure them.
      const id = window.requestAnimationFrame(() => {
        setStepIdx(0);
        setOpen(true);
      });
      return () => window.cancelAnimationFrame(id);
    }
    return;
  }, [autoStart, forceOpen]);

  // Re-measure target on resize / scroll so the popover anchor stays
  // attached if the user resizes the viewport mid-tour.
  React.useEffect(() => {
    if (!open) return;
    const handler = () => forceRender();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [open]);

  // Walk forward, skipping any step whose target isn't mounted on the
  // current page (e.g. mobile layout that hides the timeline rail).
  const advanceFrom = React.useCallback((startIdx: number) => {
    for (let i = startIdx; i < STEPS.length; i++) {
      if (findTarget(STEPS[i].targetId)) {
        setStepIdx(i);
        return;
      }
    }
    // Nothing left to show — close.
    setOpen(false);
    markCompleted();
    onClose?.(true);
  }, [onClose]);

  const close = React.useCallback((completed: boolean) => {
    setOpen(false);
    if (completed) markCompleted();
    onClose?.(completed);
  }, [onClose]);

  // When the user opens the tour, find the first visible target.
  React.useEffect(() => {
    if (!open) return;
    advanceFrom(0);
  }, [open, advanceFrom]);

  // Highlight overlay — semi-transparent ring around the current target.
  const target = open ? findTarget(STEPS[stepIdx]?.targetId ?? '') : null;
  const rect = target?.getBoundingClientRect();

  // Scroll the target into view if it's off-screen.
  React.useEffect(() => {
    if (target) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [target]);

  if (!mounted || !open || !target || !rect) return null;

  const step = STEPS[stepIdx];
  const isLast = stepIdx >= STEPS.length - 1;

  // The virtual anchor — an invisible div positioned over the target —
  // gives Radix something to attach the popover to without us having to
  // wrap the target itself (the target lives in a different component tree).
  const anchorStyle: React.CSSProperties = {
    position: 'fixed',
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    pointerEvents: 'none',
    zIndex: 9998,
  };

  // Spotlight ring — drawn around the target so the user's eye is drawn
  // to it. Uses a large box-shadow to dim the rest of the screen.
  const spotlightStyle: React.CSSProperties = {
    position: 'fixed',
    top: rect.top - 6,
    left: rect.left - 6,
    width: rect.width + 12,
    height: rect.height + 12,
    borderRadius: 12,
    boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
    border: '2px solid #f76808',
    pointerEvents: 'none',
    transition: 'all 240ms cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 9997,
  };

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <div data-sabflow-playback-tour="" aria-live="polite">
      {/* Click-trap to dismiss the tour with the keyboard or by clicking
          the dim layer outside the highlighted region. */}
      <button
        type="button"
        aria-label="Skip playback tour"
        onClick={() => close(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close(false);
        }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'default',
          zIndex: 9996,
        }}
      />

      <div style={spotlightStyle} aria-hidden />

      <Popover open modal={false}>
        <ZoruPopoverAnchor asChild>
          <div style={anchorStyle} aria-hidden />
        </ZoruPopoverAnchor>
        <ZoruPopoverContent
          side={step.side ?? 'bottom'}
          align={step.align ?? 'center'}
          sideOffset={12}
          collisionPadding={16}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            close(false);
          }}
          onPointerDownOutside={(e) => {
            // Don't auto-dismiss when the click lands on our own
            // backdrop button — the button handler will close us.
            e.preventDefault();
          }}
          className={cn(
            'w-[340px] max-w-[calc(100vw-32px)] border-[var(--gray-5)]',
            'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-xl',
            'p-0 overflow-hidden',
          )}
        >
          <TourStepCard
            step={step}
            stepIdx={stepIdx}
            totalSteps={STEPS.length}
            isLast={isLast}
            onSkip={() => close(false)}
            onBack={() => {
              if (stepIdx === 0) return;
              // Walk backward, skipping missing targets.
              for (let i = stepIdx - 1; i >= 0; i--) {
                if (findTarget(STEPS[i].targetId)) {
                  setStepIdx(i);
                  return;
                }
              }
            }}
            onNext={() => {
              if (isLast) {
                close(true);
                return;
              }
              advanceFrom(stepIdx + 1);
            }}
          />
        </ZoruPopoverContent>
      </Popover>
    </div>,
    portalTarget,
  );
}

/* ─── Step card ──────────────────────────────────────────────────────── */

function TourStepCard({
  step,
  stepIdx,
  totalSteps,
  isLast,
  onSkip,
  onBack,
  onNext,
}: {
  step: TourStep;
  stepIdx: number;
  totalSteps: number;
  isLast: boolean;
  onSkip: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Progress dots */}
      <div className="flex items-center gap-1.5 border-b border-[var(--gray-4)] px-4 py-2.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 rounded-full transition-all',
              i === stepIdx
                ? 'w-5 bg-[var(--st-text)]'
                : i < stepIdx
                ? 'w-1.5 bg-[var(--st-text)]/60'
                : 'w-1.5 bg-[var(--gray-5)]',
            )}
            aria-hidden
          />
        ))}
        <span className="ml-auto text-[10.5px] tabular-nums text-[var(--gray-9)]">
          {stepIdx + 1} / {totalSteps}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <h3 className="text-[13px] font-semibold text-[var(--gray-12)]">
          {step.title}
        </h3>
        <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--gray-11)]">
          {step.body}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t border-[var(--gray-4)] bg-[var(--gray-2)] px-3 py-2">
        <button
          type="button"
          onClick={onSkip}
          className="rounded-md px-2 py-1 text-[11.5px] font-medium text-[var(--gray-9)] hover:text-[var(--gray-12)]"
        >
          Skip tour
        </button>
        <div className="flex items-center gap-1.5">
          {stepIdx > 0 && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-md border border-[var(--gray-5)] bg-[var(--gray-1)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:text-[var(--gray-12)]"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            className="rounded-md bg-[var(--st-text)] px-3 py-1 text-[11.5px] font-semibold text-white hover:bg-[var(--st-text)]"
            autoFocus
          >
            {isLast ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Test helpers ───────────────────────────────────────────────────── */

/**
 * Resets the "tour completed" flag — useful from a dev menu so the team
 * can re-trigger the auto-launch path without clearing the rest of
 * localStorage. Exported for use in `Help → Reset onboarding`.
 */
export function resetPlaybackTour(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* swallow */
  }
}

/** Tour step ids — exported so the host page can keep the `data-tour`
 *  attributes in sync at compile time. */
export const PLAYBACK_TOUR_TARGETS = {
  HEADER: 'replay-header',
  TIMELINE: 'replay-timeline',
  SCRUBBER: 'replay-scrubber',
  DETAIL: 'replay-detail',
  ACTIONS: 'replay-actions',
} as const;
export type PlaybackTourTargetId =
  (typeof PLAYBACK_TOUR_TARGETS)[keyof typeof PLAYBACK_TOUR_TARGETS];

'use client';

import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button, cn } from '@/components/sabcrm/20ui';

/* ── Props / State ───────────────────────────────────────────────────────── */

type Props = {
  /**
   * Region name used in the fallback copy and console logs
   * (e.g. "canvas", "side panel").
   */
  label: string;
  /**
   * Classes applied to the fallback container so each region can control its
   * own sizing/positioning (the canvas fills, the right rail is a fixed-width
   * bordered panel).
   */
  fallbackClassName?: string;
  children: ReactNode;
};

type State = {
  error: Error | null;
  /** Bumped on reset so the children subtree remounts with fresh state. */
  resetKey: number;
};

/* ── EditorErrorBoundary ─────────────────────────────────────────────────── */

/**
 * Class-based error boundary for the SabFlow editor. Mounted separately
 * around the canvas region and the right-rail panels so a crash in a
 * settings panel never takes the canvas down with it (and vice versa).
 *
 * "Reload editor" clears the caught error and remounts the children via a
 * fresh key, so the crashed subtree restarts from clean state.
 */
export class EditorErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the full stack in the console for debugging; the fallback UI only
    // shows the message.
    console.error(`[sabflow] ${this.props.label} crashed:`, error, info.componentStack);
  }

  private reset = () => {
    this.setState((prev) => ({ error: null, resetKey: prev.resetKey + 1 }));
  };

  render() {
    const { error, resetKey } = this.state;
    const { label, fallbackClassName, children } = this.props;

    if (error) {
      return (
        <div
          role="alert"
          className={cn(
            'flex flex-col items-center justify-center gap-3 bg-[var(--st-bg)] p-6 text-center',
            fallbackClassName,
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--st-danger-soft)] text-[var(--st-danger)]">
            <AlertTriangle className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-[var(--st-text)]">
              The {label} crashed
            </p>
            <p className="mx-auto mt-1 max-w-[320px] break-words text-[12px] text-[var(--st-text-secondary)]">
              {error.message || 'An unexpected error occurred.'}
            </p>
          </div>
          <Button variant="outline" size="sm" iconLeft={RotateCcw} onClick={this.reset}>
            Reload editor
          </Button>
        </div>
      );
    }

    return <Fragment key={resetKey}>{children}</Fragment>;
  }
}

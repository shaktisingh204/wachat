"use client";

/**
 * SabFlow collab error boundary.
 *
 * Catches render-time errors anywhere under the collab editor tree and:
 *  - forwards (err, info) to sibling #9's telemetry sink
 *    (`reportSabFlowError`) — forward-declared, dynamically resolved so this
 *    file can ship before #9 lands.
 *  - renders a stuck-open error pill so the user sees something actionable
 *    instead of a blank canvas. Consumers can override with `fallback`.
 *
 * React error boundaries MUST be class components — `componentDidCatch` and
 * `getDerivedStateFromError` have no hook equivalent. See:
 * https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */

import * as React from "react";

// ---------------------------------------------------------------------------
// Forward-declared sibling #9 telemetry sink.
// Tries to resolve `reportSabFlowError` at runtime; falls back to console.
// ---------------------------------------------------------------------------

type TelemetrySink = (
  err: unknown,
  info: { componentStack?: string | null },
) => void;

const DEFAULT_SINK: TelemetrySink = (err, info) => {
  if (typeof console !== "undefined") {
    // eslint-disable-next-line no-console
    console.error("[sabflow] error (telemetry sink not yet wired)", err, info);
  }
};

function resolveSink(): TelemetrySink {
  try {
    // Late-bound lookup so a sibling can attach a real sink without an
    // import cycle. Kept opt-in / global-free in the default code path.
    const g = globalThis as unknown as {
      __sabflowReportError?: TelemetrySink;
    };
    if (typeof g.__sabflowReportError === "function") {
      return g.__sabflowReportError;
    }
  } catch {
    // ignore
  }
  return DEFAULT_SINK;
}

/** Public helper: matches sibling #9's expected API shape. */
export function reportSabFlowError(
  err: unknown,
  info: { componentStack?: string | null },
): void {
  resolveSink()(err, info);
}

// ---------------------------------------------------------------------------
// Default fallback — stuck-open error pill
// ---------------------------------------------------------------------------

function DefaultFallback(): React.ReactElement {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="pointer-events-auto fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 rounded-full border border-destructive/40 bg-destructive px-5 py-2 text-sm font-medium text-destructive-foreground shadow-lg"
    >
      Collab error &mdash; refresh to retry
    </div>
  );
}

// ---------------------------------------------------------------------------
// Boundary
// ---------------------------------------------------------------------------

export interface SabFlowErrorBoundaryProps {
  children: React.ReactNode;
  /** Custom fallback UI. Defaults to the stuck-open error pill. */
  fallback?: React.ReactNode;
  /** Optional extra hook for tests / parents. Called after telemetry. */
  onError?: (err: unknown, info: React.ErrorInfo) => void;
}

interface SabFlowErrorBoundaryState {
  hasError: boolean;
}

export class SabFlowErrorBoundary extends React.Component<
  SabFlowErrorBoundaryProps,
  SabFlowErrorBoundaryState
> {
  state: SabFlowErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(_err: unknown): SabFlowErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    try {
      reportSabFlowError(error, { componentStack: info.componentStack });
    } catch {
      // never let the sink throw inside the boundary
    }
    if (this.props.onError) {
      try {
        this.props.onError(error, info);
      } catch {
        // swallow — boundary should never re-throw
      }
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? <DefaultFallback />;
    }
    return this.props.children;
  }
}

export default SabFlowErrorBoundary;

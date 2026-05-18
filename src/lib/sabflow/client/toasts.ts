/**
 * SabFlow collab toast surface.
 *
 * Thin domain wrappers around the existing `@/hooks/use-toast` helper
 * (shadcn-style toast, dominant pattern across SabNode — 207 imports vs 8 sonner).
 *
 * These wrappers exist so collab/optimistic/offline event sources can emit
 * stable, opinionated user-visible copy without re-inventing strings at the
 * call site. Severities map to the variants already declared in
 * `src/components/ui/toast.tsx` (`destructive`, `warning`, `info`, `success`).
 *
 * Also wires up listeners for forward-declared sibling event buses
 * (sibling #6 `optimistic.events`, sibling #7 `offline-queue.events`) so
 * `'rollback'` / `'truncated'` etc. translate into toasts automatically when
 * `subscribeSabFlowToasts()` is called once at app boot.
 */

import { toast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Domain wrappers
// ---------------------------------------------------------------------------

/** Server rejected an optimistic op because of a conflicting CRDT/version. */
export function toastConflictRejected(reason: string): void {
  toast({
    variant: "warning",
    title: "Change rejected",
    description:
      reason && reason.length > 0
        ? `Conflict: ${reason}. Your latest edit was rolled back.`
        : "A conflicting change was made by someone else. Your latest edit was rolled back.",
  });
}

/** Realtime transport dropped — user is now editing offline-only. */
export function toastDisconnected(): void {
  toast({
    variant: "destructive",
    title: "Disconnected",
    description:
      "Lost connection to the collab server. Edits are saved locally and will sync when you reconnect.",
  });
}

/** Transport recovered after `after` ms of downtime. */
export function toastReconnected(after: number): void {
  const seconds = Math.max(1, Math.round(after / 1000));
  toast({
    variant: "success",
    title: "Back online",
    description: `Reconnected after ${seconds}s. Syncing pending edits…`,
  });
}

/** Editor seat cap for the current tier hit. */
export function toastSeatLimit(tier: string, limit: number): void {
  toast({
    variant: "warning",
    title: "Seat limit reached",
    description: `Your ${tier} plan supports ${limit} concurrent editor${limit === 1 ? "" : "s"}. Upgrade to add more seats.`,
  });
}

/** Offline queue flushed `count` queued ops to the server. */
export function toastOfflineSaved(count: number): void {
  if (count <= 0) return;
  toast({
    variant: "info",
    title: "Saved offline edits",
    description: `Synced ${count} pending change${count === 1 ? "" : "s"}.`,
  });
}

// ---------------------------------------------------------------------------
// Event-bus subscription (forward-declared siblings)
// ---------------------------------------------------------------------------

/**
 * Minimal shape of the optimistic/offline event buses owned by siblings #6/#7.
 * Sibling files will export concrete instances; we depend only on this
 * structural contract so this file can land before/independent of them.
 */
type EventLike = {
  on: (event: string, handler: (payload: unknown) => void) => void;
  off: (event: string, handler: (payload: unknown) => void) => void;
};

type SabFlowEventSources = {
  optimisticEvents?: EventLike | null;
  offlineQueueEvents?: EventLike | null;
};

type Unsubscribe = () => void;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/**
 * Wire SabFlow toasts to the optimistic + offline-queue event sources.
 * Returns an unsubscribe function. Safe to call with `null` sources during
 * early boot — handlers simply won't be attached for missing buses.
 */
export function subscribeSabFlowToasts(
  sources: SabFlowEventSources,
): Unsubscribe {
  const teardown: Array<() => void> = [];

  const { optimisticEvents, offlineQueueEvents } = sources;

  if (optimisticEvents) {
    const onRollback = (payload: unknown) => {
      const reason = isRecord(payload) ? asString(payload.reason) : "";
      toastConflictRejected(reason);
    };
    const onTruncated = (payload: unknown) => {
      const dropped = isRecord(payload) ? asNumber(payload.dropped) : 0;
      toast({
        variant: "warning",
        title: "Some edits were dropped",
        description:
          dropped > 0
            ? `${dropped} pending edit${dropped === 1 ? "" : "s"} could not be applied and were discarded.`
            : "Some pending edits could not be applied and were discarded.",
      });
    };

    optimisticEvents.on("rollback", onRollback);
    optimisticEvents.on("truncated", onTruncated);
    teardown.push(() => optimisticEvents.off("rollback", onRollback));
    teardown.push(() => optimisticEvents.off("truncated", onTruncated));
  }

  if (offlineQueueEvents) {
    const onDisconnected = () => toastDisconnected();
    const onReconnected = (payload: unknown) => {
      const after = isRecord(payload) ? asNumber(payload.after) : 0;
      toastReconnected(after);
    };
    const onFlushed = (payload: unknown) => {
      const count = isRecord(payload) ? asNumber(payload.count) : 0;
      toastOfflineSaved(count);
    };
    const onSeatLimit = (payload: unknown) => {
      const tier = isRecord(payload) ? asString(payload.tier, "current") : "current";
      const limit = isRecord(payload) ? asNumber(payload.limit, 1) : 1;
      toastSeatLimit(tier, limit);
    };

    offlineQueueEvents.on("disconnected", onDisconnected);
    offlineQueueEvents.on("reconnected", onReconnected);
    offlineQueueEvents.on("flushed", onFlushed);
    offlineQueueEvents.on("seat-limit", onSeatLimit);
    teardown.push(() => offlineQueueEvents.off("disconnected", onDisconnected));
    teardown.push(() => offlineQueueEvents.off("reconnected", onReconnected));
    teardown.push(() => offlineQueueEvents.off("flushed", onFlushed));
    teardown.push(() => offlineQueueEvents.off("seat-limit", onSeatLimit));
  }

  return () => {
    for (const fn of teardown) {
      try {
        fn();
      } catch {
        // best-effort detach
      }
    }
  };
}

/**
 * Pure helpers used by both the server actions in `./actions.ts` and
 * the unit tests under `./__tests__/consent.test.ts`.
 *
 * Kept in a non-"use server" module so Next.js doesn't try to wrap the
 * sync exports as async server actions — and so the test runner can
 * import them without dragging in Mongo / session.
 */

import { createHash } from "node:crypto";

import type { SabsmsConsentKind } from "@/lib/sabsms/types";

interface MinConsentEvent {
  kind: SabsmsConsentKind;
  createdAt: string | Date;
}

/**
 * Run the double-opt-in verification on a chronological list of
 * events. A phone is verified only when:
 *
 *   1. The latest run of opt-in events contains an `opt_in_single`
 *      followed (later in time) by an `opt_in_double`, AND
 *   2. No `opt_out_*` event has occurred after that double opt-in.
 *
 * An `opt_in_restart` after a STOP resets the verification — useful
 * when the engine handles the "START" / "UNSTOP" keyword and the user
 * re-confirms.
 */
export function verifyDoubleOptIn(events: MinConsentEvent[]): {
  verified: boolean;
  verifiedAt?: Date;
} {
  if (!Array.isArray(events) || events.length === 0) {
    return { verified: false };
  }

  const sorted = [...events].sort((a, b) => {
    const at =
      a.createdAt instanceof Date
        ? a.createdAt.getTime()
        : new Date(a.createdAt).getTime();
    const bt =
      b.createdAt instanceof Date
        ? b.createdAt.getTime()
        : new Date(b.createdAt).getTime();
    return at - bt;
  });

  let singleAt: Date | null = null;
  let verifiedAt: Date | null = null;

  for (const e of sorted) {
    const at = e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt);
    switch (e.kind) {
      case "opt_in_single":
        singleAt = at;
        break;
      case "opt_in_double":
        if (singleAt && at.getTime() >= singleAt.getTime()) {
          verifiedAt = at;
        }
        break;
      case "opt_out_stop":
      case "opt_out_manual":
      case "opt_out_complaint":
      case "opt_out_carrier_block":
        verifiedAt = null;
        singleAt = null;
        break;
      case "opt_in_restart":
        verifiedAt = at;
        singleAt = at;
        break;
      default:
        break;
    }
  }

  return verifiedAt ? { verified: true, verifiedAt } : { verified: false };
}

/**
 * Sign an export payload with a SHA-256 footer hash. The audit-ready
 * export attaches `# signature: <hash>` so re-runs can detect tampering.
 */
export function signExportPayload(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

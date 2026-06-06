"use client";

/* Toast conventions
 * -----------------------------------------------------------------
 * Canonical entry point: `useZoruToast()` from
 *   `@/components/sabcrm/20ui/legacy/use-zoru-toast` (re-exported from
 *   `@/components/zoruui`). This file renders any toast queued via
 *   that hook through Radix' Toast primitives.
 *
 * The four standard variants every consumer should use:
 *   - success      → confirmations  (save, create, delete OK)
 *   - info         → neutral status (default; also the implicit
 *                    fallback when no `variant` is passed)
 *   - warning      → soft warnings  (validation, "not yet", "queued")
 *   - destructive  → errors / failures (server error, invalid input)
 *
 * NOTE: the standard "error" semantic maps to the `destructive`
 * variant for legacy parity with the shadcn toast API used by
 * `@/hooks/use-toast`. Do NOT introduce `variant: 'error'` — it has
 * no styling and will fall back to `default`.
 *
 * Canonical call signature (preferred):
 *   const { toast } = useZoruToast();
 *   toast({
 *     variant: 'success',          // 'success' | 'info' | 'warning' | 'destructive'
 *     title: 'Saved',              // required short headline
 *     description: 'Changes saved' // optional body copy
 *   });
 *
 * Field names: ALWAYS use `description` for the body, NEVER `message`.
 * (No `message:` drift was found in the codebase as of this audit.)
 *
 * Two parallel toast systems exist; both honour the same call shape:
 *   1. Radix-based  → `useZoruToast` + `<ZoruToaster />` (this file)
 *   2. Sonner-based → `zoruSonnerToast` + `<ZoruSonner />`
 * Legacy `@/hooks/use-toast` is still used by ~205 files (mostly
 * admin + settings pages) — those use the same `toast({ title,
 * description, variant: 'destructive' })` shape, so they are
 * source-compatible and a future codemod can swap imports only.
 * -----------------------------------------------------------------
 */

import {
  ZoruToast,
  ZoruToastClose,
  ZoruToastDescription,
  ZoruToastProvider,
  ZoruToastTitle,
  ZoruToastViewport,
} from "./toast";
import { useZoruToast } from "./use-zoru-toast";

/**
 * Mount once, near the app root inside a `.zoruui` scope. Renders any
 * toast created via `zoruToast(...)` from `use-zoru-toast`.
 */
export function ZoruToaster() {
  const { toasts } = useZoruToast();

  return (
    <ZoruToastProvider duration={5000}>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <ZoruToast key={id} {...props}>
          <div className="flex-1 min-w-0">
            {title && <ZoruToastTitle>{title}</ZoruToastTitle>}
            {description && (
              <ZoruToastDescription>{description}</ZoruToastDescription>
            )}
          </div>
          {action}
          <ZoruToastClose />
        </ZoruToast>
      ))}
      <ZoruToastViewport />
    </ZoruToastProvider>
  );
}

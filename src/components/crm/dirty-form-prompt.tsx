'use client';

/**
 * <DirtyFormPrompt/> — blocks navigation when a form has unsaved edits.
 *
 * Mount this anywhere inside a form route; it wires a `beforeunload`
 * listener while `dirty` is `true`, so closing the tab, refreshing, or
 * navigating to an external URL prompts the browser's native "leave site?"
 * confirm. The listener is detached automatically when `dirty` flips
 * back to `false` or the component unmounts.
 *
 * @example
 * ```tsx
 * function EditLeadForm({ lead }: { lead: Lead }) {
 *   const form = useForm({ defaultValues: lead });
 *   return (
 *     <>
 *       <DirtyFormPrompt dirty={form.formState.isDirty} />
 *       <form onSubmit={form.handleSubmit(save)}>{/* …fields… *\/}</form>
 *     </>
 *   );
 * }
 * ```
 *
 * @remarks
 * **Known limitation — intra-app navigation is NOT intercepted.** Next.js
 * App Router does not expose a public router-events API (the Pages-router
 * `Router.events.routeChangeStart` was removed in App Router), so we cannot
 * cleanly intercept a `next/link` click or a programmatic `router.push`.
 * Calls to `router.push`/`router.replace` will navigate without a prompt.
 *
 * This component covers the must-have safety net (tab-close, reload,
 * external-link navigation, browser back/forward) via the browser's
 * `beforeunload` event. For intra-app prompts, pair this with a
 * call-site-specific guard (e.g. wrap your nav buttons in `ConfirmDialog`,
 * or stash dirty state in a context that your custom `<Link>` consults).
 */

import * as React from 'react';

export interface DirtyFormPromptProps {
  /** When true, block beforeunload + intercept router pushes with a confirm dialog. */
  dirty: boolean;
  /** Message shown to the user. Default: "You have unsaved changes. Discard them?" */
  message?: string;
}

export function DirtyFormPrompt({
  dirty,
  message = 'You have unsaved changes. Discard them?',
}: DirtyFormPromptProps) {
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy Chrome/Edge required `returnValue` to be set; modern
      // browsers ignore the value but still honour the `preventDefault`.
      e.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, message]);

  return null;
}

/**
 * Quick capture page.
 *
 * Renders the quick-capture client UI for the per-user "Quick Notes"
 * notebook. The page is intentionally a top-level route (not an
 * intercepting modal) so it can be deep-linked from the keyboard shortcut
 * dispatcher / global command palette.
 */

import { redirect } from 'next/navigation';

import { getOrCreateQuickNotesNotebook } from '@/app/actions/sabnotebook.actions';

import { QuickCapture } from '../_components/quick-capture';

export const dynamic = 'force-dynamic';

export default async function QuickCapturePage() {
  const quick = await getOrCreateQuickNotesNotebook();
  if (!quick) {
    // Rust service unavailable — bounce back to the legacy sticky board.
    redirect('/dashboard/crm/workspace/sticky-notes#quick-notes');
  }
  return (
    <QuickCapture
      notebookId={quick.notebook._id}
      sectionId={quick.section._id}
    />
  );
}

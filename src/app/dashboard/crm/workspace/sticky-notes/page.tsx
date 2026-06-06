/**
 * Notes hub — `/dashboard/crm/workspace/sticky-notes`.
 *
 * This was historically the sticky-notes board. It is now a Notes hub:
 *   • Top: notebook grid (SabNotebook) with a +New notebook CTA.
 *   • Bottom: the original sticky-notes board, surfaced as "Quick Notes".
 *
 * The URL path is preserved for backwards-compat — every deep link to
 * `/dashboard/crm/workspace/sticky-notes` keeps working. New URLs:
 *   - `/dashboard/crm/workspace/sticky-notes/[notebookId]` — notebook shell
 *   - `/dashboard/crm/workspace/sticky-notes/quick`        — quick capture
 */

import * as React from 'react';

import {
  getOrCreateQuickNotesNotebook,
  listSabnotebookNotebooks,
} from '@/app/actions/sabnotebook.actions';

import { LegacyStickyBoard } from './_components/legacy-sticky-board';
import { NotebookGrid } from './_components/notebook-grid';

export const dynamic = 'force-dynamic';

export default async function NotesHubPage() {
  // Best-effort: ensure a Quick Notes notebook exists so users can graduate
  // from the sticky-notes board to structured sections later. If the Rust
  // service is down we still render the legacy board.
  const [notebooks, quick] = await Promise.all([
    listSabnotebookNotebooks({ status: 'active', limit: 100 }),
    getOrCreateQuickNotesNotebook(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <NotebookGrid
        initialNotebooks={notebooks.items}
        quickNotebookId={quick?.notebook._id ?? null}
      />
      <section
        id="quick-notes"
        className="border-t border-[var(--st-border)] pt-6"
      >
        <div className="px-4 md:px-6">
          <h2 className="mb-2 text-lg font-semibold tracking-tight">
            Quick Notes
          </h2>
          <p className="mb-4 text-sm text-[var(--st-text-secondary)]">
            Lightweight sticky notes for everything that doesn&rsquo;t need
            its own notebook.
          </p>
        </div>
        <div className="px-4 md:px-6">
          <LegacyStickyBoard />
        </div>
      </section>
    </div>
  );
}

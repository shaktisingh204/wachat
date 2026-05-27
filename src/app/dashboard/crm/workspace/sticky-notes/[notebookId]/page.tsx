/**
 * Notebook shell page.
 *
 * Server component: loads the notebook, its sections, the first section's
 * notes, and (optionally) the deep-linked note via `?note=<id>`. Hands all
 * of it to the client `<NotebookShell>` which manages the 3-pane UI.
 */

import { notFound } from 'next/navigation';

import {
  getSabnotebookNote,
  getSabnotebookNotebook,
  listSabnotebookNotes,
  listSabnotebookSections,
} from '@/app/actions/sabnotebook.actions';

import { NotebookShell } from '../_components/notebook-shell';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ notebookId: string }>;
  searchParams: Promise<{ note?: string }>;
}

export default async function NotebookPage({
  params,
  searchParams,
}: PageProps) {
  const { notebookId } = await params;
  const { note: deepLinkNoteId } = await searchParams;

  const notebook = await getSabnotebookNotebook(notebookId);
  if (!notebook) {
    notFound();
  }

  const sectionsRes = await listSabnotebookSections({
    notebookId,
    limit: 200,
    status: 'active',
  });
  const sections = sectionsRes.items;

  // Pick the section that hosts the deep-linked note, else the first.
  let initialSelectedNote = null as Awaited<
    ReturnType<typeof getSabnotebookNote>
  >;
  if (deepLinkNoteId) {
    initialSelectedNote = await getSabnotebookNote(deepLinkNoteId);
  }
  const activeSectionId =
    initialSelectedNote?.sectionId ?? sections[0]?._id ?? null;

  const notesRes = activeSectionId
    ? await listSabnotebookNotes({
        sectionId: activeSectionId,
        notebookId,
        status: 'active',
        limit: 100,
      })
    : { items: [], page: 0, limit: 0, hasMore: false };

  return (
    <NotebookShell
      notebook={notebook}
      initialSections={sections}
      initialNotes={notesRes.items}
      initialSelectedNote={initialSelectedNote}
    />
  );
}

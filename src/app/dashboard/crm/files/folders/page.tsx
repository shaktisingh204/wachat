/**
 * /dashboard/crm/files/folders
 *
 * Server component — fetches folder tree, root files, and stats, then
 * hands off to the interactive <FoldersBrowserClient>.
 *
 * Features:
 *  - KPI strip: total folders, total files, storage used, added this month
 *  - Collapsible folder tree (left panel)
 *  - File list with Name, Type, Size, Owner, Uploaded at, Actions
 *  - Breadcrumb navigation
 *  - Upload via <SabFilePickerButton> (never a free-text URL)
 *  - Create folder action
 *  - Bulk delete files/folders
 *  - Filter by file type and date range
 *  - Export CSV
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getFolderTree,
  getFiles,
  getFileBrowserStats,
} from '@/app/actions/worksuite/files.actions';
import type { WsFileStorage } from '@/lib/worksuite/file-types';
import { FoldersBrowserClient } from './_components/folders-browser-client';

import { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

async function FileFoldersData() {
  const [folderTree, rootFiles, stats] = await Promise.all([
    getFolderTree(),
    getFiles(null),
    getFileBrowserStats(),
  ]);

  return (
    <FoldersBrowserClient
      folderTree={folderTree}
      initialFiles={rootFiles as WsFileStorage[]}
      stats={stats}
    />
  );
}

export default function FileFoldersPage() {
  return (
    <EntityListShell
      title="Files &amp; Folders"
      subtitle="Organize and browse all CRM files. Upload via the library — no external URLs."
    >
      <Suspense fallback={<Skeleton className="h-[400px] w-full" />}>
        <FileFoldersData />
      </Suspense>
    </EntityListShell>
  );
}

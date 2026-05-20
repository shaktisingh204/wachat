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

export const dynamic = 'force-dynamic';

export default async function FileFoldersPage() {
  const [folderTree, rootFiles, stats] = await Promise.all([
    getFolderTree(),
    getFiles(null),
    getFileBrowserStats(),
  ]);

  return (
    <EntityListShell
      title="Files &amp; Folders"
      subtitle="Organize and browse all CRM files. Upload via the library — no external URLs."
    >
      <FoldersBrowserClient
        folderTree={folderTree}
        initialFiles={rootFiles as WsFileStorage[]}
        stats={stats}
      />
    </EntityListShell>
  );
}

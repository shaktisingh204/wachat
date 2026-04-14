'use client';

import { FolderTree } from 'lucide-react';
import { HrEntityPage } from '../../hr/_components/hr-entity-page';
import {
  getFileFolders,
  saveFileFolder,
  deleteFileFolder,
} from '@/app/actions/worksuite/files.actions';
import type { WsFileFolder } from '@/lib/worksuite/file-types';

export default function FileFoldersPage() {
  return (
    <HrEntityPage<WsFileFolder & { _id: string }>
      title="File Folders"
      subtitle="Organize files into a nested folder tree."
      icon={FolderTree}
      singular="Folder"
      getAllAction={getFileFolders as any}
      saveAction={saveFileFolder}
      deleteAction={deleteFileFolder}
      columns={[
        { key: 'name', label: 'Folder' },
        {
          key: 'parent_folder_id',
          label: 'Parent',
          render: (row) => row.parent_folder_id || '—',
        },
        {
          key: 'description',
          label: 'Description',
          render: (row) => row.description || '—',
        },
      ]}
      fields={[
        { name: 'name', label: 'Folder Name', required: true, fullWidth: true },
        {
          name: 'parent_folder_id',
          label: 'Parent Folder ID',
          placeholder: 'Leave blank for root',
          help: 'Paste an existing folder id to nest this folder underneath it.',
        },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          fullWidth: true,
        },
      ]}
    />
  );
}

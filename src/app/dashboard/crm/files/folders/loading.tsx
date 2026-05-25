import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function FileFoldersLoading() {
  return <EntityListShell loading={true} title="Files & Folders" subtitle="Organize and browse all CRM files. Upload via the library — no external URLs." />;
}

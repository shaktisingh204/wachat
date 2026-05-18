'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import {
  Folder,
  FolderOpen,
  FileText,
  Download,
  Trash2,
  Plus,
  FolderTree,
  } from 'lucide-react';

import { CrmPageHeader } from '../_components/crm-page-header';

import {
  getFolderTree,
  getFiles,
  deleteFile,
} from '@/app/actions/worksuite/files.actions';
import {
  formatFileSize,
  type WsFileStorage,
  type WsFolderTreeNode,
} from '@/lib/worksuite/file-types';

function TreeNode({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: WsFolderTreeNode;
  depth: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const id = String(node._id);
  const isActive = selected === id;
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(id)}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-zoru-ink hover:bg-zoru-surface-2'
        }`}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {isActive ? (
          <FolderOpen className="h-4 w-4" />
        ) : (
          <Folder className="h-4 w-4" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {node.children.length > 0 ? (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={String(child._id)}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function CrmFilesPage() {
  const { toast } = useZoruToast();
  const [tree, setTree] = useState<WsFolderTreeNode[]>([]);
  const [selected, setSelected] = useState<string | null>(null); // null = all
  const [files, setFiles] = useState<WsFileStorage[]>([]);
  const [isLoading, startTransition] = useTransition();

  const loadTree = useCallback(() => {
    startTransition(async () => {
      const next = await getFolderTree();
      setTree(next);
    });
  }, []);

  const loadFiles = useCallback(
    (folderId: string | null) => {
      startTransition(async () => {
        const next = await getFiles(folderId ?? undefined);
        setFiles(next);
      });
    },
    [],
  );

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  useEffect(() => {
    loadFiles(selected);
  }, [selected, loadFiles]);

  const selectedLabel = useMemo(() => {
    if (!selected) return 'All files';
    const walk = (nodes: WsFolderTreeNode[]): string | null => {
      for (const n of nodes) {
        if (String(n._id) === selected) return n.name;
        const found = walk(n.children);
        if (found) return found;
      }
      return null;
    };
    return walk(tree) ?? 'All files';
  }, [tree, selected]);

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteFile(id);
      if (res.success) {
        toast({ title: 'File removed.' });
        loadFiles(selected);
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to delete file',
          description: res.error,
        });
      }
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Files"
        subtitle="Centralized file storage — attach documents to contacts, deals, projects and more."
        icon={FileText}
        actions={
          <>
            <Link href="/dashboard/crm/files/folders">
              <ZoruButton variant="ghost">
                <FolderTree className="h-4 w-4" />
                Manage folders
              </ZoruButton>
            </Link>
            <Link href="/dashboard/crm/files/new">
              <ZoruButton>
                <Plus className="h-4 w-4" />
                Attach file
              </ZoruButton>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <ZoruCard className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13.5px] font-semibold text-zoru-ink">Folders</h3>
            <ZoruBadge variant="ghost">{tree.length}</ZoruBadge>
          </div>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                selected === null
                  ? 'bg-accent text-accent-foreground'
                  : 'text-zoru-ink hover:bg-zoru-surface-2'
              }`}
            >
              <Folder className="h-4 w-4" />
              All files
            </button>
            {tree.length === 0 ? (
              <p className="mt-3 text-[12px] text-zoru-ink-muted">
                No folders yet — add one under&nbsp;
                <Link href="/dashboard/crm/files/folders" className="underline">
                  Manage folders
                </Link>
                .
              </p>
            ) : (
              tree.map((n) => (
                <TreeNode
                  key={String(n._id)}
                  node={n}
                  depth={0}
                  selected={selected}
                  onSelect={setSelected}
                />
              ))
            )}
          </div>
        </ZoruCard>

        <ZoruCard className="p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-zoru-ink">
                {selectedLabel}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                {files.length} file{files.length === 1 ? '' : 's'} in this scope.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                  <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Size</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Attached to</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted w-[140px]">Actions</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {isLoading && files.length === 0 ? (
                  [...Array(4)].map((_, i) => (
                    <ZoruTableRow key={i} className="border-zoru-line">
                      <ZoruTableCell colSpan={5}>
                        <ZoruSkeleton className="h-10 w-full" />
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                ) : files.length === 0 ? (
                  <ZoruTableRow className="border-zoru-line">
                    <ZoruTableCell
                      colSpan={5}
                      className="h-24 text-center text-[13px] text-zoru-ink-muted"
                    >
                      No files in this folder.
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  files.map((file) => (
                    <ZoruTableRow
                      key={String(file._id)}
                      className="border-zoru-line"
                    >
                      <ZoruTableCell>
                        <div className="flex flex-col">
                          <span className="text-[13px] font-medium text-zoru-ink">
                            {file.display_name || file.filename}
                          </span>
                          <span className="text-[11.5px] text-zoru-ink-muted">
                            {file.filename}
                          </span>
                        </div>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[12.5px] text-zoru-ink">
                        {formatFileSize(file.size_bytes)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[12.5px] text-zoru-ink">
                        {file.extension || file.mime_type || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {file.attached_to_type ? (
                          <ZoruBadge variant="danger">
                            {file.attached_to_type}
                          </ZoruBadge>
                        ) : (
                          <span className="text-[12.5px] text-zoru-ink-muted">
                            —
                          </span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <div className="flex items-center gap-2">
                          {file.url ? (
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-foreground hover:underline"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Open
                            </a>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleDelete(String(file._id))}
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-zoru-danger-ink hover:underline"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                )}
              </ZoruTableBody>
            </ZoruTable>
          </div>
        </ZoruCard>
      </div>
    </div>
  );
}

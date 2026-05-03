'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
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

import { ClayBadge, ClayButton, ClayCard } from '@/components/clay';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
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
            : 'text-foreground hover:bg-muted'
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
  const { toast } = useToast();
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
              <ClayButton variant="ghost" leading={<FolderTree className="h-4 w-4" />}>
                Manage folders
              </ClayButton>
            </Link>
            <Link href="/dashboard/crm/files/new">
              <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" />}>
                Attach file
              </ClayButton>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <ClayCard>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13.5px] font-semibold text-foreground">Folders</h3>
            <ClayBadge tone="neutral">{tree.length}</ClayBadge>
          </div>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                selected === null
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              <Folder className="h-4 w-4" />
              All files
            </button>
            {tree.length === 0 ? (
              <p className="mt-3 text-[12px] text-muted-foreground">
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
        </ClayCard>

        <ClayCard>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-foreground">
                {selectedLabel}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                {files.length} file{files.length === 1 ? '' : 's'} in this scope.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">Size</TableHead>
                  <TableHead className="text-muted-foreground">Type</TableHead>
                  <TableHead className="text-muted-foreground">Attached to</TableHead>
                  <TableHead className="text-muted-foreground w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && files.length === 0 ? (
                  [...Array(4)].map((_, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell colSpan={5}>
                        <Skeleton className="h-10 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : files.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-[13px] text-muted-foreground"
                    >
                      No files in this folder.
                    </TableCell>
                  </TableRow>
                ) : (
                  files.map((file) => (
                    <TableRow
                      key={String(file._id)}
                      className="border-border"
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-[13px] font-medium text-foreground">
                            {file.display_name || file.filename}
                          </span>
                          <span className="text-[11.5px] text-muted-foreground">
                            {file.filename}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[12.5px] text-foreground">
                        {formatFileSize(file.size_bytes)}
                      </TableCell>
                      <TableCell className="text-[12.5px] text-foreground">
                        {file.extension || file.mime_type || '—'}
                      </TableCell>
                      <TableCell>
                        {file.attached_to_type ? (
                          <ClayBadge tone="rose-soft">
                            {file.attached_to_type}
                          </ClayBadge>
                        ) : (
                          <span className="text-[12.5px] text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
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
                            className="inline-flex items-center gap-1 text-[12px] font-medium text-destructive hover:underline"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </ClayCard>
      </div>
    </div>
  );
}

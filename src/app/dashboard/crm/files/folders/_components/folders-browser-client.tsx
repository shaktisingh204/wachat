'use client';

/**
 * CRM Files/Folders browser — interactive client shell.
 *
 * Layout: collapsible folder tree (left) + file list with breadcrumb (right).
 * Upload via <SabFilePickerButton> — never a free-text URL.
 *
 * Actions available:
 *  - Select a folder in the tree → loads files for that folder
 *  - Breadcrumb navigation
 *  - Upload file (SabFiles picker)
 *  - Create folder
 *  - Delete folder
 *  - Bulk delete selected files
 *  - Filter by file type and date range
 *  - Export CSV of file list
 */

import * as React from 'react';

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  ChevronDown,
  ChevronRight,
  Download,
  File,
  FileImage,
  FileText,
  FileVideo,
  FolderOpen,
  FolderPlus,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';

import { SabFilePickerButton } from '@/components/sabfiles';
import type { SabFilePick } from '@/components/sabfiles';

import {
  getFiles,
  deleteFile,
  deleteFileFolder,
  bulkDeleteFiles,
  createFolder,
  uploadFile,
  type FileBrowserStats,
} from '@/app/actions/worksuite/files.actions';
import type { WsFileStorage, WsFolderTreeNode } from '@/lib/worksuite/file-types';
import { formatFileSize } from '@/lib/worksuite/file-types';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

/* ── types ────────────────────────────────────────────────────────────── */

type FileTypeFilter = 'all' | 'image' | 'pdf' | 'doc' | 'video' | 'other';

const FILE_TYPE_LABELS: Record<FileTypeFilter, string> = {
  all: 'All types',
  image: 'Images',
  pdf: 'PDF',
  doc: 'Documents',
  video: 'Video',
  other: 'Other',
};

function fileTypeOf(file: WsFileStorage): FileTypeFilter {
  const mime = file.mime_type ?? '';
  const ext = (file.extension ?? '').toLowerCase();
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext))
    return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
  if (
    ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'odt'].includes(ext) ||
    mime.includes('word') ||
    mime.includes('sheet') ||
    mime.includes('text/plain')
  )
    return 'doc';
  return 'other';
}

function FileTypeIcon({ file }: { file: WsFileStorage }): React.JSX.Element {
  const t = fileTypeOf(file);
  if (t === 'image') return <FileImage className="h-4 w-4 text-zoru-ink-muted" />;
  if (t === 'video') return <FileVideo className="h-4 w-4 text-zoru-ink-muted" />;
  if (t === 'pdf' || t === 'doc') return <FileText className="h-4 w-4 text-zoru-ink-muted" />;
  return <File className="h-4 w-4 text-zoru-ink-muted" />;
}

/* ── folder tree ──────────────────────────────────────────────────────── */

interface FolderNodeProps {
  node: WsFolderTreeNode;
  activeFolderId: string | null;
  onSelect: (id: string) => void;
  depth: number;
}

function FolderNode({
  node,
  activeFolderId,
  onSelect,
  depth,
}: FolderNodeProps): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  const id = String(node._id ?? '');
  const isActive = activeFolderId === id;

  return (
    <li>
      <button
        type="button"
        className={[
          'flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-[13px] transition-colors',
          isActive
            ? 'bg-zoru-primary/10 font-medium text-zoru-primary'
            : 'text-zoru-ink hover:bg-zoru-surface-2',
        ].join(' ')}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(id)}
      >
        {node.children.length > 0 ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="flex items-center"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        ) : (
          <span className="w-3.5" />
        )}
        <FolderOpen className="h-4 w-4 shrink-0 text-zoru-ink-muted" />
        <span className="truncate">{node.name}</span>
      </button>
      {expanded && node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <FolderNode
              key={String(child._id)}
              node={child}
              activeFolderId={activeFolderId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/* ── props ────────────────────────────────────────────────────────────── */

export interface FoldersBrowserClientProps {
  folderTree: WsFolderTreeNode[];
  initialFiles: WsFileStorage[];
  stats: FileBrowserStats;
}

/* ── component ───────────────────────────────────────────────────────── */

export function FoldersBrowserClient({
  folderTree,
  initialFiles,
  stats,
}: FoldersBrowserClientProps): React.JSX.Element {
  const { toast } = useZoruToast();

  const [activeFolderId, setActiveFolderId] = React.useState<string | null>(null);
  const [files, setFiles] = React.useState<WsFileStorage[]>(initialFiles);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [fileTypeFilter, setFileTypeFilter] = React.useState<FileTypeFilter>('all');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [newFolderName, setNewFolderName] = React.useState('');
  const [creatingFolder, setCreatingFolder] = React.useState(false);
  const [showNewFolder, setShowNewFolder] = React.useState(false);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);

  /* ── load files for folder ────────────────────────────────────────── */

  const loadFolder = React.useCallback(async (folderId: string | null) => {
    setLoading(true);
    setSelected(new Set());
    try {
      const result = await getFiles(folderId);
      setFiles(result as WsFileStorage[]);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectFolder = React.useCallback(
    (id: string) => {
      const next = activeFolderId === id ? null : id;
      setActiveFolderId(next);
      void loadFolder(next);
    },
    [activeFolderId, loadFolder],
  );

  const goToRoot = React.useCallback(() => {
    setActiveFolderId(null);
    void loadFolder(null);
  }, [loadFolder]);

  /* ── breadcrumb label ─────────────────────────────────────────────── */

  const activeFolderName = React.useMemo(() => {
    if (!activeFolderId) return null;
    function find(nodes: WsFolderTreeNode[]): string | null {
      for (const n of nodes) {
        if (String(n._id) === activeFolderId) return n.name;
        const r = find(n.children);
        if (r) return r;
      }
      return null;
    }
    return find(folderTree);
  }, [activeFolderId, folderTree]);

  /* ── filtered files ───────────────────────────────────────────────── */

  const filtered = React.useMemo(() => {
    return files.filter((f) => {
      if (fileTypeFilter !== 'all' && fileTypeOf(f) !== fileTypeFilter) return false;
      const ts = f.createdAt ? new Date(f.createdAt).getTime() : 0;
      if (dateFrom && ts < new Date(dateFrom).getTime()) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (ts > end.getTime()) return false;
      }
      return true;
    });
  }, [files, fileTypeFilter, dateFrom, dateTo]);

  /* ── selection ────────────────────────────────────────────────────── */

  const toggleSelect = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(() => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((f) => String(f._id ?? ''))));
    }
  }, [selected.size, filtered]);

  /* ── upload via SabFiles ─────────────────────────────────────────── */

  const handlePick = React.useCallback(
    async (pick: SabFilePick) => {
      const ext = pick.name.includes('.')
        ? pick.name.split('.').pop()?.toLowerCase()
        : undefined;
      const result = await uploadFile({
        filename: pick.name,
        display_name: pick.name,
        url: pick.url,
        size_bytes: pick.size,
        mime_type: pick.mime,
        extension: ext,
        folder_id: activeFolderId ?? undefined,
      });
      if (result.error) {
        toast({ title: 'Upload failed', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'File added', description: pick.name });
        void loadFolder(activeFolderId);
      }
    },
    [activeFolderId, loadFolder, toast],
  );

  /* ── delete single file ────────────────────────────────────────────── */

  const handleDeleteFile = React.useCallback(
    async (id: string) => {
      await deleteFile(id);
      toast({ title: 'File deleted' });
      void loadFolder(activeFolderId);
    },
    [activeFolderId, loadFolder, toast],
  );

  /* ── bulk delete ────────────────────────────────────────────────────── */

  const handleBulkDelete = React.useCallback(async () => {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      const result = await bulkDeleteFiles([...selected]);
      if (result.error) {
        toast({ title: 'Bulk delete failed', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: `Deleted ${result.processed} file(s)` });
        setSelected(new Set());
        void loadFolder(activeFolderId);
      }
    } finally {
      setBulkDeleting(false);
    }
  }, [selected, activeFolderId, loadFolder, toast]);

  /* ── create folder ─────────────────────────────────────────────────── */

  const handleCreateFolder = React.useCallback(async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const result = await createFolder(newFolderName.trim(), activeFolderId ?? undefined);
      if (result.error) {
        toast({ title: 'Create failed', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Folder created', description: newFolderName });
        setNewFolderName('');
        setShowNewFolder(false);
      }
    } finally {
      setCreatingFolder(false);
    }
  }, [newFolderName, activeFolderId, toast]);

  /* ── delete folder ─────────────────────────────────────────────────── */

  const handleDeleteFolder = React.useCallback(async () => {
    if (!activeFolderId) return;
    await deleteFileFolder(activeFolderId);
    toast({ title: 'Folder deleted' });
    setActiveFolderId(null);
    void loadFolder(null);
  }, [activeFolderId, loadFolder, toast]);

  /* ── export CSV ────────────────────────────────────────────────────── */

  const exportCsv = React.useCallback(() => {
    const headers = ['Name', 'Type', 'Size', 'Uploaded By', 'Uploaded At', 'URL'];
    const rows = filtered.map((f) => [
      f.display_name ?? f.filename,
      f.mime_type ?? f.extension ?? '',
      formatFileSize(f.size_bytes),
      f.uploaded_by_user_id ?? '',
      f.createdAt ? new Date(f.createdAt as string).toLocaleDateString() : '',
      f.url ?? '',
    ]);
    downloadCsv(`files-${dateStamp()}.csv`, headers, rows);
  }, [filtered]);

  /* ── render ─────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total folders" value={String(stats.totalFolders)} />
        <StatCard label="Total files" value={String(stats.totalFiles)} />
        <StatCard
          label="Storage used"
          value={formatFileSize(stats.totalStorageBytes)}
        />
        <StatCard label="Added this month" value={String(stats.addedThisMonth)} />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Folder tree */}
        <Card className="w-full shrink-0 p-0 lg:w-64">
          <div className="flex items-center justify-between border-b border-zoru-line px-3 py-2">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Folders
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowNewFolder((v) => !v)}
              title="New folder"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </div>

          {showNewFolder && (
            <div className="border-b border-zoru-line p-2 flex gap-1">
              <Input
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="h-7 text-[12px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreateFolder();
                }}
              />
              <Button
                size="sm"
                onClick={() => void handleCreateFolder()}
                disabled={creatingFolder}
                className="h-7 px-2"
              >
                {creatingFolder ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
              </Button>
            </div>
          )}

          <nav className="overflow-y-auto py-1" style={{ maxHeight: '480px' }}>
            <ul>
              <li>
                <button
                  type="button"
                  className={[
                    'flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-[13px] transition-colors',
                    activeFolderId === null
                      ? 'bg-zoru-primary/10 font-medium text-zoru-primary'
                      : 'text-zoru-ink hover:bg-zoru-surface-2',
                  ].join(' ')}
                  onClick={goToRoot}
                >
                  <FolderOpen className="h-4 w-4 shrink-0 text-zoru-ink-muted" />
                  All files (root)
                </button>
              </li>
              {folderTree.map((node) => (
                <FolderNode
                  key={String(node._id)}
                  node={node}
                  activeFolderId={activeFolderId}
                  onSelect={selectFolder}
                  depth={0}
                />
              ))}
            </ul>
          </nav>
        </Card>

        {/* File list */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-[13px] text-zoru-ink-muted">
            <button
              type="button"
              className="hover:text-zoru-ink hover:underline"
              onClick={goToRoot}
            >
              Files
            </button>
            {activeFolderName && (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-medium text-zoru-ink">{activeFolderName}</span>
              </>
            )}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <SabFilePickerButton
              onPick={(p) => void handlePick(p)}
              variant="default"
            >
              Upload file
            </SabFilePickerButton>

            {activeFolderId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleDeleteFolder()}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete folder
              </Button>
            )}

            <div className="flex items-center gap-1.5 ml-auto">
              <Label className="text-[11px]">Type</Label>
              <Select
                value={fileTypeFilter}
                onValueChange={(v) => setFileTypeFilter(v as FileTypeFilter)}
              >
                <ZoruSelectTrigger className="h-8 w-32 text-[12px]">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {(Object.keys(FILE_TYPE_LABELS) as FileTypeFilter[]).map((k) => (
                    <ZoruSelectItem key={k} value={k}>
                      {FILE_TYPE_LABELS[k]}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>

              <Input
                type="date"
                className="h-8 w-36 text-[12px]"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                title="From date"
              />
              <Input
                type="date"
                className="h-8 w-36 text-[12px]"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                title="To date"
              />
              {(fileTypeFilter !== 'all' || dateFrom || dateTo) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFileTypeFilter('all');
                    setDateFrom('');
                    setDateTo('');
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Bulk bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2 rounded border border-zoru-line bg-zoru-surface-2 px-3 py-2">
              <span className="text-[12.5px] text-zoru-ink">
                {selected.size} selected
              </span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void handleBulkDelete()}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={exportCsv}
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
          )}

          {/* Table */}
          <Card className="overflow-hidden p-0">
            {loading ? (
              <div className="flex items-center justify-center p-10">
                <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-[13px] text-zoru-ink-muted">
                No files in this location.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <ZoruTableHeader>
                    <ZoruTableRow className="hover:bg-transparent">
                      <ZoruTableHead className="w-8">
                        <input
                          type="checkbox"
                          checked={selected.size === filtered.length && filtered.length > 0}
                          onChange={toggleAll}
                          className="h-3.5 w-3.5"
                        />
                      </ZoruTableHead>
                      <ZoruTableHead>Name</ZoruTableHead>
                      <ZoruTableHead>Type</ZoruTableHead>
                      <ZoruTableHead>Size</ZoruTableHead>
                      <ZoruTableHead>Owner</ZoruTableHead>
                      <ZoruTableHead>Uploaded at</ZoruTableHead>
                      <ZoruTableHead />
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    {filtered.map((file) => {
                      const id = String(file._id ?? '');
                      return (
                        <ZoruTableRow key={id}>
                          <ZoruTableCell>
                            <input
                              type="checkbox"
                              checked={selected.has(id)}
                              onChange={() => toggleSelect(id)}
                              className="h-3.5 w-3.5"
                            />
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <div className="flex items-center gap-2">
                              <FileTypeIcon file={file} />
                              {file.url ? (
                                <a
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[13px] font-medium text-zoru-ink hover:underline"
                                >
                                  {file.display_name ?? file.filename}
                                </a>
                              ) : (
                                <span className="text-[13px] font-medium text-zoru-ink">
                                  {file.display_name ?? file.filename}
                                </span>
                              )}
                            </div>
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <Badge variant="secondary" className="text-[11px]">
                              {file.mime_type ?? file.extension ?? 'unknown'}
                            </Badge>
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                            {formatFileSize(file.size_bytes)}
                          </ZoruTableCell>
                          <ZoruTableCell className="font-mono text-[12px] text-zoru-ink-muted">
                            {file.uploaded_by_user_id
                              ? file.uploaded_by_user_id.slice(-6)
                              : '—'}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                            {file.createdAt
                              ? new Date(file.createdAt as string).toLocaleDateString()
                              : '—'}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void handleDeleteFile(id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                            </Button>
                          </ZoruTableCell>
                        </ZoruTableRow>
                      );
                    })}
                  </ZoruTableBody>
                </Table>
              </div>
            )}
          </Card>

          {/* Export bar (when nothing selected) */}
          {selected.size === 0 && filtered.length > 0 && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import {
  Badge,
  Button,
  Card,
  Input,
  Skeleton,
  Table,
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
  useRef,
  useTransition } from 'react';
import Link from 'next/link';
import {
  Folder,
  FolderOpen,
  Download,
  Trash2,
  Plus,
  FolderTree,
  File as FileIcon,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Eye,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';

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

gsap.registerPlugin(useGSAP);

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
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasChildren = node.children.length > 0;
  
  useGSAP(() => {
    if (!contentRef.current) return;
    if (isOpen) {
      gsap.to(contentRef.current, {
        height: 'auto',
        opacity: 1,
        duration: 0.3,
        ease: 'power2.out',
      });
    } else {
      gsap.to(contentRef.current, {
        height: 0,
        opacity: 0,
        duration: 0.3,
        ease: 'power2.out',
      });
    }
  }, [isOpen]);

  const id = String(node._id);
  const isActive = selected === id;
  return (
    <div>
      <div className={`flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${isActive ? 'bg-accent text-accent-foreground' : 'text-zoru-ink hover:bg-zoru-surface-2'}`} style={{ paddingLeft: 8 + depth * 12 }}>
        {hasChildren ? (
          <button type="button" onClick={() => setIsOpen(!isOpen)} className="p-0.5 hover:bg-black/5 rounded">
             {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : <span className="w-4" />}
        <button type="button" onClick={() => onSelect(id)} className="flex flex-1 items-center gap-2 truncate">
          {isActive ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
          <span className="truncate">{node.name}</span>
        </button>
      </div>
      {hasChildren ? (
        <div ref={contentRef} className="overflow-hidden" style={{ height: 0, opacity: 0 }}>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<WsFileStorage | null>(null);
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
        setSelectedFiles(new Set());
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

  const filteredFiles = useMemo(() => {
    return files.filter(f => 
      (f.filename || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (f.display_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [files, searchQuery]);

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

  const handleBatchDownload = async () => {
    const toDownload = files.filter(f => selectedFiles.has(String(f._id)) && f.url);
    if (toDownload.length === 0) return;
    
    toast({ title: `Downloading ${toDownload.length} files...` });
    
    for (const f of toDownload) {
      const a = document.createElement('a');
      a.href = f.url;
      a.download = f.filename || 'download';
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await new Promise(r => setTimeout(r, 300));
    }
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedFiles(new Set(filteredFiles.map(f => String(f._id))));
    } else {
      setSelectedFiles(new Set());
    }
  };

  const toggleFile = (id: string, checked: boolean) => {
    const next = new Set(selectedFiles);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedFiles(next);
  };

  return (
    <EntityListShell
      title="Files"
      subtitle="Centralized file storage — attach documents to contacts, deals, projects and more."
      primaryAction={
        <>
          <Link href="/dashboard/crm/files/folders">
            <Button variant="ghost">
              <FolderTree className="h-4 w-4" />
              Manage folders
            </Button>
          </Link>
          <Link href="/dashboard/crm/files/new">
            <Button>
              <Plus className="h-4 w-4" />
              Attach file
            </Button>
          </Link>
        </>
      }
    >

      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl overflow-hidden flex flex-col h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-sm truncate max-w-md">{previewFile.display_name || previewFile.filename}</h3>
              <div className="flex items-center gap-2">
                <a href={previewFile.url} download target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline flex items-center gap-1">
                  <Download className="h-4 w-4" /> Download
                </a>
                <button onClick={() => setPreviewFile(null)} className="p-1 hover:bg-gray-100 rounded ml-4">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 p-4 relative">
              {previewFile.mime_type?.startsWith('image/') || previewFile.extension?.match(/^(jpg|jpeg|png|gif|webp)$/i) ? (
                <img src={previewFile.url} className="w-full h-full object-contain" alt={previewFile.filename} />
              ) : previewFile.mime_type === 'application/pdf' || previewFile.extension === 'pdf' ? (
                <iframe src={previewFile.url} className="w-full h-full border-0" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <FileIcon className="h-16 w-16 mb-4 opacity-50" />
                  <p>Preview not available for this file type.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="p-6 h-fit sticky top-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13.5px] font-semibold text-zoru-ink">Folders</h3>
            <Badge variant="ghost">{tree.length}</Badge>
          </div>
          <div className="space-y-0.5 max-h-[60vh] overflow-y-auto pr-2">
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
        </Card>

        <Card className="p-6 overflow-hidden flex flex-col">
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-semibold text-zoru-ink">
                {selectedLabel}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                {filteredFiles.length} file{filteredFiles.length === 1 ? '' : 's'} in this scope.
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
                <Input 
                  placeholder="Search files..." 
                  className="pl-8" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {selectedFiles.size > 0 && (
                <Button variant="outline" onClick={handleBatchDownload}>
                  <Download className="h-4 w-4" />
                  Download ({selectedFiles.size})
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zoru-line flex-1">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                  <ZoruTableHead className="w-10">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300"
                      checked={filteredFiles.length > 0 && selectedFiles.size === filteredFiles.length}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Size</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Attached to</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted w-[180px]">Actions</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {isLoading && filteredFiles.length === 0 ? (
                  [...Array(4)].map((_, i) => (
                    <ZoruTableRow key={i} className="border-zoru-line">
                      <ZoruTableCell colSpan={6}>
                        <Skeleton className="h-10 w-full" />
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                ) : filteredFiles.length === 0 ? (
                  <ZoruTableRow className="border-zoru-line">
                    <ZoruTableCell
                      colSpan={6}
                      className="h-24 text-center text-[13px] text-zoru-ink-muted"
                    >
                      No files match your criteria.
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  filteredFiles.map((file) => (
                    <ZoruTableRow
                      key={String(file._id)}
                      className="border-zoru-line"
                    >
                      <ZoruTableCell>
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300"
                          checked={selectedFiles.has(String(file._id))}
                          onChange={(e) => toggleFile(String(file._id), e.target.checked)}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-zoru-line bg-zoru-surface-2 flex items-center justify-center">
                            {file.mime_type?.startsWith('image/') || file.extension?.match(/^(jpg|jpeg|png|gif|webp)$/i) ? (
                              <img src={file.url} alt={file.filename} className="h-full w-full object-cover" />
                            ) : file.mime_type === 'application/pdf' || file.extension === 'pdf' ? (
                              <div className="flex flex-col items-center justify-center">
                                <span className="text-[10px] font-bold text-red-500">PDF</span>
                              </div>
                            ) : (
                              <FileIcon className="h-5 w-5 text-zoru-ink-muted" />
                            )}
                          </div>
                          <div className="flex flex-col max-w-[200px] sm:max-w-xs">
                            <span className="text-[13px] font-medium text-zoru-ink truncate" title={file.display_name || file.filename}>
                              {file.display_name || file.filename}
                            </span>
                            <span className="text-[11.5px] text-zoru-ink-muted truncate" title={file.filename}>
                              {file.filename}
                            </span>
                          </div>
                        </div>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[12.5px] text-zoru-ink whitespace-nowrap">
                        {formatFileSize(file.size_bytes)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[12.5px] text-zoru-ink uppercase">
                        {file.extension || file.mime_type?.split('/')[1] || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {file.attached_to_type ? (
                          <Badge variant="danger">
                            {file.attached_to_type}
                          </Badge>
                        ) : (
                          <span className="text-[12.5px] text-zoru-ink-muted">
                            —
                          </span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <div className="flex items-center gap-3">
                          {file.url ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setPreviewFile(file)}
                                className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </button>
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[12px] font-medium text-accent-foreground hover:underline"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Get
                              </a>
                            </>
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
            </Table>
          </div>
        </Card>
      </div>
    </EntityListShell>
  );
}

'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  Skeleton,
  zoruSonnerToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  BookOpen,
  FileText,
  RefreshCw,
  Trash2,
  Upload,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  getKnowledgeDocs,
  uploadKnowledgeDoc,
  deleteKnowledgeDoc,
  } from '@/app/actions/facebook.actions';

import {
  SabFilePickerButton,
  type SabFilePick,
  } from '@/components/sabfiles';

/**
 * /dashboard/facebook/knowledge — Knowledge base for Messenger agents.
 *
 * Lists uploaded knowledge documents (title, type, size, status, createdAt)
 * and exposes an upload flow via SabFilePickerButton from
 * `@/components/sabfiles`. The picker is the project-wide source for file
 * inputs — we never expose a free-text URL paste here (see SabFiles policy).
 *
 * On pick, the selected SabFile URL + title are forwarded to
 * `uploadKnowledgeDoc` as a FormData blob. Delete is a confirm-step.
 */

import * as React from 'react';

interface KnowledgeDoc {
  _id?: string;
  id?: string;
  title?: string;
  fileType?: string;
  sizeKb?: number;
  status?: string;
  createdAt?: string;
  blobUrl?: string;
}

function docId(doc: KnowledgeDoc): string {
  return doc._id ?? doc.id ?? '';
}

function safeWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

function statusVariant(s?: string): 'success' | 'warning' | 'danger' | 'ghost' {
  if (!s) return 'ghost';
  const v = s.toLowerCase();
  if (v === 'ready' || v === 'indexed' || v === 'active') return 'success';
  if (v === 'processing' || v === 'pending') return 'warning';
  if (v === 'failed' || v === 'error') return 'danger';
  return 'ghost';
}

function fmtSize(kb?: number): string {
  if (!kb || kb <= 0) return '—';
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function KnowledgeBasePage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const [pendingFile, setPendingFile] = useState<SabFilePick | null>(null);
  const [title, setTitle] = useState('');
  const [submitting, startSubmit] = useTransition();

  const [confirmDelete, setConfirmDelete] = useState<KnowledgeDoc | null>(null);
  const [deleting, startDelete] = useTransition();

  const refresh = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const res = await getKnowledgeDocs(projectId);
      if (res.error) {
        setError(res.error);
        setDocs([]);
        return;
      }
      setError(null);
      setDocs((res.docs ?? []) as KnowledgeDoc[]);
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onPick = (pick: SabFilePick) => {
    setPendingFile(pick);
    setTitle(pick.name.replace(/\.[^.]+$/, ''));
  };

  const onUpload = () => {
    if (!pendingFile || !projectId) return;
    const finalTitle = title.trim() || pendingFile.name;
    startSubmit(async () => {
      const fd = new FormData();
      fd.set('projectId', projectId);
      fd.set('title', finalTitle);
      // The rust action expects either parsed text content or a blobUrl. We
      // ship the SabFile URL as `blobUrl` and pass the name as `content`
      // fallback so the action's required-field check passes.
      fd.set('content', pendingFile.name);
      fd.set('docType', pendingFile.mime ?? 'file');
      fd.set('blobUrl', pendingFile.url);
      const res = await uploadKnowledgeDoc(undefined, fd);
      if (res.error) {
        zoruSonnerToast.error(res.error);
        return;
      }
      zoruSonnerToast.success(res.message ?? 'Document added.');
      setPendingFile(null);
      setTitle('');
      refresh();
    });
  };

  const onConfirmDelete = () => {
    if (!confirmDelete) return;
    const id = docId(confirmDelete);
    if (!id) return;
    startDelete(async () => {
      const res = await deleteKnowledgeDoc(id);
      if (!res.success) {
        zoruSonnerToast.error(res.error ?? 'Could not delete document.');
        return;
      }
      zoruSonnerToast.success('Document deleted.');
      setConfirmDelete(null);
      refresh();
    });
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<BookOpen />}
          title="No project selected"
          description="Pick a project to manage its knowledge base."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">Meta Suite</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Knowledge Base</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-zoru-ink">Knowledge Base</h1>
          <p className="mt-1 text-sm text-zoru-ink-muted">
            Documents and answer sources used by Messenger agents and
            automation flows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
            Refresh
          </Button>
          <SabFilePickerButton
            accept="document"
            onPick={onPick}
            variant="default"
          >
            <Upload className="mr-2 h-4 w-4" /> Add document
          </SabFilePickerButton>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load documents</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      )}

      {loading && docs.length === 0 ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : docs.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title="No knowledge documents yet"
          description="Upload PDFs, text files, or docs to give your agents source material."
          action={
            <SabFilePickerButton accept="document" onPick={onPick} variant="default">
              <Upload className="mr-2 h-4 w-4" /> Add document
            </SabFilePickerButton>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {docs.map((d) => {
            const id = docId(d);
            return (
              <li key={id || d.title}>
                <Card className="flex items-center gap-3 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zoru-surface-2 text-zoru-ink-muted">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="line-clamp-1 text-base text-zoru-ink">
                      {d.title ?? '(untitled)'}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zoru-ink-muted">
                      {d.fileType ? <span>{d.fileType}</span> : null}
                      <span>{fmtSize(d.sizeKb)}</span>
                      {d.createdAt ? <span>{safeWhen(d.createdAt)}</span> : null}
                    </div>
                  </div>
                  {d.status ? (
                    <Badge variant={statusVariant(d.status)} className="capitalize">
                      {d.status}
                    </Badge>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete document"
                    onClick={() => setConfirmDelete(d)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Upload review dialog (opens after picking a SabFile) ── */}
      <Dialog
        open={!!pendingFile}
        onOpenChange={(open) => {
          if (!open) {
            setPendingFile(null);
            setTitle('');
          }
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Add to knowledge base</ZoruDialogTitle>
            <ZoruDialogDescription>
              Confirm a title for the selected file. The file is sourced from
              your SabFiles library.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          {pendingFile ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-md border border-zoru-line bg-zoru-surface p-3">
                <FileText className="h-5 w-5 text-zoru-ink-muted" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm text-zoru-ink">
                    {pendingFile.name}
                  </p>
                  <p className="text-xs text-zoru-ink-muted">
                    {pendingFile.mime ?? 'file'}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kb-title">Title</Label>
                <Input
                  id="kb-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Refund policy"
                  required
                />
              </div>
            </div>
          ) : null}
          <ZoruDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPendingFile(null);
                setTitle('');
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={onUpload} disabled={submitting}>
              {submitting ? 'Uploading…' : 'Add document'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <ZoruAlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete this document?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              &quot;{confirmDelete?.title}&quot; will be removed from the
              knowledge base. Active agents will no longer reference it.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={deleting}>Keep</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={onConfirmDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}

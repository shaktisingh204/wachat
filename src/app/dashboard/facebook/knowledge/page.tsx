'use client';

/**
 * /dashboard/facebook/knowledge — Knowledge base / FAQ manager (ZoruUI).
 *
 * List with create/edit/delete dialogs (delete via destructive
 * AlertDialog). Same data + handlers as the original wabasimplify
 * version (getKnowledgeDocs, uploadKnowledgeDoc, deleteKnowledgeDoc).
 */

import * as React from 'react';
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useFormStatus } from 'react-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  BookCopy,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';

import {
  deleteKnowledgeDoc,
  getKnowledgeDocs,
  uploadKnowledgeDoc,
} from '@/app/actions/facebook.actions';

import {
  ZoruAlert,
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
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  ZoruStatCard,
  ZoruTextarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';

type KnowledgeDoc = {
  _id: string;
  title: string;
  content: string;
  docType: string;
  charCount?: number;
  createdAt?: string | Date;
};

const initialFormState: { message?: string; error?: string } = {
  message: undefined,
  error: undefined,
};

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruSkeleton className="h-3 w-52" />
      <div className="mt-5 flex items-center justify-between">
        <ZoruSkeleton className="h-9 w-72" />
        <ZoruSkeleton className="h-9 w-36" />
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <ZoruSkeleton className="h-28" />
        <ZoruSkeleton className="h-28" />
        <ZoruSkeleton className="h-28" />
      </div>
      <ZoruSkeleton className="mt-6 h-72" />
    </div>
  );
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {editing ? 'Save changes' : 'Create document'}
    </ZoruButton>
  );
}

export default function KnowledgePage() {
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeDoc | null>(null);
  const [docType, setDocType] = useState<string>('text');
  const [confirmDelete, setConfirmDelete] = useState<KnowledgeDoc | null>(
    null,
  );

  const [formState, formAction] = useActionState(
    uploadKnowledgeDoc,
    initialFormState,
  );

  useEffect(() => {
    setProjectId(localStorage.getItem('activeProjectId'));
  }, []);

  const fetchDocs = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const { docs: fetched, error: fetchError } =
        await getKnowledgeDocs(projectId);
      if (fetchError) {
        setError(fetchError);
      } else if (fetched) {
        setError(null);
        setDocs(fetched as KnowledgeDoc[]);
      }
    });
  }, [projectId]);

  useEffect(() => {
    fetchDocs();
  }, [projectId, fetchDocs]);

  useEffect(() => {
    if (formState.message) {
      toast({ title: 'Saved', description: formState.message });
      setFormOpen(false);
      setEditing(null);
      setDocType('text');
      formRef.current?.reset();
      fetchDocs();
    }
    if (formState.error) {
      toast({
        title: 'Error',
        description: formState.error,
        variant: 'destructive',
      });
    }
  }, [formState, toast, fetchDocs]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setDocType('text');
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((doc: KnowledgeDoc) => {
    setEditing(doc);
    setDocType(doc.docType || 'text');
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback(() => {
    if (!confirmDelete) return;
    const id = confirmDelete._id;
    startDelete(async () => {
      const res = await deleteKnowledgeDoc(id);
      if (res.error) {
        toast({
          title: 'Could not delete',
          description: res.error,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Document deleted' });
        fetchDocs();
      }
      setConfirmDelete(null);
    });
  }, [confirmDelete, toast, fetchDocs]);

  const totalChars = useMemo(
    () => docs.reduce((sum, d) => sum + (d.charCount || 0), 0),
    [docs],
  );
  const faqCount = useMemo(
    () => docs.filter((d) => d.docType === 'faq').length,
    [docs],
  );

  if (isLoading && docs.length === 0) return <PageSkeleton />;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Knowledge</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>AI</ZoruPageEyebrow>
          <ZoruPageTitle>Knowledge base</ZoruPageTitle>
          <ZoruPageDescription>
            Manage the knowledge sources your Facebook AI agents quote from
            when answering messages.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton size="sm" onClick={openCreate}>
            <Plus /> Add document
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {!projectId ? (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>No project selected</ZoruAlertTitle>
          <ZoruAlertDescription>
            Select a project from the dashboard to manage its knowledge base.
          </ZoruAlertDescription>
        </ZoruAlert>
      ) : error ? (
        <ZoruAlert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Could not load documents</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      ) : (
        <>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <ZoruStatCard
              label="Documents"
              value={docs.length.toLocaleString()}
              period="In knowledge base"
              icon={<BookCopy />}
            />
            <ZoruStatCard
              label="FAQ entries"
              value={faqCount.toLocaleString()}
              period="Question/answer style"
              icon={<FileText />}
            />
            <ZoruStatCard
              label="Total characters"
              value={totalChars.toLocaleString()}
              period="Across all docs"
              icon={<FileText />}
            />
          </div>

          {docs.length > 0 ? (
            <ZoruCard className="mt-6 p-0">
              <ul className="divide-y divide-zoru-line">
                {docs.map((doc) => {
                  const isOpen = expandedId === doc._id;
                  return (
                    <li key={doc._id}>
                      <div
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 transition-colors',
                          isOpen
                            ? 'bg-zoru-surface'
                            : 'hover:bg-zoru-surface',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(isOpen ? null : doc._id)
                          }
                          aria-label={isOpen ? 'Collapse' : 'Expand'}
                          className="flex flex-1 items-center gap-3 text-left"
                        >
                          {isOpen ? (
                            <ChevronUp className="h-4 w-4 shrink-0 text-zoru-ink-muted" />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-zoru-ink-muted" />
                          )}
                          <span className="text-[13px] text-zoru-ink">
                            {doc.title}
                          </span>
                          <ZoruBadge variant="outline">
                            {doc.docType}
                          </ZoruBadge>
                          <span className="ml-auto mr-3 text-[11.5px] text-zoru-ink-muted">
                            {(doc.charCount || 0).toLocaleString()} chars
                          </span>
                          <span className="text-[11px] text-zoru-ink-subtle">
                            {doc.createdAt
                              ? formatDistanceToNow(
                                  new Date(doc.createdAt),
                                  { addSuffix: true },
                                )
                              : ''}
                          </span>
                        </button>
                        <ZoruButton
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit document"
                          onClick={() => openEdit(doc)}
                        >
                          <Pencil />
                        </ZoruButton>
                        <ZoruButton
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete document"
                          onClick={() => setConfirmDelete(doc)}
                        >
                          <Trash2 />
                        </ZoruButton>
                      </div>
                      {isOpen ? (
                        <div className="px-4 pb-4">
                          <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3 text-[12.5px] text-zoru-ink">
                            {doc.content}
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </ZoruCard>
          ) : (
            <ZoruEmptyState
              className="mt-6"
              icon={<BookCopy />}
              title="No documents yet"
              description="Add knowledge documents your AI agents can quote from when replying to comments and messages."
              action={
                <ZoruButton size="sm" onClick={openCreate}>
                  <Plus /> Add document
                </ZoruButton>
              }
            />
          )}
        </>
      )}

      {/* ── Create / edit dialog ── */}
      <ZoruDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) {
            setEditing(null);
            setDocType('text');
          }
        }}
      >
        <ZoruDialogContent className="sm:max-w-lg">
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {editing ? 'Edit document' : 'New document'}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              {editing
                ? 'Submitting saves a new revision — older content is replaced.'
                : 'Add a single knowledge source the AI can reference.'}
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <form
            ref={formRef}
            action={formAction}
            className="flex flex-col gap-4"
          >
            <input
              type="hidden"
              name="projectId"
              value={projectId ?? ''}
            />
            <input type="hidden" name="docType" value={docType} />
            {editing ? (
              <input type="hidden" name="docId" value={editing._id} />
            ) : null}

            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="kb-title">Title</ZoruLabel>
              <ZoruInput
                id="kb-title"
                name="title"
                required
                placeholder="e.g. Return policy"
                defaultValue={editing?.title ?? ''}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <ZoruLabel>Document type</ZoruLabel>
              <ZoruSelect value={docType} onValueChange={setDocType}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="text">Text</ZoruSelectItem>
                  <ZoruSelectItem value="faq">FAQ</ZoruSelectItem>
                  <ZoruSelectItem value="policy">Policy</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            <div className="flex flex-col gap-1.5">
              <ZoruLabel htmlFor="kb-content">Content</ZoruLabel>
              <ZoruTextarea
                id="kb-content"
                name="content"
                required
                rows={8}
                placeholder="Paste your document content here…"
                defaultValue={editing?.content ?? ''}
              />
            </div>

            <ZoruDialogFooter>
              <ZoruButton
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </ZoruButton>
              <SubmitButton editing={!!editing} />
            </ZoruDialogFooter>
          </form>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* ── Delete confirm ── */}
      <ZoruAlertDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Delete &ldquo;{confirmDelete?.title}&rdquo;?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes the document from the knowledge base.
              Agents will stop quoting from it on the next reply.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={isDeleting}>
              Cancel
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              destructive
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}

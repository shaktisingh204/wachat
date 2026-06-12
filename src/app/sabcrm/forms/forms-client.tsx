'use client';

/**
 * SabCRM — Forms list client (`/sabcrm/forms`), 20ui.
 *
 * Renders the project's web-to-lead forms as a 20ui table with:
 *   - "New form" minimal builder v1 (name, description, ordered fields
 *     [label / key / type / required / select options / record-key
 *     mapping], target object, success message / redirect, webhook URL +
 *     secret, status) → `saveSabcrmForm`. The same dialog edits an
 *     existing form (full doc re-fetched via `getSabcrmForm`).
 *   - Copy-public-link per row (`/embed/sabcrm-form/{slug|id}`).
 *   - Submission count linking to the form's submissions page.
 *   - Per-row delete behind an AlertDialog confirm → `deleteSabcrmForm`.
 *
 * Data flows down from the server page (`page.tsx`); after a mutation the
 * action revalidates `/sabcrm/forms` and the client calls
 * `router.refresh()` so the table re-renders from fresh server props.
 *
 * ONLY `@/components/sabcrm/20ui` barrel imports (repo rule); auth /
 * onboarding / RBAC are enforced by the SabCRM layout, and every action
 * re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ClipboardList,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

import {
  Alert,
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SelectField,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
  type BadgeTone,
  type SelectOption,
} from '@/components/sabcrm/20ui';

import {
  deleteSabcrmForm,
  getSabcrmForm,
  saveSabcrmForm,
} from '@/app/actions/sabcrm-forms.actions';
import type {
  SabcrmFormBuilderField,
  SabcrmFormBuilderFieldType,
  SabcrmFormRow,
} from '@/app/actions/sabcrm-forms.actions.types';

import '@/components/sabcrm/20ui/surface-crm-base.css';

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: 'neutral',
  published: 'success',
  archived: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
];

const FIELD_TYPE_OPTIONS: SelectOption[] = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'textarea', label: 'Long text' },
  { value: 'select', label: 'Select' },
];

/** `2026-06-11T00:00:00Z` → `11 Jun 2026` (deterministic, no TZ drift). */
function formatDate(iso: string): string {
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split('-');
  if (!y || !m || !d) return day || '—';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const month = months[Number(m) - 1] ?? m;
  return `${Number(d)} ${month} ${y}`;
}

function publicLink(publicId: string): string {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/embed/sabcrm-form/${encodeURIComponent(publicId)}`;
}

/** Slugify a label into a stable field key. */
function keyFromLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// ---------------------------------------------------------------------------
// Builder state
// ---------------------------------------------------------------------------

interface BuilderFieldState {
  /** Local list key, NOT the wire key. */
  uid: number;
  label: string;
  key: string;
  /** True until the user edits the key directly (key tracks the label). */
  keyAuto: boolean;
  type: SabcrmFormBuilderFieldType;
  required: boolean;
  /** One option per line (select only). */
  optionsText: string;
  mapping: string;
}

interface BuilderState {
  id?: string;
  name: string;
  description: string;
  fields: BuilderFieldState[];
  targetObject: string;
  successMessage: string;
  redirectUrl: string;
  webhookUrl: string;
  webhookSecret: string;
  status: string;
}

let nextUid = 1;

function emptyField(): BuilderFieldState {
  return {
    uid: nextUid++,
    label: '',
    key: '',
    keyAuto: true,
    type: 'text',
    required: false,
    optionsText: '',
    mapping: '',
  };
}

function emptyBuilder(): BuilderState {
  return {
    name: '',
    description: '',
    fields: [
      { ...emptyField(), label: 'Name', key: 'name', required: true },
      { ...emptyField(), label: 'Email', key: 'email', type: 'email', required: true },
    ],
    targetObject: 'leads',
    successMessage: '',
    redirectUrl: '',
    webhookUrl: '',
    webhookSecret: '',
    status: 'published',
  };
}

// ---------------------------------------------------------------------------
// Builder dialog
// ---------------------------------------------------------------------------

interface FormBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-populated when editing; null for "New form". */
  initial: BuilderState | null;
  onSaved: () => void;
}

function FormBuilderDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: FormBuilderDialogProps): React.JSX.Element {
  const [state, setState] = React.useState<BuilderState>(emptyBuilder);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setState(initial ?? emptyBuilder());
      setError(null);
    }
  }, [open, initial]);

  const patch = (p: Partial<BuilderState>): void =>
    setState((s) => ({ ...s, ...p }));

  const patchField = (uid: number, p: Partial<BuilderFieldState>): void =>
    setState((s) => ({
      ...s,
      fields: s.fields.map((f) => (f.uid === uid ? { ...f, ...p } : f)),
    }));

  const moveField = (uid: number, dir: -1 | 1): void =>
    setState((s) => {
      const idx = s.fields.findIndex((f) => f.uid === uid);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= s.fields.length) return s;
      const fields = [...s.fields];
      const [row] = fields.splice(idx, 1);
      fields.splice(to, 0, row);
      return { ...s, fields };
    });

  const removeField = (uid: number): void =>
    setState((s) => ({
      ...s,
      fields: s.fields.filter((f) => f.uid !== uid),
    }));

  const handleSubmit = (): void => {
    if (!state.name.trim()) {
      setError('A form name is required.');
      return;
    }
    if (state.fields.length === 0) {
      setError('Add at least one field.');
      return;
    }
    for (const f of state.fields) {
      if (!f.label.trim() && !f.key.trim()) {
        setError('Every field needs a label.');
        return;
      }
      if (
        f.type === 'select' &&
        f.optionsText.split('\n').every((o) => !o.trim())
      ) {
        setError(`Select field "${f.label || f.key}" needs at least one option.`);
        return;
      }
    }
    setError(null);

    const fields: SabcrmFormBuilderField[] = state.fields.map((f) => ({
      key: f.key.trim() || keyFromLabel(f.label),
      label: f.label.trim() || f.key.trim(),
      type: f.type,
      required: f.required,
      options:
        f.type === 'select'
          ? f.optionsText.split('\n').map((o) => o.trim()).filter(Boolean)
          : undefined,
      mapping: f.mapping.trim() || undefined,
    }));

    startTransition(async () => {
      const res = await saveSabcrmForm({
        id: state.id,
        name: state.name.trim(),
        description: state.description.trim() || undefined,
        fields,
        targetObject: state.targetObject.trim() || 'leads',
        successMessage: state.successMessage.trim() || undefined,
        redirectUrl: state.redirectUrl.trim() || undefined,
        webhookUrl: state.webhookUrl.trim() || undefined,
        webhookSecret: state.webhookSecret.trim() || undefined,
        status: state.status,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      onSaved();
    });
  };

  const editing = !!state.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="form-builder-desc"
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit form' : 'New form'}</DialogTitle>
          <DialogDescription id="form-builder-desc">
            {editing
              ? 'Update the form definition. The public link keeps working.'
              : 'Define the fields visitors fill in. Submissions land in this workspace and can be converted into records.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label="Form name" required>
              <Input
                value={state.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Contact us"
                autoFocus
                disabled={pending}
              />
            </Field>

            <Field label="Description">
              <Input
                value={state.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Shown under the form title"
                disabled={pending}
              />
            </Field>

            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm font-medium">Fields</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                iconLeft={Plus}
                onClick={() =>
                  setState((s) => ({ ...s, fields: [...s.fields, emptyField()] }))
                }
                disabled={pending}
              >
                Add field
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {state.fields.map((f, idx) => (
                <div
                  key={f.uid}
                  className="rounded-md border border-[var(--st-border)] p-3"
                >
                  <div className="grid grid-cols-12 items-end gap-2">
                    <div className="col-span-12 sm:col-span-4">
                      <Field label="Label">
                        <Input
                          value={f.label}
                          onChange={(e) =>
                            patchField(f.uid, {
                              label: e.target.value,
                              ...(f.keyAuto
                                ? { key: keyFromLabel(e.target.value) }
                                : {}),
                            })
                          }
                          placeholder="Email"
                          disabled={pending}
                        />
                      </Field>
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <Field label="Key">
                        <Input
                          value={f.key}
                          onChange={(e) =>
                            patchField(f.uid, {
                              key: e.target.value,
                              keyAuto: false,
                            })
                          }
                          placeholder="email"
                          disabled={pending}
                        />
                      </Field>
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <Field label="Type">
                        <SelectField
                          value={f.type}
                          onChange={(v) =>
                            patchField(f.uid, {
                              type: (v ?? 'text') as SabcrmFormBuilderFieldType,
                            })
                          }
                          options={FIELD_TYPE_OPTIONS}
                          disabled={pending}
                        />
                      </Field>
                    </div>
                    <div className="col-span-12 flex items-center justify-end gap-1 sm:col-span-2">
                      <IconButton
                        icon={ArrowUp}
                        label={`Move ${f.label || 'field'} up`}
                        onClick={() => moveField(f.uid, -1)}
                        disabled={pending || idx === 0}
                      />
                      <IconButton
                        icon={ArrowDown}
                        label={`Move ${f.label || 'field'} down`}
                        onClick={() => moveField(f.uid, 1)}
                        disabled={pending || idx === state.fields.length - 1}
                      />
                      <IconButton
                        icon={Trash2}
                        label={`Remove ${f.label || 'field'}`}
                        onClick={() => removeField(f.uid)}
                        disabled={pending}
                      />
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-12 items-end gap-2">
                    {f.type === 'select' ? (
                      <div className="col-span-12 sm:col-span-6">
                        <Field label="Options (one per line)">
                          <Textarea
                            value={f.optionsText}
                            onChange={(e) =>
                              patchField(f.uid, { optionsText: e.target.value })
                            }
                            rows={3}
                            placeholder={'Sales\nSupport'}
                            disabled={pending}
                          />
                        </Field>
                      </div>
                    ) : null}
                    <div
                      className={
                        f.type === 'select'
                          ? 'col-span-12 sm:col-span-4'
                          : 'col-span-12 sm:col-span-6'
                      }
                    >
                      <Field
                        label="Record key"
                        help="data.* key on the converted record (defaults to the field key)"
                      >
                        <Input
                          value={f.mapping}
                          onChange={(e) =>
                            patchField(f.uid, { mapping: e.target.value })
                          }
                          placeholder={f.key || 'name'}
                          disabled={pending}
                        />
                      </Field>
                    </div>
                    <div className="col-span-12 pb-1 sm:col-span-2">
                      <Checkbox
                        checked={f.required}
                        onChange={(e) =>
                          patchField(f.uid, { required: e.target.checked })
                        }
                        label="Required"
                        disabled={pending}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-12 gap-3">
              <div className="col-span-6">
                <Field
                  label="Target object"
                  help="Object slug submissions convert into"
                >
                  <Input
                    value={state.targetObject}
                    onChange={(e) => patch({ targetObject: e.target.value })}
                    placeholder="leads"
                    disabled={pending}
                  />
                </Field>
              </div>
              <div className="col-span-6">
                <Field label="Status">
                  <SelectField
                    value={state.status}
                    onChange={(v) => patch({ status: v ?? 'published' })}
                    options={STATUS_OPTIONS}
                    disabled={pending}
                  />
                </Field>
              </div>
            </div>

            <Field label="Success message">
              <Input
                value={state.successMessage}
                onChange={(e) => patch({ successMessage: e.target.value })}
                placeholder="Thank you! We'll be in touch."
                disabled={pending}
              />
            </Field>

            <Field
              label="Redirect URL"
              help="When set, wins over the success message"
            >
              <Input
                type="url"
                value={state.redirectUrl}
                onChange={(e) => patch({ redirectUrl: e.target.value })}
                placeholder="https://example.com/thanks"
                disabled={pending}
              />
            </Field>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-7">
                <Field
                  label="Webhook URL"
                  help="POSTed on every submission"
                >
                  <Input
                    type="url"
                    value={state.webhookUrl}
                    onChange={(e) => patch({ webhookUrl: e.target.value })}
                    placeholder="https://example.com/hooks/form"
                    disabled={pending}
                  />
                </Field>
              </div>
              <div className="col-span-5">
                <Field
                  label="Webhook secret"
                  help="Signs X-Form-Webhook-Signature"
                >
                  <Input
                    value={state.webhookSecret}
                    onChange={(e) => patch({ webhookSecret: e.target.value })}
                    placeholder="whsec_…"
                    disabled={pending}
                  />
                </Field>
              </div>
            </div>

            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={pending}>
              {editing ? 'Save changes' : 'Create form'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Copy-link button
// ---------------------------------------------------------------------------

function CopyLinkButton({ publicId, name }: { publicId: string; name: string }): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(publicLink(publicId));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (permissions / non-secure context); ignore.
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      iconLeft={copied ? Check : Link2}
      aria-label={`Copy public link for ${name}`}
      onClick={copy}
    >
      {copied ? 'Copied' : 'Copy link'}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Page client
// ---------------------------------------------------------------------------

export interface FormsClientProps {
  initialRows: SabcrmFormRow[];
  /** Non-null when the list fetch failed (e.g. the Rust engine is down). */
  initialError: string | null;
}

export function FormsClient({
  initialRows,
  initialError,
}: FormsClientProps): React.JSX.Element {
  const router = useRouter();
  const [builderOpen, setBuilderOpen] = React.useState(false);
  const [builderInitial, setBuilderInitial] =
    React.useState<BuilderState | null>(null);
  const [rowError, setRowError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] =
    React.useState<SabcrmFormRow | null>(null);
  const [deleting, startDelete] = React.useTransition();
  const [, startLoadForm] = React.useTransition();

  const refresh = React.useCallback(() => {
    router.refresh();
  }, [router]);

  const openNew = (): void => {
    setBuilderInitial(null);
    setBuilderOpen(true);
  };

  const openEdit = (row: SabcrmFormRow): void => {
    setRowError(null);
    startLoadForm(async () => {
      const res = await getSabcrmForm(row.id);
      if (!res.ok) {
        setRowError(res.error);
        return;
      }
      const doc = res.data;
      const post = doc.settings?.postSubmit;
      setBuilderInitial({
        id: doc._id,
        name: doc.name,
        description:
          typeof doc.settings?.description === 'string'
            ? doc.settings.description
            : '',
        fields: (doc.fields ?? []).map((f) => ({
          uid: nextUid++,
          label: f.label || f.name,
          key: f.name,
          keyAuto: false,
          type: (['text', 'email', 'phone', 'textarea', 'select'].includes(
            f.type ?? '',
          )
            ? f.type
            : 'text') as SabcrmFormBuilderFieldType,
          required: !!f.required,
          optionsText: (f.options ?? []).join('\n'),
          mapping: f.mapping ?? '',
        })),
        targetObject:
          typeof doc.settings?.targetObject === 'string'
            ? doc.settings.targetObject
            : 'leads',
        successMessage: post?.successMessage ?? '',
        redirectUrl: post?.redirectUrl ?? '',
        webhookUrl: post?.webhook?.url ?? '',
        webhookSecret: post?.webhook?.secret ?? '',
        status: doc.status === 'draft' ? 'draft' : 'published',
      });
      setBuilderOpen(true);
    });
  };

  const handleDelete = (): void => {
    const target = confirmDelete;
    if (!target) return;
    setRowError(null);
    startDelete(async () => {
      const res = await deleteSabcrmForm(target.id);
      if (!res.ok) {
        setRowError(res.error);
        return;
      }
      setConfirmDelete(null);
      refresh();
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1040px] px-6 pb-12 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Forms</PageTitle>
          <PageDescription>
            Web-to-lead forms for this workspace — share the public link and
            convert submissions into records.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={openNew}>
            New form
          </Button>
        </PageActions>
      </PageHeader>

      {initialError ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            Couldn&apos;t load forms: {initialError}
          </Alert>
        </div>
      ) : null}

      {rowError ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            {rowError}
          </Alert>
        </div>
      ) : null}

      {!initialError && initialRows.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={ClipboardList}
            title="No forms yet"
            description="Create your first form to start capturing leads from your website."
            action={
              <Button variant="primary" iconLeft={Plus} onClick={openNew}>
                New form
              </Button>
            }
          />
        </div>
      ) : null}

      {initialRows.length > 0 ? (
        <div className="mt-4">
          <Table hover>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th align="right">Submissions</Th>
                <Th>Created</Th>
                <Th align="right" width={280}>
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {initialRows.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-medium">{row.name}</span>
                      {row.description ? (
                        <span className="text-xs text-[var(--st-text-secondary)]">
                          {row.description}
                        </span>
                      ) : null}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[row.status] ?? 'neutral'} dot>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <Link
                      href={`/sabcrm/forms/${row.id}/submissions`}
                      className="underline-offset-2 hover:underline"
                    >
                      {row.submissionCount}
                    </Link>
                  </Td>
                  <Td>{formatDate(row.createdAt)}</Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      <CopyLinkButton publicId={row.publicId} name={row.name} />
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Pencil}
                        aria-label={`Edit form ${row.name}`}
                        onClick={() => openEdit(row)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Trash2}
                        aria-label={`Delete form ${row.name}`}
                        onClick={() => {
                          setRowError(null);
                          setConfirmDelete(row);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      ) : null}

      <FormBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        initial={builderInitial}
        onSaved={refresh}
      />

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(next) => {
          if (!next && !deleting) {
            setConfirmDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {confirmDelete?.name ?? 'this form'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The form is archived and its public link stops accepting
              submissions. Existing submissions are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Delete form
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

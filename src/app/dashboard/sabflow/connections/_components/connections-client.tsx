'use client';

/**
 * ConnectionsClient — SabFlow's credentials manager.
 *
 * Connections IS the credentials store: every card below is a real
 * credential from the SabFlow credentials backend.
 *
 *   GET    /api/sabflow/credentials            → { credentials: MaskedCredential[] }
 *   POST   /api/sabflow/credentials            { type, name, data } → 201 { id }
 *   PATCH  /api/sabflow/credentials/[id]       { name?, data? }     → { ok: true }
 *   DELETE /api/sabflow/credentials/[id]       → { ok: true }
 *   POST   /api/sabflow/credentials/test       { type, data } → { ok, info?/error?/skipped? }
 *   POST   /api/sabflow/credentials/[id]/test  → { ok, error? }   (rate-limited)
 *
 * Secrets are always masked by the API (MASK_PLACEHOLDER); on edit, unchanged
 * masked values are skipped server-side so we never clobber a stored secret.
 */

import * as React from 'react';
import Link from 'next/link';
import { m } from 'motion/react';
import {
  Calendar,
  CreditCard,
  Database,
  FlaskConical,
  GitBranch,
  HardDrive,
  KeyRound,
  ListChecks,
  Mail,
  MessageSquare,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Workflow,
  X,
} from 'lucide-react';

import {
  Alert,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardBody,
  Combobox,
  type ComboboxOption,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  Skeleton,
  Switch,
  useToast,
} from '@/components/sabcrm/20ui';

import {
  CREDENTIAL_CATEGORY_LABEL,
  CREDENTIAL_FIELD_SCHEMAS,
  CREDENTIAL_TYPES,
  CREDENTIAL_TYPE_CATEGORY,
  CREDENTIAL_TYPE_LABEL,
  MASK_PLACEHOLDER,
  type CredentialCategory,
  type CredentialField,
  type CredentialType,
} from '@/lib/sabflow/credentials/types';
import { fadeInUp, staggerContainer } from '@/lib/motion';

/* ── Types (mirror API response shapes) ─────────────────────────────────── */

type ApiCredential = {
  id: string;
  workspaceId: string;
  type: CredentialType;
  name: string;
  /** Every value is MASK_PLACEHOLDER — the API never returns secrets. */
  data: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

type TestResult =
  | { ok: true; info?: string; skipped?: boolean; message?: string }
  | { ok: false; error?: string };

type SavedTestState = 'ok' | 'failed';

/* ── Category presentation ──────────────────────────────────────────────── */

const CATEGORY_ICON: Record<CredentialCategory, React.ComponentType<{ className?: string }>> = {
  ai: Sparkles,
  email: Mail,
  communication: MessageSquare,
  storage: HardDrive,
  crm: Users,
  productivity: ListChecks,
  code: GitBranch,
  commerce: CreditCard,
  scheduling: Calendar,
  automation: Workflow,
  database: Database,
  generic: KeyRound,
};

const TYPE_OPTIONS: ComboboxOption[] = CREDENTIAL_TYPES.map((t) => ({
  value: t,
  label: CREDENTIAL_TYPE_LABEL[t],
  description: CREDENTIAL_CATEGORY_LABEL[CREDENTIAL_TYPE_CATEGORY[t]],
}));

function schemaFor(type: CredentialType | null): CredentialField[] {
  if (!type || type === 'custom') return [];
  return CREDENTIAL_FIELD_SCHEMAS[type] ?? [];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ── Dynamic credential form (shared by create + edit) ──────────────────── */

type CustomPair = { key: string; value: string };

function CredentialFieldsForm({
  type,
  values,
  onValueChange,
  customPairs,
  onCustomPairsChange,
  isEdit,
}: {
  type: CredentialType | null;
  values: Record<string, string>;
  onValueChange: (key: string, value: string) => void;
  customPairs: CustomPair[];
  onCustomPairsChange: (pairs: CustomPair[]) => void;
  isEdit: boolean;
}) {
  if (!type) return null;

  if (type === 'custom') {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[12px] text-[var(--st-text-secondary)]">
          Custom credentials store free-form key → value secrets.
          {isEdit ? ' Leave a value masked to keep the stored secret.' : ''}
        </p>
        {customPairs.map((pair, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              placeholder="Key (e.g. apiKey)"
              value={pair.key}
              disabled={isEdit && pair.value === MASK_PLACEHOLDER && pair.key !== ''}
              onChange={(e) => {
                const next = [...customPairs];
                next[idx] = { ...next[idx], key: e.target.value };
                onCustomPairsChange(next);
              }}
              aria-label={`Custom field ${idx + 1} key`}
            />
            <Input
              type="password"
              placeholder="Value"
              value={pair.value}
              onChange={(e) => {
                const next = [...customPairs];
                next[idx] = { ...next[idx], value: e.target.value };
                onCustomPairsChange(next);
              }}
              aria-label={`Custom field ${idx + 1} value`}
            />
            <IconButton
              label={`Remove field ${pair.key || idx + 1}`}
              icon={X}
              size="sm"
              variant="ghost"
              onClick={() => onCustomPairsChange(customPairs.filter((_, i) => i !== idx))}
            />
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          iconLeft={Plus}
          className="self-start"
          onClick={() => onCustomPairsChange([...customPairs, { key: '', value: '' }])}
        >
          Add field
        </Button>
      </div>
    );
  }

  const fields = schemaFor(type);
  return (
    <div className="flex flex-col gap-3">
      {fields.map((f) => {
        if (f.kind === 'boolean') {
          const raw = values[f.key];
          const checked = raw === 'true';
          return (
            <Field key={f.key} label={f.label} help={f.helpText} required={f.required}>
              <div>
                <Switch
                  checked={checked}
                  onCheckedChange={(next) => onValueChange(f.key, next ? 'true' : 'false')}
                  aria-label={typeof f.label === 'string' ? f.label : f.key}
                />
                {isEdit && raw === MASK_PLACEHOLDER ? (
                  <p className="mt-1 text-[11px] text-[var(--st-text-tertiary)]">
                    Stored value kept unless you toggle this.
                  </p>
                ) : null}
              </div>
            </Field>
          );
        }
        const inputType =
          f.kind === 'password' ? 'password' : f.kind === 'number' ? 'number' : f.kind === 'url' ? 'url' : 'text';
        return (
          <Field
            key={f.key}
            label={f.label}
            required={f.required}
            help={
              isEdit && values[f.key] === MASK_PLACEHOLDER
                ? 'Leave masked to keep the stored value.'
                : f.helpText
            }
          >
            <Input
              type={inputType}
              placeholder={f.placeholder}
              value={values[f.key] ?? ''}
              onChange={(e) => onValueChange(f.key, e.target.value)}
              autoComplete="off"
            />
          </Field>
        );
      })}
    </div>
  );
}

/* ── Form state helpers ─────────────────────────────────────────────────── */

function buildPayloadData(
  type: CredentialType,
  values: Record<string, string>,
  customPairs: CustomPair[],
): Record<string, string> {
  if (type === 'custom') {
    const data: Record<string, string> = {};
    for (const { key, value } of customPairs) {
      const k = key.trim();
      if (k) data[k] = value;
    }
    return data;
  }
  const data: Record<string, string> = {};
  for (const f of schemaFor(type)) {
    const v = values[f.key];
    if (v !== undefined && v !== '') data[f.key] = v;
  }
  return data;
}

function missingRequired(type: CredentialType, data: Record<string, string>, isEdit: boolean): string[] {
  if (type === 'custom') return [];
  return schemaFor(type)
    .filter((f) => f.required)
    .filter((f) => {
      const v = data[f.key];
      if (isEdit) return v === undefined || v === ''; // masked counts as present
      return v === undefined || v === '' || v === MASK_PLACEHOLDER;
    })
    .map((f) => (typeof f.label === 'string' ? f.label : f.key));
}

/* ── Component ──────────────────────────────────────────────────────────── */

export function ConnectionsClient() {
  const { toast } = useToast();

  const [credentials, setCredentials] = React.useState<ApiCredential[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [unauthorized, setUnauthorized] = React.useState(false);
  const [search, setSearch] = React.useState('');

  /** Per-credential transient state */
  const [testingId, setTestingId] = React.useState<string | null>(null);
  const [testState, setTestState] = React.useState<Record<string, SavedTestState>>({});
  const [deleteTarget, setDeleteTarget] = React.useState<ApiCredential | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  /** Create / edit dialog state */
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ApiCredential | null>(null);
  const [formName, setFormName] = React.useState('');
  const [formType, setFormType] = React.useState<CredentialType | null>(null);
  const [formValues, setFormValues] = React.useState<Record<string, string>>({});
  const [customPairs, setCustomPairs] = React.useState<CustomPair[]>([{ key: '', value: '' }]);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formTestResult, setFormTestResult] = React.useState<TestResult | null>(null);
  const [formTesting, setFormTesting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  /* ── Load ─────────────────────────────────────────────────────────────── */

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setUnauthorized(false);
    try {
      const res = await fetch('/api/sabflow/credentials', { cache: 'no-store' });
      if (res.status === 401) {
        setUnauthorized(true);
        setCredentials(null);
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load connections (${res.status})`);
      }
      const json = (await res.json()) as { credentials: ApiCredential[] };
      setCredentials(json.credentials ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  /* ── Dialog open helpers ─────────────────────────────────────────────── */

  const openCreate = () => {
    setEditing(null);
    setFormName('');
    setFormType(null);
    setFormValues({});
    setCustomPairs([{ key: '', value: '' }]);
    setFormError(null);
    setFormTestResult(null);
    setDialogOpen(true);
  };

  const openEdit = (cred: ApiCredential) => {
    setEditing(cred);
    setFormName(cred.name);
    setFormType(cred.type);
    // Prefill every key with its mask; the API skips MASK_PLACEHOLDER on PATCH,
    // so untouched fields keep their stored secret.
    setFormValues({ ...cred.data });
    setCustomPairs(
      cred.type === 'custom'
        ? Object.keys(cred.data).map((key) => ({ key, value: cred.data[key] }))
        : [{ key: '', value: '' }],
    );
    setFormError(null);
    setFormTestResult(null);
    setDialogOpen(true);
  };

  const closeDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditing(null);
      setFormError(null);
      setFormTestResult(null);
    }
  };

  /* ── Actions ─────────────────────────────────────────────────────────── */

  const handleFormTest = async () => {
    if (!formType || formTesting) return;
    setFormTesting(true);
    setFormTestResult(null);
    setFormError(null);
    try {
      const data = buildPayloadData(formType, formValues, customPairs);
      const res = await fetch('/api/sabflow/credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: formType, data }),
      });
      const json = (await res.json().catch(() => ({}))) as TestResult & { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? `Test failed (${res.status})`);
      }
      setFormTestResult(json);
      if (json.ok && 'skipped' in json && json.skipped) {
        toast.info(json.message ?? 'No test available for this provider.');
      } else if (json.ok) {
        toast.success(('info' in json && json.info) || 'Connection test passed.');
      } else {
        toast.error(json.error ?? 'Connection test failed.');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Connection test failed';
      setFormTestResult({ ok: false, error: message });
      toast.error(message);
    } finally {
      setFormTesting(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    const name = formName.trim();
    if (!name) {
      setFormError('Name is required.');
      return;
    }
    if (!formType) {
      setFormError('Pick a connection type.');
      return;
    }
    const data = buildPayloadData(formType, formValues, customPairs);
    const missing = missingRequired(formType, data, Boolean(editing));
    if (missing.length > 0) {
      setFormError(`Missing required field${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const res = editing
        ? await fetch(`/api/sabflow/credentials/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, data }),
          })
        : await fetch('/api/sabflow/credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: formType, name, data }),
          });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? `Failed to save (${res.status})`);
      }
      toast.success(editing ? `Updated "${name}".` : `Connected ${CREDENTIAL_TYPE_LABEL[formType]}.`);
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save';
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestSaved = async (cred: ApiCredential) => {
    if (testingId) return;
    setTestingId(cred.id);
    try {
      const res = await fetch(`/api/sabflow/credentials/${cred.id}/test`, { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as TestResult & {
        error?: string;
        retryAfterSeconds?: number;
      };
      if (res.status === 429) {
        toast.warning(
          `Rate limit hit — try again in ${json.retryAfterSeconds ?? 'a few'} seconds.`,
        );
        return;
      }
      if (json.ok) {
        setTestState((prev) => ({ ...prev, [cred.id]: 'ok' }));
        toast.success(`"${cred.name}" connection is healthy.`);
      } else {
        setTestState((prev) => ({ ...prev, [cred.id]: 'failed' }));
        toast.error(json.error ?? `"${cred.name}" connection test failed.`);
      }
    } catch (e) {
      setTestState((prev) => ({ ...prev, [cred.id]: 'failed' }));
      toast.error(e instanceof Error ? e.message : 'Connection test failed');
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sabflow/credentials/${deleteTarget.id}`, { method: 'DELETE' });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? `Failed to delete (${res.status})`);
      }
      toast.success(`Deleted "${deleteTarget.name}".`);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  /* ── Derived ─────────────────────────────────────────────────────────── */

  const filtered = React.useMemo(() => {
    if (!credentials) return [];
    const q = search.trim().toLowerCase();
    if (!q) return credentials;
    return credentials.filter((c) => {
      const hay = `${c.name} ${CREDENTIAL_TYPE_LABEL[c.type] ?? c.type} ${c.type}`.toLowerCase();
      return hay.includes(q);
    });
  }, [credentials, search]);

  /* ── Render: error states ────────────────────────────────────────────── */

  if (unauthorized) {
    return (
      <div className="py-16">
        <EmptyState
          icon={ShieldCheck}
          tone="warning"
          title="Your session has expired"
          description="Sign in again to manage your SabFlow connections."
          action={
            <Button asChild variant="primary" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (loadError && !loading) {
    return (
      <div className="flex flex-col gap-3 py-8">
        <Alert tone="danger">{loadError}</Alert>
        <Button variant="secondary" size="sm" iconLeft={RefreshCw} className="self-start" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]"
            aria-hidden="true"
          />
          <Input
            placeholder="Search connections…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search connections"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" iconLeft={RefreshCw} onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Button variant="primary" size="sm" iconLeft={Plus} onClick={openCreate}>
            New connection
          </Button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && !credentials ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} padding="md">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-[var(--st-radius)]" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="mt-4 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </Card>
          ))}
        </div>
      ) : credentials && credentials.length === 0 ? (
        <div className="py-16">
          <EmptyState
            icon={KeyRound}
            title="No connections yet"
            description="Connect a provider — API keys, databases, OAuth apps — and your flows can use it as a credential."
            action={
              <Button variant="primary" size="sm" iconLeft={Plus} onClick={openCreate}>
                New connection
              </Button>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16">
          <EmptyState
            icon={Search}
            title="No matches"
            description={`Nothing matches "${search}".`}
            action={
              <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                Clear search
              </Button>
            }
          />
        </div>
      ) : (
        <m.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.map((cred) => {
            const category = CREDENTIAL_TYPE_CATEGORY[cred.type] ?? 'generic';
            const Icon = CATEGORY_ICON[category] ?? KeyRound;
            const status = testState[cred.id];
            const keys = Object.keys(cred.data);
            return (
              <m.div key={cred.id} variants={fadeInUp}>
                <Card padding="md" className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
                        aria-hidden="true"
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-[13.5px] font-semibold text-[var(--st-text)]">
                          {cred.name}
                        </h3>
                        <p className="truncate text-[12px] text-[var(--st-text-secondary)]">
                          {CREDENTIAL_TYPE_LABEL[cred.type] ?? cred.type}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton
                          label={`Actions for ${cred.name}`}
                          icon={MoreVertical}
                          size="sm"
                          variant="ghost"
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem iconLeft={Pencil} onSelect={() => openEdit(cred)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          iconLeft={FlaskConical}
                          disabled={testingId !== null}
                          onSelect={() => void handleTestSaved(cred)}
                        >
                          Test connection
                        </DropdownMenuItem>
                        {/* asChild: Radix Slot needs a single child, so the icon
                            lives inside the Link (the Item's own iconLeft would
                            add a second child and crash the Slot). */}
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/sabflow/credentials/${cred.id}/scopes`}>
                            <ShieldCheck className="u-dropdown__item-icon" aria-hidden="true" />
                            Manage scopes
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          iconLeft={Trash2}
                          variant="danger"
                          onSelect={() => setDeleteTarget(cred)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <CardBody className="flex flex-1 flex-col gap-3 pt-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="neutral">{CREDENTIAL_CATEGORY_LABEL[category]}</Badge>
                      {status === 'ok' ? (
                        <Badge tone="success" dot>
                          Test passed
                        </Badge>
                      ) : status === 'failed' ? (
                        <Badge tone="danger" dot>
                          Test failed
                        </Badge>
                      ) : null}
                    </div>
                    {keys.length > 0 ? (
                      <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                        <span className="font-medium text-[var(--st-text)]">
                          {keys.length} secret{keys.length === 1 ? '' : 's'}
                        </span>{' '}
                        · <span className="font-mono">{keys.slice(0, 3).join(', ')}</span>
                        {keys.length > 3 ? ` +${keys.length - 3}` : ''}
                      </p>
                    ) : (
                      <p className="text-[11.5px] text-[var(--st-text-tertiary)] italic">
                        No stored fields
                      </p>
                    )}
                  </CardBody>

                  <div className="mt-auto flex items-center justify-between border-t border-[var(--st-border)] pt-3">
                    <span className="text-[11px] text-[var(--st-text-secondary)]">
                      Added {formatDate(cred.createdAt)}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      iconLeft={FlaskConical}
                      loading={testingId === cred.id}
                      disabled={testingId !== null}
                      onClick={() => void handleTestSaved(cred)}
                    >
                      Test
                    </Button>
                  </div>
                </Card>
              </m.div>
            );
          })}
        </m.div>
      )}

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : 'New connection'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Secrets are masked — leave a field masked to keep its stored value.'
                : 'Store a provider credential your flows can reference. Secrets are encrypted at rest.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-1">
            <Field label="Name" required>
              <Input
                placeholder="e.g. Production OpenAI"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                autoComplete="off"
              />
            </Field>

            <Field label="Type" required help={editing ? 'Type cannot be changed after creation.' : undefined}>
              {editing ? (
                <Input value={CREDENTIAL_TYPE_LABEL[editing.type] ?? editing.type} disabled readOnly />
              ) : (
                <Combobox
                  value={formType}
                  options={TYPE_OPTIONS}
                  placeholder="Search providers…"
                  emptyText="No matching provider"
                  aria-label="Connection type"
                  onChange={(value) => {
                    setFormType((value as CredentialType) || null);
                    setFormValues({});
                    setCustomPairs([{ key: '', value: '' }]);
                    setFormTestResult(null);
                  }}
                />
              )}
            </Field>

            <CredentialFieldsForm
              type={formType}
              values={formValues}
              onValueChange={(key, value) => {
                setFormValues((prev) => ({ ...prev, [key]: value }));
                setFormTestResult(null);
              }}
              customPairs={customPairs}
              onCustomPairsChange={(pairs) => {
                setCustomPairs(pairs);
                setFormTestResult(null);
              }}
              isEdit={Boolean(editing)}
            />

            {formTestResult ? (
              <Alert tone={formTestResult.ok ? ('skipped' in formTestResult && formTestResult.skipped ? 'info' : 'success') : 'danger'}>
                {formTestResult.ok
                  ? ('skipped' in formTestResult && formTestResult.skipped
                      ? formTestResult.message ?? 'No test available — will be saved without verification.'
                      : ('info' in formTestResult && formTestResult.info) || 'Connection test passed.')
                  : formTestResult.error ?? 'Connection test failed.'}
              </Alert>
            ) : null}

            {formError ? <Alert tone="danger">{formError}</Alert> : null}
          </div>

          <DialogFooter>
            {!editing && formType ? (
              <Button
                variant="secondary"
                iconLeft={FlaskConical}
                loading={formTesting}
                disabled={formTesting || saving}
                onClick={() => void handleFormTest()}
              >
                Test
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => closeDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={saving}
              disabled={saving || (!editing && !formType)}
              onClick={() => void handleSave()}
            >
              {editing ? 'Save changes' : 'Create connection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Any flow that references this connection will fail until you reconnect. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete connection'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ConnectionsClient;

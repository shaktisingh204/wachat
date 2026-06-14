'use client';

import * as React from 'react';
import {
  Button,
  Modal,
  Input,
  Textarea,
  Field,
  Badge,
  Card,
  SelectField,
  SearchInput,
  EmptyState,
  Skeleton,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from '@/components/sabcrm/20ui';
import { Users, Plus, Pencil, Trash2, PhoneForwarded } from 'lucide-react';
import {
  listRingGroups,
  createRingGroup,
  updateRingGroup,
  deleteRingGroup,
} from './actions';

type RingGroupRow = {
  _id: string;
  name: string;
  strategy: string;
  extensions: string[];
  ringSeconds?: number;
  fallback?: string;
  status: string;
};

type FormState = {
  name: string;
  strategy: string;
  extensions: string;
  ringSeconds: string;
  fallback: string;
  status: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  strategy: 'ringall',
  extensions: '',
  ringSeconds: '20',
  fallback: '',
  status: 'active',
};

const STATUS_TONE: Record<string, React.ComponentProps<typeof Badge>['tone']> = {
  active: 'success',
  disabled: 'neutral',
};

const STRATEGY_OPTIONS = [
  { value: 'ringall', label: 'Ring all' },
  { value: 'round_robin', label: 'Round robin' },
  { value: 'least_recent', label: 'Least recent' },
];

const STRATEGY_LABELS: Record<string, string> = Object.fromEntries(
  STRATEGY_OPTIONS.map((o) => [o.value, o.label]),
);

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
];

function parseExtensions(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function RingGroupsPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<RingGroupRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listRingGroups({ q: search, status: statusFilter });
      setData(res.items as RingGroupRow[]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (g: RingGroupRow) => {
    setEditingId(g._id);
    setForm({
      name: g.name,
      strategy: g.strategy || 'ringall',
      extensions: (g.extensions ?? []).join('\n'),
      ringSeconds: g.ringSeconds != null ? String(g.ringSeconds) : '',
      fallback: g.fallback ?? '',
      status: g.status || 'active',
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    const extensions = parseExtensions(form.extensions);
    if (!form.name.trim()) {
      toast.error('Name is required.');
      return;
    }
    if (extensions.length === 0) {
      toast.error('Add at least one extension.');
      return;
    }
    setSaving(true);
    try {
      const ringSeconds = form.ringSeconds.trim() ? Number(form.ringSeconds) : undefined;
      const payload = {
        name: form.name,
        strategy: form.strategy,
        extensions,
        ringSeconds,
        fallback: form.fallback.trim() || undefined,
        status: form.status,
      };
      if (editingId) {
        await updateRingGroup(editingId, payload);
        toast.success(`${form.name} updated`);
      } else {
        await createRingGroup(payload);
        toast.success(`${form.name} added`);
      }
      setIsFormOpen(false);
      void load();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    setDeletingId(id);
    try {
      await deleteRingGroup(id);
      toast.success(`${name} deleted`);
      void load();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCall</PageEyebrow>
          <PageTitle>Ring groups</PageTitle>
          <PageDescription>
            Route inbound calls to a set of extensions with a ring strategy.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={openCreate} className="sc-press">
            New ring group
          </Button>
        </PageActions>
      </PageHeader>

      <Card variant="outlined" padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-end gap-[var(--st-space-3)] border-b border-[var(--st-border)] p-[var(--st-space-4)]">
          <div className="min-w-[220px] flex-1">
            <Field label="Search">
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder="Search by name"
              />
            </Field>
          </div>
          <Field label="Status">
            <SelectField
              value={statusFilter}
              onChange={(v) => setStatusFilter(v ?? 'all')}
              options={[{ value: 'all', label: 'All statuses' }, ...STATUS_OPTIONS]}
            />
          </Field>
        </div>

        <div className="p-[var(--st-space-4)]">
          {loading ? (
            <div className="flex flex-col gap-[var(--st-space-2)]">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No ring groups yet"
              description="Create a ring group to distribute calls across extensions."
              action={
                <Button variant="primary" iconLeft={Plus} onClick={openCreate} className="sc-press">
                  New ring group
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--st-border)] text-left text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                    <th className="py-[var(--st-space-2)] pr-[var(--st-space-3)] font-medium">Name</th>
                    <th className="py-[var(--st-space-2)] pr-[var(--st-space-3)] font-medium">Strategy</th>
                    <th className="py-[var(--st-space-2)] pr-[var(--st-space-3)] font-medium">Extensions</th>
                    <th className="py-[var(--st-space-2)] pr-[var(--st-space-3)] font-medium">Status</th>
                    <th className="py-[var(--st-space-2)] font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((g) => (
                    <tr key={g._id} className="border-b border-[var(--st-border)] last:border-0">
                      <td className="py-[var(--st-space-3)] pr-[var(--st-space-3)] font-medium text-[var(--st-text)]">
                        <span className="flex items-center gap-2">
                          <PhoneForwarded className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                          {g.name}
                        </span>
                      </td>
                      <td className="py-[var(--st-space-3)] pr-[var(--st-space-3)] text-[var(--st-text-secondary)]">
                        {STRATEGY_LABELS[g.strategy] ?? g.strategy}
                      </td>
                      <td className="py-[var(--st-space-3)] pr-[var(--st-space-3)] text-[var(--st-text-secondary)]">
                        {(g.extensions ?? []).length}
                      </td>
                      <td className="py-[var(--st-space-3)] pr-[var(--st-space-3)]">
                        <Badge tone={STATUS_TONE[g.status] ?? 'neutral'} className="capitalize">
                          {g.status}
                        </Badge>
                      </td>
                      <td className="py-[var(--st-space-3)]">
                        <div className="flex justify-end gap-[var(--st-space-2)]">
                          <Button
                            variant="outline"
                            size="sm"
                            iconLeft={Pencil}
                            onClick={() => openEdit(g)}
                            className="sc-press"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            iconLeft={Trash2}
                            loading={deletingId === g._id}
                            onClick={() => handleDelete(g._id, g.name)}
                            className="sc-press"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingId ? 'Edit ring group' : 'New ring group'}
        description="Choose the ring strategy and the extensions that should ring."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving} className="sc-press">
              {editingId ? 'Save changes' : 'Create ring group'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-[var(--st-space-3)]">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Sales team"
            />
          </Field>
          <div className="grid grid-cols-2 gap-[var(--st-space-3)]">
            <Field label="Strategy">
              <SelectField
                value={form.strategy}
                onChange={(v) => setForm((f) => ({ ...f, strategy: v ?? 'ringall' }))}
                options={STRATEGY_OPTIONS}
              />
            </Field>
            <Field label="Status">
              <SelectField
                value={form.status}
                onChange={(v) => setForm((f) => ({ ...f, status: v ?? 'active' }))}
                options={STATUS_OPTIONS}
              />
            </Field>
          </div>
          <Field label="Extensions" help="One per line, or comma-separated.">
            <Textarea
              value={form.extensions}
              onChange={(e) => setForm((f) => ({ ...f, extensions: e.target.value }))}
              placeholder={'1001\n1002\n1003'}
              rows={4}
            />
          </Field>
          <div className="grid grid-cols-2 gap-[var(--st-space-3)]">
            <Field label="Ring seconds">
              <Input
                value={form.ringSeconds}
                onChange={(e) => setForm((f) => ({ ...f, ringSeconds: e.target.value }))}
                type="number"
                placeholder="20"
              />
            </Field>
            <Field label="Fallback">
              <Input
                value={form.fallback}
                onChange={(e) => setForm((f) => ({ ...f, fallback: e.target.value }))}
                placeholder="Voicemail or extension"
              />
            </Field>
          </div>
        </div>
      </Modal>
    </main>
  );
}

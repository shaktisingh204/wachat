'use client';

import * as React from 'react';
import {
  Button,
  Modal,
  Input,
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
import { KeyRound, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  listCredentials,
  createCredential,
  updateCredential,
  deleteCredential,
} from './actions';

type CredentialRow = {
  _id: string;
  username: string;
  passwordRef?: string | null;
  label?: string | null;
  status: 'active' | 'disabled';
};

const STATUS_TONE: Record<
  CredentialRow['status'],
  React.ComponentProps<typeof Badge>['tone']
> = {
  active: 'success',
  disabled: 'neutral',
};

type FormState = {
  username: string;
  label: string;
  passwordRef: string;
  status: 'active' | 'disabled';
};

const EMPTY_FORM: FormState = {
  username: '',
  label: '',
  passwordRef: '',
  status: 'active',
};

export default function SipCredentialsPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<CredentialRow[]>([]);
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
      const res = await listCredentials({ q: search, status: statusFilter as never });
      setData((res?.items ?? []) as CredentialRow[]);
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

  const openEdit = (row: CredentialRow) => {
    setEditingId(row._id);
    setForm({
      username: row.username,
      label: row.label ?? '',
      passwordRef: row.passwordRef ?? '',
      status: row.status,
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.username.trim()) {
      toast.error('Username is required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateCredential(editingId, {
          label: form.label.trim() || undefined,
          passwordRef: form.passwordRef.trim() || undefined,
          status: form.status,
        });
        toast.success('Credential updated');
      } else {
        await createCredential({
          username: form.username.trim(),
          label: form.label.trim() || undefined,
          passwordRef: form.passwordRef.trim() || undefined,
          status: form.status,
        });
        toast.success('Credential created');
      }
      setIsFormOpen(false);
      void load();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: CredentialRow) => {
    setDeletingId(row._id);
    try {
      await deleteCredential(row._id);
      toast.success(`${row.username} deleted`);
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
          <PageTitle>SIP credentials</PageTitle>
          <PageDescription>
            Manage the SIP auth credentials your devices register with.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={openCreate} className="sc-press">
            New credential
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
                placeholder="Search usernames or labels"
              />
            </Field>
          </div>
          <Field label="Status">
            <SelectField
              value={statusFilter}
              onChange={(v) => setStatusFilter(v ?? 'all')}
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'disabled', label: 'Disabled' },
              ]}
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
              icon={KeyRound}
              title="No SIP credentials yet"
              description="Create your first credential so a device can register and place calls."
              action={
                <Button variant="primary" iconLeft={Plus} onClick={openCreate} className="sc-press">
                  New credential
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--st-border)] text-left text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                    <th className="px-[var(--st-space-3)] py-[var(--st-space-2)] font-medium">
                      Username
                    </th>
                    <th className="px-[var(--st-space-3)] py-[var(--st-space-2)] font-medium">
                      Label
                    </th>
                    <th className="px-[var(--st-space-3)] py-[var(--st-space-2)] font-medium">
                      Status
                    </th>
                    <th className="px-[var(--st-space-3)] py-[var(--st-space-2)] text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr
                      key={row._id}
                      className="border-b border-[var(--st-border)] last:border-b-0"
                    >
                      <td className="px-[var(--st-space-3)] py-[var(--st-space-3)] font-mono tabular-nums text-[var(--st-text)]">
                        {row.username}
                      </td>
                      <td className="px-[var(--st-space-3)] py-[var(--st-space-3)] text-[var(--st-text)]">
                        {row.label || (
                          <span className="text-[var(--st-text-secondary)]">—</span>
                        )}
                      </td>
                      <td className="px-[var(--st-space-3)] py-[var(--st-space-3)]">
                        <Badge tone={STATUS_TONE[row.status]} className="capitalize">
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-[var(--st-space-3)] py-[var(--st-space-3)]">
                        <div className="flex justify-end gap-[var(--st-space-2)]">
                          <Button
                            variant="outline"
                            size="sm"
                            iconLeft={Pencil}
                            onClick={() => openEdit(row)}
                            className="sc-press"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            iconLeft={Trash2}
                            loading={deletingId === row._id}
                            onClick={() => handleDelete(row)}
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
        title={editingId ? 'Edit credential' : 'New credential'}
        description="SIP auth credentials a device registers with."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving} className="sc-press">
              {editingId ? 'Save changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-[var(--st-space-3)]">
          <Field label="Username">
            <Input
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              placeholder="e.g. desk-phone-01"
              disabled={Boolean(editingId)}
            />
          </Field>
          <Field label="Label">
            <Input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Friendly name (optional)"
            />
          </Field>
          <Field label="Password reference">
            <Input
              value={form.passwordRef}
              onChange={(e) =>
                setForm((f) => ({ ...f, passwordRef: e.target.value }))
              }
              placeholder="Secret reference (optional)"
            />
          </Field>
          <Field label="Status">
            <SelectField
              value={form.status}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  status: (v as FormState['status']) ?? 'active',
                }))
              }
              options={[
                { value: 'active', label: 'Active' },
                { value: 'disabled', label: 'Disabled' },
              ]}
            />
          </Field>
        </div>
      </Modal>
    </main>
  );
}

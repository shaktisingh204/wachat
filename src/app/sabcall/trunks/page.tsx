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
import { Network, Plus, Pencil, Trash2, Server } from 'lucide-react';
import { listTrunks, createTrunk, updateTrunk, deleteTrunk } from './actions';

type TrunkRow = {
  _id: string;
  name: string;
  provider: string;
  sipServer: string;
  port?: number;
  transport: string;
  status: string;
};

type FormState = {
  name: string;
  provider: string;
  sipServer: string;
  port: string;
  transport: string;
  status: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  provider: 'custom',
  sipServer: '',
  port: '5060',
  transport: 'udp',
  status: 'active',
};

const STATUS_TONE: Record<string, React.ComponentProps<typeof Badge>['tone']> = {
  active: 'success',
  disabled: 'neutral',
};

const PROVIDER_OPTIONS = [
  { value: 'custom', label: 'Custom' },
  { value: 'twilio', label: 'Twilio' },
  { value: 'plivo', label: 'Plivo' },
  { value: 'telnyx', label: 'Telnyx' },
  { value: 'vonage', label: 'Vonage' },
];

const TRANSPORT_OPTIONS = [
  { value: 'udp', label: 'UDP' },
  { value: 'tcp', label: 'TCP' },
  { value: 'tls', label: 'TLS' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
];

export default function SipTrunksPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<TrunkRow[]>([]);
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
      const res = await listTrunks({ q: search, status: statusFilter });
      setData(res.items as TrunkRow[]);
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

  const openEdit = (t: TrunkRow) => {
    setEditingId(t._id);
    setForm({
      name: t.name,
      provider: t.provider || 'custom',
      sipServer: t.sipServer,
      port: t.port != null ? String(t.port) : '',
      transport: t.transport || 'udp',
      status: t.status || 'active',
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.sipServer.trim()) {
      toast.error('Name and SIP server are required.');
      return;
    }
    setSaving(true);
    try {
      const port = form.port.trim() ? Number(form.port) : undefined;
      if (editingId) {
        await updateTrunk(editingId, {
          name: form.name,
          provider: form.provider,
          sipServer: form.sipServer,
          port,
          transport: form.transport,
          status: form.status,
        });
        toast.success(`${form.name} updated`);
      } else {
        await createTrunk({
          name: form.name,
          provider: form.provider,
          sipServer: form.sipServer,
          port,
          transport: form.transport,
          status: form.status,
        });
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
      await deleteTrunk(id);
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
          <PageTitle>SIP trunks</PageTitle>
          <PageDescription>
            Connect carrier SIP trunks for inbound and outbound calling.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
            New trunk
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
                placeholder="Search by name, provider, or server"
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
              icon={Network}
              title="No trunks yet"
              description="Add a SIP trunk to route calls through your carrier."
              action={
                <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
                  New trunk
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--st-border)] text-left text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                    <th className="py-[var(--st-space-2)] pr-[var(--st-space-3)] font-medium">Name</th>
                    <th className="py-[var(--st-space-2)] pr-[var(--st-space-3)] font-medium">Provider</th>
                    <th className="py-[var(--st-space-2)] pr-[var(--st-space-3)] font-medium">SIP server</th>
                    <th className="py-[var(--st-space-2)] pr-[var(--st-space-3)] font-medium">Transport</th>
                    <th className="py-[var(--st-space-2)] pr-[var(--st-space-3)] font-medium">Status</th>
                    <th className="py-[var(--st-space-2)] font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((t) => (
                    <tr key={t._id} className="border-b border-[var(--st-border)] last:border-0">
                      <td className="py-[var(--st-space-3)] pr-[var(--st-space-3)] font-medium text-[var(--st-text)]">
                        <span className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                          {t.name}
                        </span>
                      </td>
                      <td className="py-[var(--st-space-3)] pr-[var(--st-space-3)] capitalize text-[var(--st-text-secondary)]">
                        {t.provider}
                      </td>
                      <td className="py-[var(--st-space-3)] pr-[var(--st-space-3)] font-mono text-[var(--st-text-secondary)]">
                        {t.sipServer}
                        {t.port != null ? `:${t.port}` : ''}
                      </td>
                      <td className="py-[var(--st-space-3)] pr-[var(--st-space-3)] uppercase text-[var(--st-text-secondary)]">
                        {t.transport}
                      </td>
                      <td className="py-[var(--st-space-3)] pr-[var(--st-space-3)]">
                        <Badge tone={STATUS_TONE[t.status] ?? 'neutral'} className="capitalize">
                          {t.status}
                        </Badge>
                      </td>
                      <td className="py-[var(--st-space-3)]">
                        <div className="flex justify-end gap-[var(--st-space-2)]">
                          <Button
                            variant="outline"
                            size="sm"
                            iconLeft={Pencil}
                            onClick={() => openEdit(t)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            iconLeft={Trash2}
                            loading={deletingId === t._id}
                            onClick={() => handleDelete(t._id, t.name)}
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
        title={editingId ? 'Edit trunk' : 'New trunk'}
        description="Configure the carrier SIP endpoint for this trunk."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editingId ? 'Save changes' : 'Create trunk'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-[var(--st-space-3)]">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Primary carrier"
            />
          </Field>
          <div className="grid grid-cols-2 gap-[var(--st-space-3)]">
            <Field label="Provider">
              <SelectField
                value={form.provider}
                onChange={(v) => setForm((f) => ({ ...f, provider: v ?? 'custom' }))}
                options={PROVIDER_OPTIONS}
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
          <Field label="SIP server">
            <Input
              value={form.sipServer}
              onChange={(e) => setForm((f) => ({ ...f, sipServer: e.target.value }))}
              placeholder="sip.carrier.com"
            />
          </Field>
          <div className="grid grid-cols-2 gap-[var(--st-space-3)]">
            <Field label="Port">
              <Input
                value={form.port}
                onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                placeholder="5060"
              />
            </Field>
            <Field label="Transport">
              <SelectField
                value={form.transport}
                onChange={(v) => setForm((f) => ({ ...f, transport: v ?? 'udp' }))}
                options={TRANSPORT_OPTIONS}
              />
            </Field>
          </div>
        </div>
      </Modal>
    </main>
  );
}

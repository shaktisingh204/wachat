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
import { PhoneCall, Plus, Pencil, Trash2, Rocket } from 'lucide-react';
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  launchCampaign,
} from './actions';

type CampaignRow = {
  _id: string;
  name: string;
  numbers: string[];
  callerId?: string;
  mode: string;
  amd: boolean;
  voicemailDrop?: string;
  status: string;
};

type FormState = {
  name: string;
  numbers: string;
  callerId: string;
  mode: string;
  amd: string;
  voicemailDrop: string;
  status: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  numbers: '',
  callerId: '',
  mode: 'power',
  amd: 'no',
  voicemailDrop: '',
  status: 'active',
};

const STATUS_TONE: Record<string, React.ComponentProps<typeof Badge>['tone']> = {
  active: 'success',
  disabled: 'neutral',
};

const MODE_OPTIONS = [
  { value: 'power', label: 'Power' },
  { value: 'preview', label: 'Preview' },
  { value: 'progressive', label: 'Progressive' },
];

const AMD_OPTIONS = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
];

function parseNumbers(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((n) => n.trim())
    .filter(Boolean);
}

export default function PowerDialerPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<CampaignRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [launchingId, setLaunchingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCampaigns({ q: search, status: statusFilter });
      setData(res.items as CampaignRow[]);
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

  const openEdit = (c: CampaignRow) => {
    setEditingId(c._id);
    setForm({
      name: c.name,
      numbers: (c.numbers ?? []).join('\n'),
      callerId: c.callerId ?? '',
      mode: c.mode || 'power',
      amd: c.amd ? 'yes' : 'no',
      voicemailDrop: c.voicemailDrop ?? '',
      status: c.status || 'active',
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    const numbers = parseNumbers(form.numbers);
    if (!form.name.trim()) {
      toast.error('Name is required.');
      return;
    }
    if (numbers.length === 0) {
      toast.error('Add at least one number.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        numbers,
        callerId: form.callerId.trim() || undefined,
        mode: form.mode,
        amd: form.amd === 'yes',
        voicemailDrop: form.voicemailDrop.trim() || undefined,
        status: form.status,
      };
      if (editingId) {
        await updateCampaign(editingId, payload);
        toast.success(`${form.name} updated`);
      } else {
        await createCampaign(payload);
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
      await deleteCampaign(id);
      toast.success(`${name} deleted`);
      void load();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleLaunch = async (id: string) => {
    setLaunchingId(id);
    try {
      const res = await launchCampaign(id);
      if (res.success) {
        toast.success(`Queued ${res.queued} of ${res.total}`);
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error(`Launch failed: ${(e as Error).message}`);
    } finally {
      setLaunchingId(null);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCall</PageEyebrow>
          <PageTitle>Power dialer</PageTitle>
          <PageDescription>
            Build outbound dialing campaigns and launch them across your numbers.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
            New campaign
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
                placeholder="Search by campaign name"
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
              icon={PhoneCall}
              title="No campaigns yet"
              description="Create a power dialer campaign to start dialing your list."
              action={
                <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
                  New campaign
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--st-border)] text-left text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                    <th className="py-[var(--st-space-2)] pr-[var(--st-space-3)] font-medium">Name</th>
                    <th className="py-[var(--st-space-2)] pr-[var(--st-space-3)] font-medium"># Numbers</th>
                    <th className="py-[var(--st-space-2)] pr-[var(--st-space-3)] font-medium">Mode</th>
                    <th className="py-[var(--st-space-2)] pr-[var(--st-space-3)] font-medium">AMD</th>
                    <th className="py-[var(--st-space-2)] pr-[var(--st-space-3)] font-medium">Status</th>
                    <th className="py-[var(--st-space-2)] font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((c) => (
                    <tr key={c._id} className="border-b border-[var(--st-border)] last:border-0">
                      <td className="py-[var(--st-space-3)] pr-[var(--st-space-3)] font-medium text-[var(--st-text)]">
                        <span className="flex items-center gap-2">
                          <PhoneCall className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                          {c.name}
                        </span>
                      </td>
                      <td className="py-[var(--st-space-3)] pr-[var(--st-space-3)] tabular-nums text-[var(--st-text-secondary)]">
                        {(c.numbers ?? []).length}
                      </td>
                      <td className="py-[var(--st-space-3)] pr-[var(--st-space-3)] capitalize text-[var(--st-text-secondary)]">
                        {c.mode}
                      </td>
                      <td className="py-[var(--st-space-3)] pr-[var(--st-space-3)]">
                        <Badge tone={c.amd ? 'success' : 'neutral'}>{c.amd ? 'Yes' : 'No'}</Badge>
                      </td>
                      <td className="py-[var(--st-space-3)] pr-[var(--st-space-3)]">
                        <Badge tone={STATUS_TONE[c.status] ?? 'neutral'} className="capitalize">
                          {c.status}
                        </Badge>
                      </td>
                      <td className="py-[var(--st-space-3)]">
                        <div className="flex justify-end gap-[var(--st-space-2)]">
                          <Button
                            variant="primary"
                            size="sm"
                            iconLeft={Rocket}
                            loading={launchingId === c._id}
                            onClick={() => handleLaunch(c._id)}
                          >
                            Launch
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            iconLeft={Pencil}
                            onClick={() => openEdit(c)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            iconLeft={Trash2}
                            loading={deletingId === c._id}
                            onClick={() => handleDelete(c._id, c.name)}
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
        title={editingId ? 'Edit campaign' : 'New campaign'}
        description="Configure the dialing list and mode for this campaign."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editingId ? 'Save changes' : 'Create campaign'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-[var(--st-space-3)]">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Q3 outbound push"
            />
          </Field>
          <Field label="Numbers" help="One per line, or comma-separated.">
            <Textarea
              value={form.numbers}
              onChange={(e) => setForm((f) => ({ ...f, numbers: e.target.value }))}
              placeholder={'+15551234567\n+15557654321'}
              rows={5}
            />
          </Field>
          <div className="grid grid-cols-2 gap-[var(--st-space-3)]">
            <Field label="Mode">
              <SelectField
                value={form.mode}
                onChange={(v) => setForm((f) => ({ ...f, mode: v ?? 'power' }))}
                options={MODE_OPTIONS}
              />
            </Field>
            <Field label="AMD">
              <SelectField
                value={form.amd}
                onChange={(v) => setForm((f) => ({ ...f, amd: v ?? 'no' }))}
                options={AMD_OPTIONS}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-[var(--st-space-3)]">
            <Field label="Caller ID">
              <Input
                value={form.callerId}
                onChange={(e) => setForm((f) => ({ ...f, callerId: e.target.value }))}
                placeholder="+15550000000"
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
          <Field label="Voicemail drop">
            <Input
              value={form.voicemailDrop}
              onChange={(e) => setForm((f) => ({ ...f, voicemailDrop: e.target.value }))}
              placeholder="Recording name or URL"
            />
          </Field>
        </div>
      </Modal>
    </main>
  );
}

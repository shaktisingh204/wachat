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
import { AppWindow, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  listApplications,
  createApplication,
  updateApplication,
  deleteApplication,
} from './actions';

type AppType = 'webhook' | 'ivr' | 'queue' | 'dial' | 'autopilot';
type AppStatus = 'active' | 'disabled';

type AppRow = {
  _id: string;
  name: string;
  type: AppType;
  status: AppStatus;
  webhookUrl?: string;
  dialTarget?: string;
};

const STATUS_TONE: Record<AppStatus, React.ComponentProps<typeof Badge>['tone']> = {
  active: 'success',
  disabled: 'neutral',
};

const TYPE_OPTIONS = [
  { value: 'webhook', label: 'Webhook' },
  { value: 'ivr', label: 'IVR' },
  { value: 'queue', label: 'Queue' },
  { value: 'dial', label: 'Dial' },
  { value: 'autopilot', label: 'Autopilot' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
];

type FormState = {
  name: string;
  type: AppType;
  dialTarget: string;
  webhookUrl: string;
  status: AppStatus;
};

const EMPTY_FORM: FormState = {
  name: '',
  type: 'webhook',
  dialTarget: '',
  webhookUrl: '',
  status: 'active',
};

export default function VoiceApplicationsPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<AppRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listApplications();
      setData((res.items ?? []) as AppRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (row: AppRow) => {
    setEditingId(row._id);
    setForm({
      name: row.name,
      type: row.type,
      dialTarget: row.dialTarget ?? '',
      webhookUrl: row.webhookUrl ?? '',
      status: row.status,
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        status: form.status,
        dialTarget: form.type === 'dial' ? form.dialTarget.trim() || undefined : undefined,
        webhookUrl: form.type === 'webhook' ? form.webhookUrl.trim() || undefined : undefined,
      };
      if (editingId) {
        await updateApplication(editingId, payload);
        toast.success(`${payload.name} updated`);
      } else {
        await createApplication(payload);
        toast.success(`${payload.name} created`);
      }
      setIsFormOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
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
      await deleteApplication(id);
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
          <PageTitle>Voice applications</PageTitle>
          <PageDescription>
            Define what happens when a call lands — webhook, IVR, queue, dial, or autopilot.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
            New application
          </Button>
        </PageActions>
      </PageHeader>

      <Card variant="outlined" padding="none" className="overflow-hidden">
        <div className="p-[var(--st-space-4)]">
          {loading ? (
            <div className="flex flex-col gap-[var(--st-space-2)]">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <EmptyState
              icon={AppWindow}
              title="No applications yet"
              description="Create your first voice application to route inbound calls."
              action={
                <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
                  New application
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--st-border)] text-left text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                    <th className="px-[var(--st-space-3)] py-[var(--st-space-2)] font-medium">Name</th>
                    <th className="px-[var(--st-space-3)] py-[var(--st-space-2)] font-medium">Type</th>
                    <th className="px-[var(--st-space-3)] py-[var(--st-space-2)] font-medium">Status</th>
                    <th className="px-[var(--st-space-3)] py-[var(--st-space-2)] font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row._id} className="border-b border-[var(--st-border)] last:border-0">
                      <td className="px-[var(--st-space-3)] py-[var(--st-space-3)] font-medium text-[var(--st-text)]">
                        {row.name}
                      </td>
                      <td className="px-[var(--st-space-3)] py-[var(--st-space-3)]">
                        <Badge tone="neutral" kind="outline" className="capitalize">
                          {row.type}
                        </Badge>
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
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            iconLeft={Trash2}
                            loading={deletingId === row._id}
                            onClick={() => handleDelete(row._id, row.name)}
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
        title={editingId ? 'Edit application' : 'New application'}
        description="Configure how this application handles inbound calls."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editingId ? 'Save changes' : 'Create application'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-[var(--st-space-3)]">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Main IVR"
            />
          </Field>

          <Field label="Type">
            <SelectField
              value={form.type}
              onChange={(v) => setForm((f) => ({ ...f, type: (v ?? 'webhook') as AppType }))}
              options={TYPE_OPTIONS}
            />
          </Field>

          {form.type === 'dial' ? (
            <Field label="Dial target">
              <Input
                value={form.dialTarget}
                onChange={(e) => setForm((f) => ({ ...f, dialTarget: e.target.value }))}
                placeholder="+14155550100 or sip:user@host"
              />
            </Field>
          ) : null}

          {form.type === 'webhook' ? (
            <Field label="Webhook URL">
              <Input
                value={form.webhookUrl}
                onChange={(e) => setForm((f) => ({ ...f, webhookUrl: e.target.value }))}
                placeholder="https://example.com/voice"
              />
            </Field>
          ) : null}

          <Field label="Status">
            <SelectField
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: (v ?? 'active') as AppStatus }))}
              options={STATUS_OPTIONS}
            />
          </Field>
        </div>
      </Modal>
    </main>
  );
}

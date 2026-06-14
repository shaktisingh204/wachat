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
import { Globe, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  listDomains,
  createDomain,
  updateDomain,
  deleteDomain,
} from './actions';
import type { SipDomainDoc, SipDomainStatus } from '@/lib/rust-client/sabcall-domains';

const STATUS_TONE: Record<SipDomainStatus, React.ComponentProps<typeof Badge>['tone']> = {
  active: 'success',
  disabled: 'neutral',
};

type FormState = {
  domain: string;
  label: string;
  recordCalls: 'yes' | 'no';
  status: SipDomainStatus;
};

const EMPTY_FORM: FormState = {
  domain: '',
  label: '',
  recordCalls: 'no',
  status: 'active',
};

export default function SipDomainsPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<SipDomainDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SipDomainDoc | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listDomains({
        q: search || undefined,
        status: (statusFilter as SipDomainStatus | 'all') || 'all',
      });
      setData(res.items ?? []);
    } catch (e) {
      toast.error(`Could not load domains: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (d: SipDomainDoc) => {
    setEditing(d);
    setForm({
      domain: d.domain,
      label: d.label ?? '',
      recordCalls: d.recordCalls ? 'yes' : 'no',
      status: d.status,
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.domain.trim()) {
      toast.error('Domain is required.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateDomain(editing._id, {
          label: form.label.trim() || undefined,
          recordCalls: form.recordCalls === 'yes',
          status: form.status,
        });
        toast.success(`${form.domain} updated`);
      } else {
        await createDomain({
          domain: form.domain.trim(),
          label: form.label.trim() || undefined,
          recordCalls: form.recordCalls === 'yes',
          status: form.status,
        });
        toast.success(`${form.domain} added`);
      }
      setIsFormOpen(false);
      void load();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d: SipDomainDoc) => {
    setDeletingId(d._id);
    try {
      await deleteDomain(d._id);
      toast.success(`${d.domain} deleted`);
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
          <PageTitle>SIP domains</PageTitle>
          <PageDescription>
            Register and route the SIP domains your calls live on.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
            New domain
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
                placeholder="Search domains or labels"
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
            <div className="flex flex-col gap-[var(--st-space-3)]">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <EmptyState
              icon={Globe}
              title="No SIP domains yet"
              description="Add your first SIP domain to start routing calls."
              action={
                <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
                  New domain
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--st-border)] text-left text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                    <th className="px-[var(--st-space-3)] py-[var(--st-space-2)] font-medium">
                      Domain
                    </th>
                    <th className="px-[var(--st-space-3)] py-[var(--st-space-2)] font-medium">
                      Record calls
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
                  {data.map((d) => (
                    <tr
                      key={d._id}
                      className="border-b border-[var(--st-border)] last:border-0"
                    >
                      <td className="px-[var(--st-space-3)] py-[var(--st-space-3)]">
                        <div className="flex items-center gap-2">
                          <Globe
                            className="h-4 w-4 text-[var(--st-text-secondary)]"
                            aria-hidden="true"
                          />
                          <div>
                            <div className="font-mono text-[var(--st-text)]">{d.domain}</div>
                            {d.label ? (
                              <div className="text-xs text-[var(--st-text-secondary)]">
                                {d.label}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-[var(--st-space-3)] py-[var(--st-space-3)]">
                        <Badge tone={d.recordCalls ? 'success' : 'neutral'} kind="outline">
                          {d.recordCalls ? 'On' : 'Off'}
                        </Badge>
                      </td>
                      <td className="px-[var(--st-space-3)] py-[var(--st-space-3)]">
                        <Badge tone={STATUS_TONE[d.status]} className="capitalize">
                          {d.status}
                        </Badge>
                      </td>
                      <td className="px-[var(--st-space-3)] py-[var(--st-space-3)]">
                        <div className="flex justify-end gap-[var(--st-space-2)]">
                          <Button
                            variant="outline"
                            size="sm"
                            iconLeft={Pencil}
                            onClick={() => openEdit(d)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            iconLeft={Trash2}
                            loading={deletingId === d._id}
                            onClick={() => handleDelete(d)}
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
        title={editing ? 'Edit SIP domain' : 'New SIP domain'}
        description={
          editing
            ? 'Update the label, recording, or status for this domain.'
            : 'Register a SIP domain to route calls on.'
        }
        footer={
          <div className="flex justify-end gap-[var(--st-space-2)]">
            <Button variant="secondary" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editing ? 'Save changes' : 'Create domain'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-[var(--st-space-3)]">
          <Field label="Domain">
            <Input
              value={form.domain}
              onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
              placeholder="acme.sip.sabnode.com"
              disabled={!!editing}
            />
          </Field>
          <Field label="Label">
            <Input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Optional friendly name"
            />
          </Field>
          <div className="grid grid-cols-2 gap-[var(--st-space-3)]">
            <Field label="Record calls">
              <SelectField
                value={form.recordCalls}
                onChange={(v) =>
                  setForm((f) => ({ ...f, recordCalls: (v as 'yes' | 'no') ?? 'no' }))
                }
                options={[
                  { value: 'no', label: 'No' },
                  { value: 'yes', label: 'Yes' },
                ]}
              />
            </Field>
            <Field label="Status">
              <SelectField
                value={form.status}
                onChange={(v) =>
                  setForm((f) => ({ ...f, status: (v as SipDomainStatus) ?? 'active' }))
                }
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'disabled', label: 'Disabled' },
                ]}
              />
            </Field>
          </div>
        </div>
      </Modal>
    </main>
  );
}

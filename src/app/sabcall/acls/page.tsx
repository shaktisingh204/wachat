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
  StatCard,
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
import {
  ShieldCheck,
  ShieldX,
  Shield,
  Plus,
  Pencil,
  Trash2,
  Network,
} from 'lucide-react';
import { listAcls, createAcl, updateAcl, deleteAcl } from './actions';
import type { SipAclDoc } from '@/lib/rust-client/sabcall-acls';

type AclAction = 'allow' | 'deny';
type AclAppliesTo = 'trunk' | 'registration' | 'all';
type AclStatus = 'active' | 'disabled';

const ACTION_TONE: Record<AclAction, React.ComponentProps<typeof Badge>['tone']> = {
  allow: 'success',
  deny: 'danger',
};

const STATUS_TONE: Record<AclStatus, React.ComponentProps<typeof Badge>['tone']> = {
  active: 'success',
  disabled: 'neutral',
};

/** Split a comma/newline-separated textarea into a clean CIDR string[]. */
function parseCidrs(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type FormState = {
  name: string;
  action: AclAction;
  cidrs: string;
  appliesTo: AclAppliesTo;
  status: AclStatus;
};

const EMPTY_FORM: FormState = {
  name: '',
  action: 'allow',
  cidrs: '',
  appliesTo: 'all',
  status: 'active',
};

export default function SipAclsPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<SipAclDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SipAclDoc | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAcls({
        q: search || undefined,
        status: statusFilter === 'all' ? 'all' : (statusFilter as AclStatus),
      });
      setData(res.items ?? []);
    } catch (e) {
      toast.error(`Failed to load ACLs: ${(e as Error).message}`);
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

  const openEdit = (acl: SipAclDoc) => {
    setEditing(acl);
    setForm({
      name: acl.name,
      action: acl.action,
      cidrs: (acl.cidrs ?? []).join('\n'),
      appliesTo: acl.appliesTo,
      status: acl.status,
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error('Name is required.');
      return;
    }
    const cidrs = parseCidrs(form.cidrs);
    if (cidrs.length === 0) {
      toast.error('Add at least one CIDR.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateAcl(editing._id, {
          name,
          action: form.action,
          cidrs,
          appliesTo: form.appliesTo,
          status: form.status,
        });
        toast.success(`${name} updated`);
      } else {
        await createAcl({
          name,
          action: form.action,
          cidrs,
          appliesTo: form.appliesTo,
          status: form.status,
        });
        toast.success(`${name} created`);
      }
      setIsFormOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      void load();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (acl: SipAclDoc) => {
    setDeletingId(acl._id);
    try {
      await deleteAcl(acl._id);
      toast.success(`${acl.name} deleted`);
      void load();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const allowCount = data.filter((a) => a.action === 'allow').length;
  const denyCount = data.filter((a) => a.action === 'deny').length;
  const activeCount = data.filter((a) => a.status === 'active').length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCall</PageEyebrow>
          <PageTitle>Access control (ACLs)</PageTitle>
          <PageDescription>
            Allow or deny SIP trunk and registration traffic by IP range (CIDR).
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
            New ACL
          </Button>
        </PageActions>
      </PageHeader>

      <section
        aria-label="ACL metrics"
        className="grid grid-cols-2 gap-[var(--st-space-3)] md:grid-cols-3"
      >
        <StatCard label="Allow rules" value={allowCount} icon={ShieldCheck} accent="#1f9d55" />
        <StatCard label="Deny rules" value={denyCount} icon={ShieldX} accent="#dc2626" />
        <StatCard label="Active" value={activeCount} icon={Shield} accent="#3b7af5" />
      </section>

      <Card variant="outlined" padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-end gap-[var(--st-space-3)] border-b border-[var(--st-border)] p-[var(--st-space-4)]">
          <div className="min-w-[220px] flex-1">
            <Field label="Search">
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder="Search by rule name"
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
              icon={Shield}
              title="No ACLs yet"
              description="Create your first rule to allow or deny SIP traffic by IP range."
              action={
                <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
                  New ACL
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--st-border)] text-left text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                    <th className="px-[var(--st-space-3)] py-[var(--st-space-2)] font-medium">Name</th>
                    <th className="px-[var(--st-space-3)] py-[var(--st-space-2)] font-medium">Action</th>
                    <th className="px-[var(--st-space-3)] py-[var(--st-space-2)] font-medium">Applies to</th>
                    <th className="px-[var(--st-space-3)] py-[var(--st-space-2)] font-medium">CIDRs</th>
                    <th className="px-[var(--st-space-3)] py-[var(--st-space-2)] font-medium">Status</th>
                    <th className="px-[var(--st-space-3)] py-[var(--st-space-2)] font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((a) => (
                    <tr
                      key={a._id}
                      className="border-b border-[var(--st-border)] last:border-0 hover:bg-[var(--st-surface-2)]"
                    >
                      <td className="px-[var(--st-space-3)] py-[var(--st-space-3)] font-medium text-[var(--st-text)]">
                        {a.name}
                      </td>
                      <td className="px-[var(--st-space-3)] py-[var(--st-space-3)]">
                        <Badge tone={ACTION_TONE[a.action]} className="capitalize">
                          {a.action}
                        </Badge>
                      </td>
                      <td className="px-[var(--st-space-3)] py-[var(--st-space-3)] capitalize text-[var(--st-text-secondary)]">
                        {a.appliesTo}
                      </td>
                      <td className="px-[var(--st-space-3)] py-[var(--st-space-3)]">
                        <span className="inline-flex items-center gap-1.5 text-[var(--st-text-secondary)]">
                          <Network className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="tabular-nums">{(a.cidrs ?? []).length}</span>
                        </span>
                      </td>
                      <td className="px-[var(--st-space-3)] py-[var(--st-space-3)]">
                        <Badge tone={STATUS_TONE[a.status]} className="capitalize">
                          {a.status}
                        </Badge>
                      </td>
                      <td className="px-[var(--st-space-3)] py-[var(--st-space-3)]">
                        <div className="flex justify-end gap-[var(--st-space-2)]">
                          <Button
                            variant="outline"
                            size="sm"
                            iconLeft={Pencil}
                            onClick={() => openEdit(a)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            iconLeft={Trash2}
                            loading={deletingId === a._id}
                            onClick={() => handleDelete(a)}
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
        title={editing ? 'Edit ACL' : 'New ACL'}
        description="Allow or deny SIP traffic from a set of IP ranges (CIDR)."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editing ? 'Save changes' : 'Create ACL'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-[var(--st-space-3)]">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Office network"
            />
          </Field>

          <div className="grid grid-cols-2 gap-[var(--st-space-3)]">
            <Field label="Action">
              <SelectField
                value={form.action}
                onChange={(v) => setForm((f) => ({ ...f, action: (v as AclAction) ?? 'allow' }))}
                options={[
                  { value: 'allow', label: 'Allow' },
                  { value: 'deny', label: 'Deny' },
                ]}
              />
            </Field>
            <Field label="Applies to">
              <SelectField
                value={form.appliesTo}
                onChange={(v) =>
                  setForm((f) => ({ ...f, appliesTo: (v as AclAppliesTo) ?? 'all' }))
                }
                options={[
                  { value: 'trunk', label: 'Trunk' },
                  { value: 'registration', label: 'Registration' },
                  { value: 'all', label: 'All' },
                ]}
              />
            </Field>
          </div>

          <Field label="CIDRs" help="One per line, or comma-separated (e.g. 10.0.0.0/8, 203.0.113.4/32).">
            <Textarea
              value={form.cidrs}
              onChange={(e) => setForm((f) => ({ ...f, cidrs: e.target.value }))}
              rows={5}
              placeholder={'10.0.0.0/8\n203.0.113.4/32'}
            />
          </Field>

          <Field label="Status">
            <SelectField
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: (v as AclStatus) ?? 'active' }))}
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

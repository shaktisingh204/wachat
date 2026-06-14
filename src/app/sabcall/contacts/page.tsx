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
  StatCard,
  SearchInput,
  EmptyState,
  Skeleton,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  Users,
  UserPlus,
  Star,
  Archive,
  Trash2,
  Pencil,
  Building2,
} from 'lucide-react';
import {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
} from '@/app/sabcall/contacts/actions';

type ContactRow = {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  tags?: string[];
  vip?: boolean;
  notes?: string;
  status: 'active' | 'archived';
};

type ContactForm = {
  name: string;
  phone: string;
  email: string;
  company: string;
  vip: 'yes' | 'no';
  tags: string;
  status: 'active' | 'archived';
};

const EMPTY_FORM: ContactForm = {
  name: '',
  phone: '',
  email: '',
  company: '',
  vip: 'no',
  tags: '',
  status: 'active',
};

const STATUS_TONE: Record<ContactRow['status'], React.ComponentProps<typeof Badge>['tone']> = {
  active: 'success',
  archived: 'neutral',
};

function splitTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function VoiceContactsPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<ContactRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<ContactForm>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listContacts({ q: search, status: statusFilter as ContactRow['status'] | 'all' });
      setData(res.items as ContactRow[]);
    } catch (e) {
      toast.error(`Failed to load contacts: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, toast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (row: ContactRow) => {
    setEditingId(row._id);
    setForm({
      name: row.name,
      phone: row.phone,
      email: row.email ?? '',
      company: row.company ?? '',
      vip: row.vip ? 'yes' : 'no',
      tags: (row.tags ?? []).join(', '),
      status: row.status,
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Name and phone are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        company: form.company.trim() || undefined,
        tags: splitTags(form.tags),
        vip: form.vip === 'yes',
        status: form.status,
      };
      if (editingId) {
        await updateContact(editingId, payload);
        toast.success(`${payload.name} updated`);
      } else {
        await createContact(payload);
        toast.success(`${payload.name} added`);
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

  const handleDelete = async (row: ContactRow) => {
    setDeletingId(row._id);
    try {
      await deleteContact(row._id);
      toast.success(`${row.name} archived`);
      void load();
    } catch (e) {
      toast.error(`Archive failed: ${(e as Error).message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const total = data.length;
  const active = data.filter((c) => c.status === 'active').length;
  const archived = data.filter((c) => c.status === 'archived').length;
  const vipCount = data.filter((c) => c.vip).length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabCall</PageEyebrow>
          <PageTitle>Contacts</PageTitle>
          <PageDescription>Your callable address book — people and companies you reach.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={UserPlus} onClick={openNew}>
            New contact
          </Button>
        </PageActions>
      </PageHeader>

      <section aria-label="Contact metrics" className="grid grid-cols-2 gap-[var(--st-space-3)] md:grid-cols-4">
        <StatCard label="Total" value={total} icon={Users} accent="#3b7af5" />
        <StatCard label="Active" value={active} icon={UserPlus} accent="#1f9d55" />
        <StatCard label="VIP" value={vipCount} icon={Star} accent="#d97706" />
        <StatCard label="Archived" value={archived} icon={Archive} accent="#64748b" />
      </section>

      <Card variant="outlined" padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-end gap-[var(--st-space-3)] border-b border-[var(--st-border)] p-[var(--st-space-4)]">
          <div className="min-w-[220px] flex-1">
            <Field label="Search">
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder="Search name, phone, email, or company"
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
                { value: 'archived', label: 'Archived' },
              ]}
            />
          </Field>
        </div>

        <div className="p-[var(--st-space-4)]">
          {loading ? (
            <div className="flex flex-col gap-[var(--st-space-2)]">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No contacts yet"
              description="Add your first contact to start calling people and companies."
              action={
                <Button variant="primary" iconLeft={UserPlus} onClick={openNew}>
                  New contact
                </Button>
              }
            />
          ) : (
            <Table hover zebra>
              <THead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Phone</Th>
                  <Th>Company</Th>
                  <Th align="center">VIP</Th>
                  <Th>Status</Th>
                  <Th align="right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {data.map((c) => (
                  <Tr key={c._id}>
                    <Td>
                      <div className="flex flex-col">
                        <span className="text-[var(--st-text)]">{c.name}</span>
                        {c.email ? (
                          <span className="text-xs text-[var(--st-text-secondary)]">{c.email}</span>
                        ) : null}
                      </div>
                    </Td>
                    <Td>
                      <span className="font-mono tabular-nums text-[var(--st-text)]">{c.phone}</span>
                    </Td>
                    <Td>
                      {c.company ? (
                        <span className="inline-flex items-center gap-1.5 text-[var(--st-text)]">
                          <Building2 className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                          {c.company}
                        </span>
                      ) : (
                        <span className="text-[var(--st-text-secondary)]">—</span>
                      )}
                    </Td>
                    <Td align="center">
                      {c.vip ? (
                        <Badge tone="warning" className="inline-flex items-center gap-1">
                          <Star className="h-3 w-3" aria-hidden="true" />
                          VIP
                        </Badge>
                      ) : (
                        <span className="text-[var(--st-text-secondary)]">—</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[c.status]} className="capitalize">
                        {c.status}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" size="sm" iconLeft={Pencil} onClick={() => openEdit(c)}>
                          Edit
                        </Button>
                        {c.status !== 'archived' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            iconLeft={Trash2}
                            loading={deletingId === c._id}
                            onClick={() => handleDelete(c)}
                          >
                            Archive
                          </Button>
                        ) : null}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </Card>

      <Modal
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingId ? 'Edit contact' : 'New contact'}
        description="Capture the details you need to reach this person or company."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editingId ? 'Save changes' : 'Add contact'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-[var(--st-space-3)]">
          <div className="grid grid-cols-2 gap-[var(--st-space-3)]">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ada Lovelace"
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+14155550100"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-[var(--st-space-3)]">
            <Field label="Email">
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="ada@example.com"
              />
            </Field>
            <Field label="Company">
              <Input
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                placeholder="Analytical Engines Ltd"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-[var(--st-space-3)]">
            <Field label="VIP">
              <SelectField
                value={form.vip}
                onChange={(v) => setForm((f) => ({ ...f, vip: (v as ContactForm['vip']) ?? 'no' }))}
                options={[
                  { value: 'no', label: 'No' },
                  { value: 'yes', label: 'Yes' },
                ]}
              />
            </Field>
            <Field label="Status">
              <SelectField
                value={form.status}
                onChange={(v) => setForm((f) => ({ ...f, status: (v as ContactForm['status']) ?? 'active' }))}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'archived', label: 'Archived' },
                ]}
              />
            </Field>
          </div>
          <Field label="Tags" help="Comma-separated, e.g. lead, west-coast, priority">
            <Input
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="lead, west-coast"
            />
          </Field>
        </div>
      </Modal>
    </main>
  );
}

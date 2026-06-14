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
import { Clock, Plus, Pencil, Trash2, CalendarClock } from 'lucide-react';
import {
  listBusinessHours,
  createBusinessHours,
  updateBusinessHours,
  deleteBusinessHours,
} from './actions';

const WEEKDAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
] as const;

type DayKey = (typeof WEEKDAYS)[number]['key'];

type Rule = { day: string; open: string; close: string };

type BusinessHoursRow = {
  _id: string;
  name: string;
  timezone: string;
  rules: Rule[];
  status: string;
};

type DayInput = { open: string; close: string };

type FormState = {
  name: string;
  timezone: string;
  status: string;
  days: Record<DayKey, DayInput>;
};

function emptyDays(): Record<DayKey, DayInput> {
  return WEEKDAYS.reduce(
    (acc, d) => {
      acc[d.key] = { open: '', close: '' };
      return acc;
    },
    {} as Record<DayKey, DayInput>,
  );
}

const EMPTY_FORM: FormState = {
  name: '',
  timezone: 'UTC',
  status: 'active',
  days: emptyDays(),
};

const STATUS_TONE: Record<string, React.ComponentProps<typeof Badge>['tone']> = {
  active: 'success',
  disabled: 'neutral',
};

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
];

/** A day is open when both an open and close time are filled in. */
function buildRules(days: Record<DayKey, DayInput>): Rule[] {
  return WEEKDAYS.filter((d) => days[d.key].open.trim() && days[d.key].close.trim()).map((d) => ({
    day: d.key,
    open: days[d.key].open.trim(),
    close: days[d.key].close.trim(),
  }));
}

function rulesToDays(rules: Rule[]): Record<DayKey, DayInput> {
  const days = emptyDays();
  for (const r of rules ?? []) {
    if (r.day in days) {
      days[r.day as DayKey] = { open: r.open ?? '', close: r.close ?? '' };
    }
  }
  return days;
}

export default function BusinessHoursPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<BusinessHoursRow[]>([]);
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
      const res = await listBusinessHours({ q: search, status: statusFilter });
      setData(res.items as BusinessHoursRow[]);
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

  const openEdit = (h: BusinessHoursRow) => {
    setEditingId(h._id);
    setForm({
      name: h.name,
      timezone: h.timezone || 'UTC',
      status: h.status || 'active',
      days: rulesToDays(h.rules ?? []),
    });
    setIsFormOpen(true);
  };

  const setDay = (key: DayKey, field: keyof DayInput, value: string) => {
    setForm((f) => ({
      ...f,
      days: { ...f.days, [key]: { ...f.days[key], [field]: value } },
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required.');
      return;
    }
    if (!form.timezone.trim()) {
      toast.error('Timezone is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        timezone: form.timezone,
        rules: buildRules(form.days),
        status: form.status,
      };
      if (editingId) {
        await updateBusinessHours(editingId, payload);
        toast.success(`${form.name} updated`);
      } else {
        await createBusinessHours(payload);
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
      await deleteBusinessHours(id);
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
          <PageTitle>Business hours</PageTitle>
          <PageDescription>
            Define weekly open hours used to route calls when you are open or closed.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus} onClick={openCreate} className="sc-press">
            New schedule
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
              icon={Clock}
              title="No business hours yet"
              description="Create a weekly schedule to control open and closed call routing."
              action={
                <Button variant="primary" iconLeft={Plus} onClick={openCreate} className="sc-press">
                  New schedule
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--st-border)] text-left text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                    <th className="py-[var(--st-space-2)] pr-[var(--st-space-3)] font-medium">Name</th>
                    <th className="py-[var(--st-space-2)] pr-[var(--st-space-3)] font-medium">Timezone</th>
                    <th className="py-[var(--st-space-2)] pr-[var(--st-space-3)] font-medium">Open days</th>
                    <th className="py-[var(--st-space-2)] pr-[var(--st-space-3)] font-medium">Status</th>
                    <th className="py-[var(--st-space-2)] font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((h) => (
                    <tr key={h._id} className="border-b border-[var(--st-border)] last:border-0">
                      <td className="py-[var(--st-space-3)] pr-[var(--st-space-3)] font-medium text-[var(--st-text)]">
                        <span className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                          {h.name}
                        </span>
                      </td>
                      <td className="py-[var(--st-space-3)] pr-[var(--st-space-3)] font-mono text-[var(--st-text-secondary)]">
                        {h.timezone}
                      </td>
                      <td className="py-[var(--st-space-3)] pr-[var(--st-space-3)] text-[var(--st-text-secondary)]">
                        {(h.rules ?? []).length}
                      </td>
                      <td className="py-[var(--st-space-3)] pr-[var(--st-space-3)]">
                        <Badge tone={STATUS_TONE[h.status] ?? 'neutral'} className="capitalize">
                          {h.status}
                        </Badge>
                      </td>
                      <td className="py-[var(--st-space-3)]">
                        <div className="flex justify-end gap-[var(--st-space-2)]">
                          <Button
                            variant="outline"
                            size="sm"
                            iconLeft={Pencil}
                            onClick={() => openEdit(h)}
                            className="sc-press"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            iconLeft={Trash2}
                            loading={deletingId === h._id}
                            onClick={() => handleDelete(h._id, h.name)}
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
        title={editingId ? 'Edit business hours' : 'New business hours'}
        description="Set the timezone and weekly hours. Leave a day's times blank to mark it closed."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving} className="sc-press">
              {editingId ? 'Save changes' : 'Create schedule'}
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
                placeholder="Standard hours"
              />
            </Field>
            <Field label="Timezone">
              <Input
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
                placeholder="UTC"
              />
            </Field>
          </div>
          <Field label="Status">
            <SelectField
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: v ?? 'active' }))}
              options={STATUS_OPTIONS}
            />
          </Field>

          <Field label="Weekly hours">
            <div className="flex flex-col gap-[var(--st-space-2)]">
              {WEEKDAYS.map((d) => (
                <div
                  key={d.key}
                  className="grid grid-cols-[110px_1fr_1fr] items-center gap-[var(--st-space-2)]"
                >
                  <span className="text-sm text-[var(--st-text-secondary)]">{d.label}</span>
                  <Input
                    value={form.days[d.key].open}
                    onChange={(e) => setDay(d.key, 'open', e.target.value)}
                    placeholder="Open (e.g. 09:00)"
                  />
                  <Input
                    value={form.days[d.key].close}
                    onChange={(e) => setDay(d.key, 'close', e.target.value)}
                    placeholder="Close (e.g. 17:00)"
                  />
                </div>
              ))}
            </div>
          </Field>
        </div>
      </Modal>
    </main>
  );
}

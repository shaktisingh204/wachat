'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  Button,
  IconButton,
  Card,
  Badge,
  Field,
  Input,
  StatCard,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  createOrganization,
  deleteOrganization,
} from '@/app/actions/platform/org-switcher.actions';
import type { Organization } from '@/types/platform';
import { Plus, Trash2, Building, Crown, Search } from 'lucide-react';

interface OrgSwitcherClientProps {
  initialData: Organization[];
}

export default function OrgSwitcherClient({ initialData }: OrgSwitcherClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [form, setForm] = useState({ name: '', slug: '', role: 'owner', active: true });

  const handleCreate = () => {
    if (!form.name || !form.slug) return;
    startTransition(async () => {
      try {
        await createOrganization(form);
        toast.success('Organization created');
        setDialogOpen(false);
        setForm({ name: '', slug: '', role: 'owner', active: true });
      } catch {
        toast.error('Error creating organization');
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure?')) return;
    startTransition(async () => {
      try {
        await deleteOrganization(id);
        toast.success('Organization deleted');
      } catch {
        toast.error('Error deleting organization');
      }
    });
  };

  const stats = useMemo(() => {
    const owned = initialData.filter((d) => d.role === 'owner').length;
    return { total: initialData.length, owned };
  }, [initialData]);

  const filteredData = initialData.filter((d) =>
    d.name.toLowerCase().includes(query.toLowerCase()),
  );

  const newButton = (
    <Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>
      New organization
    </Button>
  );

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Platform</PageEyebrow>
          <PageTitle>Organizations</PageTitle>
          <PageDescription>
            Manage the workspaces you belong to and switch between them.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>{newButton}</PageActions>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Organizations" value={stats.total} icon={Building} />
        <StatCard label="Owned by you" value={stats.owned} icon={Crown} />
        <StatCard
          label="Member of"
          value={stats.total - stats.owned}
          icon={Building}
        />
      </div>

      <div className="w-full sm:max-w-sm">
        <Field label="Search organizations" className="[&_.u-field__label]:sr-only">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search organizations…"
            iconLeft={Search}
          />
        </Field>
      </div>

      {filteredData.length === 0 ? (
        <Card className="flex min-h-[240px] items-center justify-center">
          <EmptyState
            icon={Building}
            title={query ? 'No matching organizations' : 'No organizations yet'}
            description={
              query
                ? 'Try a different search term.'
                : 'Create your first organization to start managing workspaces.'
            }
            action={query ? undefined : newButton}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredData.map((item) => (
            <Card
              key={item.id}
              padding="lg"
              variant="interactive"
              className="group flex flex-col justify-between"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]">
                  <Building className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-[var(--st-text)]">
                    {item.name}
                  </h3>
                  <p className="truncate font-mono text-sm text-[var(--st-text-tertiary)]">
                    @{item.slug}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-[var(--st-border)] pt-3">
                <Badge tone={item.role === 'owner' ? 'accent' : 'neutral'} kind="soft" className="capitalize">
                  {item.role}
                </Badge>
                <IconButton
                  icon={Trash2}
                  label={`Delete ${item.name}`}
                  variant="danger"
                  onClick={() => handleDelete(item.id)}
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  disabled={isPending}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New organization</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Field label="Organization name">
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                    slug: e.target.value.toLowerCase().replace(/\s+/g, '-'),
                  })
                }
                placeholder="e.g. Acme Inc"
              />
            </Field>
            <Field label="Slug">
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="font-mono"
              />
            </Field>
            <Field label="Your role">
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger aria-label="Your role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} loading={isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

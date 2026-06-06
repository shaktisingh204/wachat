'use client';

import { useState, useTransition } from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  Button,
  IconButton,
  Card,
  Badge,
  Field,
  Input,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@/components/sabcrm/20ui';
import { createOrganization, deleteOrganization } from '@/app/actions/platform/org-switcher.actions';
import type { Organization } from '@/types/platform';
import { Plus, Trash2, Building } from 'lucide-react';

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
      } catch (err) {
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
      } catch (err) {
        toast.error('Error deleting organization');
      }
    });
  };

  const filteredData = initialData.filter((d) =>
    d.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <EntityListShell
      title="Organizations"
      subtitle="Manage your organizations and workspaces."
      primaryAction={
        <Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>
          New Organization
        </Button>
      }
      search={{ value: query, onChange: setQuery, placeholder: 'Search orgs...' }}
    >
      {filteredData.length === 0 ? (
        <EmptyState
          icon={Building}
          title="No organizations found"
          description="Create your first organization to start managing workspaces."
          action={
            <Button variant="primary" iconLeft={Plus} onClick={() => setDialogOpen(true)}>
              New Organization
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredData.map((item) => (
            <Card
              key={item.id}
              padding="lg"
              className="group flex flex-col justify-between transition-all hover:border-[var(--st-accent)]"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-hover)]">
                    <Building className="h-5 w-5 text-[var(--st-text)]" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[var(--st-text)]">{item.name}</h3>
                    <p className="text-sm text-[var(--st-text-tertiary)]">@{item.slug}</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-[var(--st-border)] pt-4">
                <Badge tone="neutral" className="capitalize">
                  {item.role}
                </Badge>
                <IconButton
                  icon={Trash2}
                  label={`Delete ${item.name}`}
                  variant="ghost"
                  onClick={() => handleDelete(item.id)}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
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
            <DialogTitle>New Organization</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Field label="Organization Name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Slug">
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </Field>
            <Field label="Your Role">
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger aria-label="Your Role">
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
    </EntityListShell>
  );
}

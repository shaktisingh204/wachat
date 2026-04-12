'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuPlus, LuTrash2, LuUsers, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayInput } from '@/components/clay';
import { getContactGroups, saveContactGroup, deleteContactGroup } from '@/app/actions/wachat-features.actions';

export default function ContactGroupsPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [groups, setGroups] = useState<any[]>([]);

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getContactGroups(String(activeProject._id));
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      setGroups(res.groups ?? []);
    });
  }, [activeProject?._id, toast]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (fd: FormData) => {
    fd.set('projectId', String(activeProject?._id ?? ''));
    const res = await saveContactGroup(null, fd);
    if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
    toast({ title: res.message });
    load();
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteContactGroup(id);
      if (!res.success) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      toast({ title: 'Group deleted.' });
      load();
    });
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Contact Groups' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Contact Groups</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Organise contacts into groups for targeted broadcasts.</p>
      </div>

      {/* Create form */}
      <ClayCard padded={false} className="p-5">
        <h2 className="mb-4 text-[15px] font-semibold text-clay-ink">New Group</h2>
        <form action={handleCreate} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-clay-ink-muted">
            Name <ClayInput name="name" placeholder="e.g. VIP Customers" required className="w-56" />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-[12px] font-medium text-clay-ink-muted">
            Description <ClayInput name="description" placeholder="Optional description" className="w-full" />
          </label>
          <ClayButton type="submit" variant="obsidian" size="sm" leading={<LuPlus className="h-3.5 w-3.5" />}>
            Create
          </ClayButton>
        </form>
      </ClayCard>

      {/* Groups grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isPending && groups.length === 0 && (
          <div className="col-span-full flex justify-center py-12">
            <LuLoader className="h-5 w-5 animate-spin text-clay-ink-muted" />
          </div>
        )}
        {groups.map((g) => (
          <ClayCard key={g._id} padded={false} className="flex flex-col gap-3 p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-clay-rose-soft text-clay-rose-ink">
                  <LuUsers className="h-4 w-4" strokeWidth={2} />
                </span>
                <div>
                  <div className="text-[14px] font-semibold text-clay-ink">{g.name}</div>
                  {g.description && <div className="mt-0.5 text-[12px] text-clay-ink-muted">{g.description}</div>}
                </div>
              </div>
              <ClayButton variant="ghost" size="icon" className="h-7 w-7 text-clay-ink-soft hover:text-clay-red" onClick={() => handleDelete(g._id)}>
                <LuTrash2 className="h-3.5 w-3.5" />
              </ClayButton>
            </div>
            <div className="flex items-center justify-between border-t border-clay-border pt-3 text-[12px] text-clay-ink-muted">
              <span>{g.memberCount ?? 0} members</span>
              <span>{g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '--'}</span>
            </div>
          </ClayCard>
        ))}
      </div>
      {!isPending && groups.length === 0 && (
        <p className="py-8 text-center text-[13px] text-clay-ink-muted">No groups yet. Create one above.</p>
      )}
      <div className="h-6" />
    </div>
  );
}

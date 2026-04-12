'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuPlus, LuPencil, LuTrash2, LuMessageSquare, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayInput, ClaySelect, ClayBadge } from '@/components/clay';
import { getSavedReplies, saveSavedReply, deleteSavedReply } from '@/app/actions/wachat-features.actions';

const CATEGORIES = [
  { value: 'General', label: 'General' },
  { value: 'Sales', label: 'Sales' },
  { value: 'Support', label: 'Support' },
  { value: 'Onboarding', label: 'Onboarding' },
  { value: 'Billing', label: 'Billing' },
];

const catTone: Record<string, 'neutral' | 'blue' | 'green' | 'amber' | 'rose-soft' | 'red'> = {
  General: 'neutral', Sales: 'blue', Support: 'green', Onboarding: 'amber', Billing: 'rose-soft',
};

export default function SavedRepliesPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [replies, setReplies] = useState<any[]>([]);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getSavedReplies(String(activeProject._id));
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      setReplies(res.replies ?? []);
    });
  }, [activeProject?._id, toast]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (fd: FormData) => {
    fd.set('projectId', String(activeProject?._id ?? ''));
    if (editId) fd.set('replyId', editId);
    const res = await saveSavedReply(null, fd);
    if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
    toast({ title: res.message });
    setEditId(null);
    load();
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteSavedReply(id);
      if (!res.success) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      toast({ title: 'Reply deleted.' });
      load();
    });
  };

  const editing = editId ? replies.find((r) => r._id === editId) : null;
  const grouped = replies.reduce<Record<string, any[]>>((acc, r) => {
    const cat = r.category || 'General';
    (acc[cat] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Saved Replies' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Saved Replies</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Create shortcut replies your team can use in conversations.</p>
      </div>

      {/* Create / edit form */}
      <ClayCard padded={false} className="p-5">
        <h2 className="mb-4 text-[15px] font-semibold text-clay-ink">{editId ? 'Edit Reply' : 'New Reply'}</h2>
        <form action={handleSave} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-clay-ink-muted">
              Shortcut <ClayInput name="shortcut" placeholder="/greeting" required defaultValue={editing?.shortcut ?? ''} className="w-40" />
            </label>
            <label className="flex flex-1 flex-col gap-1.5 text-[12px] font-medium text-clay-ink-muted">
              Title <ClayInput name="title" placeholder="Quick hello" defaultValue={editing?.title ?? ''} className="w-full" />
            </label>
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-clay-ink-muted">
              Category <ClaySelect name="category" options={CATEGORIES} defaultValue={editing?.category ?? 'General'} className="w-36" />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-clay-ink-muted">
            Body
            <textarea name="body" required rows={3} defaultValue={editing?.body ?? ''} placeholder="Type the reply body..."
              className="clay-input min-h-[72px] resize-y py-2.5" />
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-clay-ink-muted">
            Media URL (optional) <ClayInput name="mediaUrl" placeholder="https://..." defaultValue={editing?.mediaUrl ?? ''} />
          </label>
          <div className="flex gap-2">
            <ClayButton type="submit" variant="obsidian" size="sm" leading={<LuPlus className="h-3.5 w-3.5" />}>
              {editId ? 'Update' : 'Create'}
            </ClayButton>
            {editId && <ClayButton size="sm" onClick={() => setEditId(null)}>Cancel</ClayButton>}
          </div>
        </form>
      </ClayCard>

      {/* Grouped list */}
      {isPending && replies.length === 0 && (
        <div className="flex justify-center py-12"><LuLoader className="h-5 w-5 animate-spin text-clay-ink-muted" /></div>
      )}
      {Object.entries(grouped).map(([cat, items]) => (
        <ClayCard key={cat} padded={false} className="p-5">
          <h3 className="mb-3 text-[14px] font-semibold text-clay-ink">{cat}</h3>
          <div className="space-y-1">
            <div className="grid grid-cols-[100px_1fr_2fr_90px_72px] gap-3 pb-2 text-[11.5px] font-medium text-clay-ink-muted">
              <span>Shortcut</span><span>Title</span><span>Body</span><span>Category</span><span />
            </div>
            {items.map((r: any) => (
              <div key={r._id} className="grid grid-cols-[100px_1fr_2fr_90px_72px] items-center gap-3 rounded-clay-md px-1 py-2 text-[13px] text-clay-ink hover:bg-clay-surface-2">
                <span className="font-mono text-[12px] text-clay-rose-ink">{r.shortcut}</span>
                <span className="truncate font-medium">{r.title}</span>
                <span className="truncate text-clay-ink-muted">{r.body}</span>
                <ClayBadge tone={catTone[r.category] ?? 'neutral'}>{r.category}</ClayBadge>
                <div className="flex gap-1">
                  <ClayButton variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditId(r._id)}>
                    <LuPencil className="h-3.5 w-3.5" />
                  </ClayButton>
                  <ClayButton variant="ghost" size="icon" className="h-7 w-7 text-clay-ink-soft hover:text-clay-red" onClick={() => handleDelete(r._id)}>
                    <LuTrash2 className="h-3.5 w-3.5" />
                  </ClayButton>
                </div>
              </div>
            ))}
          </div>
        </ClayCard>
      ))}
      {!isPending && replies.length === 0 && (
        <p className="py-8 text-center text-[13px] text-clay-ink-muted">No saved replies yet.</p>
      )}
      <div className="h-6" />
    </div>
  );
}

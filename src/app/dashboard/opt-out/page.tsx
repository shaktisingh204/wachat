'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuShieldOff, LuPlus, LuTrash2, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayInput } from '@/components/clay';
import { getOptOutList, addToOptOut, removeFromOptOut } from '@/app/actions/wachat-features.actions';

export default function OptOutPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [list, setList] = useState<any[]>([]);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getOptOutList(String(activeProject._id));
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      setList(res.optOuts ?? []);
    });
  }, [activeProject?._id, toast]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    const res = await addToOptOut(String(activeProject?._id ?? ''), phone.trim(), reason.trim() || undefined);
    if (!res.success) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
    toast({ title: 'Number added to opt-out list.' });
    setPhone('');
    setReason('');
    load();
  };

  const handleRemove = (id: string) => {
    startTransition(async () => {
      const res = await removeFromOptOut(id);
      if (!res.success) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      toast({ title: 'Removed from opt-out list.' });
      load();
    });
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Opt-Out / DND' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Opt-Out / DND Management</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Manage numbers that have opted out of receiving messages.</p>
      </div>

      {/* Add form */}
      <ClayCard padded={false} className="p-5">
        <h2 className="mb-4 text-[15px] font-semibold text-clay-ink">Add to Opt-Out List</h2>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-clay-ink-muted">
            Phone Number
            <ClayInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 234 567 8900" required className="w-52" />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-[12px] font-medium text-clay-ink-muted">
            Reason
            <ClayInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. User requested" className="w-full" />
          </label>
          <ClayButton type="submit" variant="obsidian" size="sm" leading={<LuPlus className="h-3.5 w-3.5" />}>
            Add
          </ClayButton>
        </form>
      </ClayCard>

      {/* List */}
      <ClayCard padded={false} className="p-5">
        <h2 className="mb-4 text-[15px] font-semibold text-clay-ink">Opt-Out Numbers</h2>
        {isPending && list.length === 0 && (
          <div className="flex justify-center py-8"><LuLoader className="h-5 w-5 animate-spin text-clay-ink-muted" /></div>
        )}
        {!isPending && list.length === 0 && (
          <p className="py-8 text-center text-[13px] text-clay-ink-muted">No opt-out numbers recorded.</p>
        )}
        {list.length > 0 && (
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_1fr_140px_48px] gap-3 pb-2 text-[11.5px] font-medium text-clay-ink-muted">
              <span>Phone</span><span>Reason</span><span>Opted Out</span><span />
            </div>
            {list.map((item) => (
              <div key={item._id} className="grid grid-cols-[1fr_1fr_140px_48px] items-center gap-3 rounded-clay-md px-1 py-2 text-[13px] text-clay-ink hover:bg-clay-surface-2">
                <span className="font-medium">{item.phone}</span>
                <span className="text-clay-ink-muted">{item.reason || '--'}</span>
                <span className="text-[12px] text-clay-ink-muted">{item.optedOutAt ? new Date(item.optedOutAt).toLocaleDateString() : '--'}</span>
                <ClayButton variant="ghost" size="icon" className="h-7 w-7 text-clay-ink-soft hover:text-clay-red" onClick={() => handleRemove(item._id)}>
                  <LuTrash2 className="h-3.5 w-3.5" />
                </ClayButton>
              </div>
            ))}
          </div>
        )}
      </ClayCard>
      <div className="h-6" />
    </div>
  );
}

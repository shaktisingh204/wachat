'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuShieldOff, LuPlus, LuTrash2, LuLoader, LuDownload, LuUpload } from 'react-icons/lu';
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

  const handleBulkPaste = async (raw: string) => {
    const phones = raw
      .split(/[\n,;\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (phones.length === 0) return;
    let ok = 0;
    let fail = 0;
    for (const p of phones) {
      const res = await addToOptOut(String(activeProject?._id ?? ''), p);
      if (res.success) ok++;
      else fail++;
    }
    toast({ title: `Bulk add complete`, description: `${ok} added, ${fail} failed.` });
    load();
  };

  const handleExport = () => {
    if (list.length === 0) {
      toast({ title: 'Nothing to export' });
      return;
    }
    const header = 'phone,reason,opted_out_at\n';
    const rows = list.map((i) => `"${i.phone}","${(i.reason || '').replace(/"/g, '""')}","${i.optedOutAt || ''}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opt-out-list-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/dashboard' },
        { label: activeProject?.name || 'Project', href: '/wachat' },
        { label: 'Opt-Out / DND' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">Opt-Out / DND Management</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Manage numbers that have opted out of receiving messages.</p>
      </div>

      {/* Add form */}
      <ClayCard padded={false} className="p-5">
        <h2 className="mb-4 text-[15px] font-semibold text-foreground">Add to Opt-Out List</h2>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-muted-foreground">
            Phone Number
            <ClayInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 234 567 8900" required className="w-52" />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-[12px] font-medium text-muted-foreground">
            Reason
            <ClayInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. User requested" className="w-full" />
          </label>
          <ClayButton type="submit" variant="obsidian" size="sm" leading={<LuPlus className="h-3.5 w-3.5" />}>
            Add
          </ClayButton>
        </form>
      </ClayCard>

      {/* Bulk paste */}
      <ClayCard padded={false} className="p-5">
        <h2 className="mb-3 text-[15px] font-semibold text-foreground">Bulk add</h2>
        <p className="mb-2 text-[12px] text-muted-foreground">Paste multiple phone numbers separated by newlines or commas.</p>
        <textarea
          id="bulk-opt-out"
          rows={4}
          placeholder={'+919876543210\n+919876543211\n+919876543212'}
          className="w-full rounded-[10px] border border-border bg-card p-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-border focus:outline-none"
        />
        <ClayButton
          variant="pill"
          size="sm"
          className="mt-3"
          leading={<LuUpload className="h-3.5 w-3.5" strokeWidth={2} />}
          onClick={() => {
            const el = document.getElementById('bulk-opt-out') as HTMLTextAreaElement | null;
            if (el) {
              handleBulkPaste(el.value);
              el.value = '';
            }
          }}
        >
          Bulk add
        </ClayButton>
      </ClayCard>

      {/* List */}
      <ClayCard padded={false} className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-foreground">Opt-Out Numbers</h2>
          <ClayButton
            variant="pill"
            size="sm"
            leading={<LuDownload className="h-3.5 w-3.5" strokeWidth={2} />}
            onClick={handleExport}
            disabled={list.length === 0}
          >
            Export CSV
          </ClayButton>
        </div>
        {isPending && list.length === 0 && (
          <div className="flex justify-center py-8"><LuLoader className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        )}
        {!isPending && list.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <LuShieldOff className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] text-muted-foreground">No opt-out numbers recorded.</p>
          </div>
        )}
        {list.length > 0 && (
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_1fr_140px_48px] gap-3 pb-2 text-[11.5px] font-medium text-muted-foreground">
              <span>Phone</span><span>Reason</span><span>Opted Out</span><span />
            </div>
            {list.map((item) => (
              <div key={item._id} className="grid grid-cols-[1fr_1fr_140px_48px] items-center gap-3 rounded-lg px-1 py-2 text-[13px] text-foreground hover:bg-secondary">
                <span className="font-medium">{item.phone}</span>
                <span className="text-muted-foreground">{item.reason || '--'}</span>
                <span className="text-[12px] text-muted-foreground">{item.optedOutAt ? new Date(item.optedOutAt).toLocaleDateString() : '--'}</span>
                <ClayButton variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(item._id)}>
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

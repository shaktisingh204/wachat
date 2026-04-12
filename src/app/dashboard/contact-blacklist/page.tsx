'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuShieldBan, LuPlus, LuTrash2, LuUpload, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';
import { getBlacklist, addToBlacklist, removeFromBlacklist, bulkAddToBlacklist } from '@/app/actions/wachat-features.actions';

export default function ContactBlacklistPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();
  const [numbers, setNumbers] = useState<any[]>([]);
  const [phone, setPhone] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [isLoading, startTransition] = useTransition();
  const [isMutating, startMutateTransition] = useTransition();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getBlacklist(projectId);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      setNumbers(res.numbers ?? []);
    });
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = () => {
    const trimmed = phone.trim();
    if (!trimmed || !projectId) return;
    startMutateTransition(async () => {
      const res = await addToBlacklist(projectId, trimmed);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      setPhone('');
      toast({ title: 'Added', description: `${trimmed} blacklisted.` });
      fetchData();
    });
  };

  const handleBulkAdd = () => {
    if (!projectId) return;
    const phones = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (phones.length === 0) return;
    startMutateTransition(async () => {
      const res = await bulkAddToBlacklist(projectId, phones);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      setBulkText('');
      setShowBulk(false);
      toast({ title: 'Added', description: `${res.count} numbers blacklisted.` });
      fetchData();
    });
  };

  const handleRemove = (id: string, phoneNum: string) => {
    startMutateTransition(async () => {
      const res = await removeFromBlacklist(id);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      toast({ title: 'Removed', description: `${phoneNum} removed from blacklist.` });
      fetchData();
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <LuLoader className="h-6 w-6 animate-spin text-clay-ink-muted" />
      </div>
    );
  }

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Contact Blacklist' },
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Contact Blacklist</h1>
          <p className="mt-1.5 text-[13px] text-clay-ink-muted">Block phone numbers from sending messages to your project.</p>
        </div>
        <ClayBadge tone="neutral">{numbers.length} blocked</ClayBadge>
      </div>

      <ClayCard padded={false} className="p-5">
        <h2 className="text-[15px] font-semibold text-clay-ink mb-3">Add Number</h2>
        <div className="flex gap-3">
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="+1234567890" onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="flex-1 rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none" />
          <ClayButton size="sm" onClick={handleAdd} disabled={!phone.trim() || isMutating}>
            <LuPlus className="mr-1.5 h-3.5 w-3.5" /> Add
          </ClayButton>
          <ClayButton size="sm" variant="ghost" onClick={() => setShowBulk(!showBulk)}>
            <LuUpload className="mr-1.5 h-3.5 w-3.5" /> Bulk
          </ClayButton>
        </div>
        {showBulk && (
          <div className="mt-4">
            <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={4}
              placeholder="One phone number per line..." className="clay-input min-h-[80px] resize-y py-2.5 w-full" />
            <ClayButton size="sm" className="mt-2" onClick={handleBulkAdd} disabled={!bulkText.trim() || isMutating}>
              Add All
            </ClayButton>
          </div>
        )}
      </ClayCard>

      {numbers.length > 0 ? (
        <ClayCard padded={false} className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Phone Number</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {numbers.map((item, i) => (
                <tr key={item._id} className="border-b border-clay-border last:border-0">
                  <td className="px-5 py-3 text-[13px] text-clay-ink-muted">{i + 1}</td>
                  <td className="px-5 py-3 font-mono text-[13px] text-clay-ink">{item.phone}</td>
                  <td className="px-5 py-3 text-right">
                    <ClayButton size="sm" variant="ghost" onClick={() => handleRemove(item._id, item.phone)} disabled={isMutating}>
                      <LuTrash2 className="mr-1 h-3.5 w-3.5" /> Remove
                    </ClayButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ClayCard>
      ) : (
        <ClayCard className="p-12 text-center">
          <LuShieldBan className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">No numbers blacklisted.</p>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}

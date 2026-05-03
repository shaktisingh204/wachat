'use client';

/**
 * Wachat Blocked Contacts — manage blocked WhatsApp contacts.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuBan, LuShieldOff, LuPlus } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import {
  getBlockedContacts,
  blockContact,
  unblockContact,
} from '@/app/actions/wachat-features.actions';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

export const dynamic = 'force-dynamic';

export default function BlockedContactsPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<any[]>([]);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [showForm, setShowForm] = useState(false);

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getBlockedContacts(activeProjectId);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else setContacts(res.contacts ?? []);
    });
  }, [activeProjectId, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleBlock = () => {
    if (!activeProjectId || !phone.trim()) return;
    startTransition(async () => {
      const res = await blockContact(activeProjectId, phone.trim(), reason.trim());
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else {
        toast({ title: 'Blocked', description: `${phone} has been blocked.` });
        setPhone(''); setReason(''); setShowForm(false);
        fetchData();
      }
    });
  };

  const handleUnblock = (id: string) => {
    startTransition(async () => {
      const res = await unblockContact(id);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else { toast({ title: 'Unblocked', description: 'Contact unblocked.' }); fetchData(); }
    });
  };

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Blocked Contacts' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
            Blocked Contacts
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-muted-foreground">
            Manage contacts blocked from sending messages to this project.
          </p>
        </div>
        <ClayButton size="sm" onClick={() => setShowForm(!showForm)}>
          <LuPlus className="mr-1.5 h-3.5 w-3.5" /> Block Contact
        </ClayButton>
      </div>

      {showForm && (
        <ClayCard className="p-5">
          <h3 className="text-sm font-medium text-foreground mb-3">Block a Contact</h3>
          <div className="flex flex-wrap gap-3">
            <input
              type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number (e.g. +1234567890)"
              className="flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
            />
            <input
              type="text" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              className="flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
            />
            <ClayButton size="sm" onClick={handleBlock} disabled={isPending || !phone.trim()}>
              <LuBan className="mr-1.5 h-3.5 w-3.5" /> Block
            </ClayButton>
          </div>
        </ClayCard>
      )}

      {contacts.length > 0 ? (
        <ClayCard padded={false} className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Reason</th>
                <th className="px-5 py-3">Blocked Date</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c._id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-mono text-[13px] text-foreground">{c.phone}</td>
                  <td className="px-5 py-3 text-[13px] text-muted-foreground">{c.reason || '--'}</td>
                  <td className="px-5 py-3 text-[13px] text-muted-foreground">
                    {c.blockedAt ? new Date(c.blockedAt).toLocaleDateString() : '--'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <ClayButton size="sm" variant="ghost" onClick={() => handleUnblock(c._id)} disabled={isPending}>
                      <LuShieldOff className="mr-1 h-3.5 w-3.5" /> Unblock
                    </ClayButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ClayCard>
      ) : (
        !isPending && (
          <ClayCard className="p-12 text-center">
            <LuBan className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No blocked contacts.</p>
          </ClayCard>
        )
      )}
    </div>
  );
}

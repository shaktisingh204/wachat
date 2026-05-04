'use client';

/**
 * Wachat Blocked Contacts — rebuilt on ZoruUI primitives (phase 2).
 *
 * Same data, same handlers. Visual primitives swapped to ZoruUI.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { Ban, ShieldOff, Plus, Loader2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import {
  getBlockedContacts,
  blockContact,
  unblockContact,
} from '@/app/actions/wachat-features.actions';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
} from '@/components/zoruui';

export const dynamic = 'force-dynamic';

export default function BlockedContactsPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<any[]>([]);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getBlockedContacts(activeProjectId);
      if (res.error)
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
      else setContacts(res.contacts ?? []);
    });
  }, [activeProjectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBlock = () => {
    if (!activeProjectId || !phone.trim()) return;
    startTransition(async () => {
      const res = await blockContact(
        activeProjectId,
        phone.trim(),
        reason.trim(),
      );
      if (res.error)
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
      else {
        toast({ title: 'Blocked', description: `${phone} has been blocked.` });
        setPhone('');
        setReason('');
        setOpen(false);
        fetchData();
      }
    });
  };

  const handleUnblock = (id: string) => {
    startTransition(async () => {
      const res = await unblockContact(id);
      if (res.error)
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
      else {
        toast({ title: 'Unblocked', description: 'Contact unblocked.' });
        fetchData();
      }
    });
  };

  const isLoadingInitial = isPending && contacts.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat/contacts">
              Contacts
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Blocked</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Blocked Contacts
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-zoru-ink-muted">
            Manage contacts blocked from sending messages to this project.
          </p>
        </div>
        <ZoruDialog open={open} onOpenChange={setOpen}>
          <ZoruDialogTrigger asChild>
            <ZoruButton size="sm">
              <Plus /> Block contact
            </ZoruButton>
          </ZoruDialogTrigger>
          <ZoruDialogContent>
            <ZoruDialogHeader>
              <ZoruDialogTitle>Block a contact</ZoruDialogTitle>
              <ZoruDialogDescription>
                Block a phone number from sending messages to this project.
              </ZoruDialogDescription>
            </ZoruDialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <ZoruLabel htmlFor="block-phone" required>
                  Phone number
                </ZoruLabel>
                <ZoruInput
                  id="block-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1234567890"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <ZoruLabel htmlFor="block-reason">Reason (optional)</ZoruLabel>
                <ZoruInput
                  id="block-reason"
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this contact being blocked?"
                />
              </div>
            </div>
            <ZoruDialogFooter>
              <ZoruButton variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </ZoruButton>
              <ZoruButton
                variant="destructive"
                onClick={handleBlock}
                disabled={isPending || !phone.trim()}
              >
                {isPending ? <Loader2 className="animate-spin" /> : <Ban />}
                Block
              </ZoruButton>
            </ZoruDialogFooter>
          </ZoruDialogContent>
        </ZoruDialog>
      </div>

      {isLoadingInitial ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : contacts.length > 0 ? (
        <ZoruCard className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zoru-line text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Reason</th>
                <th className="px-5 py-3">Blocked Date</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zoru-line">
              {contacts.map((c) => (
                <tr key={c._id}>
                  <td className="px-5 py-3 font-mono text-[13px] text-zoru-ink">
                    {c.phone}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-zoru-ink-muted">
                    {c.reason || '—'}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-zoru-ink-muted">
                    {c.blockedAt
                      ? new Date(c.blockedAt).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <ZoruAlertDialog>
                      <ZoruAlertDialogTrigger asChild>
                        <ZoruButton
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                        >
                          <ShieldOff /> Unblock
                        </ZoruButton>
                      </ZoruAlertDialogTrigger>
                      <ZoruAlertDialogContent>
                        <ZoruAlertDialogHeader>
                          <ZoruAlertDialogTitle>
                            Unblock this contact?
                          </ZoruAlertDialogTitle>
                          <ZoruAlertDialogDescription>
                            {c.phone} will be allowed to send messages again.
                          </ZoruAlertDialogDescription>
                        </ZoruAlertDialogHeader>
                        <ZoruAlertDialogFooter>
                          <ZoruAlertDialogCancel>
                            Cancel
                          </ZoruAlertDialogCancel>
                          <ZoruAlertDialogAction
                            onClick={() => handleUnblock(c._id)}
                          >
                            Unblock
                          </ZoruAlertDialogAction>
                        </ZoruAlertDialogFooter>
                      </ZoruAlertDialogContent>
                    </ZoruAlertDialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ZoruCard>
      ) : (
        <ZoruEmptyState
          icon={<Ban />}
          title="No blocked contacts"
          description="Use the Block contact button above to block a phone number from contacting your project."
        />
      )}
      <div className="h-6" />
    </div>
  );
}

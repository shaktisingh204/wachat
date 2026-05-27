'use client';

import { fmtDate } from '@/lib/utils';

import {
  useZoruToast,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Input,
  Label,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
} from 'react';
import { Ban, ShieldOff, Plus, Loader2 } from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import {
  getBlockedContacts,
  blockContact,
  unblockContact,
} from '@/app/actions/wachat-features.actions';

import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  EmptyState,
  StatusPill,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import * as React from 'react';

export default function BlockedContactsPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<any[]>([]);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getBlockedContacts(activeProjectId);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else setContacts(res.contacts ?? []);
    });
  }, [activeProjectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBlock = () => {
    if (!activeProjectId || !phone.trim()) return;
    startTransition(async () => {
      const res = await blockContact(activeProjectId, phone.trim(), reason.trim());
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
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
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else {
        toast({ title: 'Unblocked', description: 'Contact unblocked.' });
        fetchData();
      }
    });
  };

  const isLoadingInitial = isPending && contacts.length === 0;
  const stagger = reduceMotion ? 0 : 0.03;

  return (
    <WaPage>
      <PageHeader
        title="Blocked contacts"
        description="Manage contacts blocked from sending messages to this project."
        kicker="Wachat · contacts"
        backHref="/wachat/contacts"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
              <WaButton leftIcon={Plus}>Block contact</WaButton>
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
                  <Label htmlFor="block-phone" required>Phone number</Label>
                  <Input
                    id="block-phone"
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1234567890"
                    className="rounded-xl"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="block-reason">Reason (optional)</Label>
                  <Input
                    id="block-reason"
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why is this contact being blocked?"
                    className="rounded-xl"
                  />
                </div>
              </div>
              <ZoruDialogFooter>
                <WaButton variant="outline" onClick={() => setOpen(false)}>Cancel</WaButton>
                <WaButton onClick={handleBlock} disabled={isPending || !phone.trim()} leftIcon={isPending ? Loader2 : Ban}>
                  Block
                </WaButton>
              </ZoruDialogFooter>
            </ZoruDialogContent>
          </Dialog>
        }
      />

      <Section
        title="Blocked numbers"
        action={<StatusPill tone="failed">{contacts.length} blocked</StatusPill>}
        padded={false}
      >
        {isLoadingInitial ? (
          <div className="divide-y divide-zinc-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 animate-pulse rounded-full bg-zinc-100" />
                  <div className="h-2.5 w-44 animate-pulse rounded-full bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="px-5 py-12">
            <EmptyState
              icon={Ban}
              title="No blocked contacts"
              description="Use the Block contact button above to block a phone number from contacting your project."
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            <AnimatePresence initial={false}>
              {contacts.map((c, i) => (
                <m.li
                  key={c._id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, delay: i * stagger, ease: EASE_OUT }}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600">
                    <Ban className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[13.5px] font-medium tabular-nums text-zinc-900">{c.phone}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11.5px] text-zinc-500">
                      {c.reason && <span className="truncate">{c.reason}</span>}
                      {c.blockedAt && <span className="tabular-nums">Blocked {fmtDate(c.blockedAt)}</span>}
                    </div>
                  </div>
                  <ZoruAlertDialog>
                    <ZoruAlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-zinc-700 transition-colors hover:border-zinc-900 active:scale-[0.97]"
                        disabled={isPending}
                      >
                        <ShieldOff className="h-3 w-3" strokeWidth={2.25} />
                        Unblock
                      </button>
                    </ZoruAlertDialogTrigger>
                    <ZoruAlertDialogContent>
                      <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Unblock this contact?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                          {c.phone} will be allowed to send messages again.
                        </ZoruAlertDialogDescription>
                      </ZoruAlertDialogHeader>
                      <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={() => handleUnblock(c._id)}>
                          Unblock
                        </ZoruAlertDialogAction>
                      </ZoruAlertDialogFooter>
                    </ZoruAlertDialogContent>
                  </ZoruAlertDialog>
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Section>
    </WaPage>
  );
}

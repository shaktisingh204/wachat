'use client';

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
  Textarea,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
} from 'react';
import {
  ShieldBan,
  Plus,
  Trash2,
  Upload,
  Loader2,
} from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import {
  getBlacklist,
  addToBlacklist,
  removeFromBlacklist,
  bulkAddToBlacklist,
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

export default function ContactBlacklistPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const [numbers, setNumbers] = useState<any[]>([]);
  const [phone, setPhone] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [isLoading, startTransition] = useTransition();
  const [isMutating, startMutateTransition] = useTransition();
  const reduceMotion = useReducedMotion();

  const fetchData = useCallback(() => {
    if (!projectId) return;
    startTransition(async () => {
      const res = await getBlacklist(projectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setNumbers(res.numbers ?? []);
    });
  }, [projectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = () => {
    const trimmed = phone.trim();
    if (!trimmed || !projectId) return;
    startMutateTransition(async () => {
      const res = await addToBlacklist(projectId, trimmed);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setPhone('');
      toast({ title: 'Added', description: `${trimmed} blacklisted.` });
      fetchData();
    });
  };

  const handleBulkAdd = () => {
    if (!projectId) return;
    const phones = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (phones.length === 0) return;
    startMutateTransition(async () => {
      const res = await bulkAddToBlacklist(projectId, phones);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setBulkText('');
      setBulkOpen(false);
      toast({ title: 'Added', description: `${res.count} numbers blacklisted.` });
      fetchData();
    });
  };

  const handleRemove = (id: string, phoneNum: string) => {
    startMutateTransition(async () => {
      const res = await removeFromBlacklist(id);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Removed', description: `${phoneNum} removed from blacklist.` });
      fetchData();
    });
  };

  const isLoadingInitial = isLoading && numbers.length === 0;
  const stagger = reduceMotion ? 0 : 0.03;

  return (
    <WaPage>
      <PageHeader
        title="Contact blacklist"
        description="Block phone numbers from sending messages to your project."
        kicker="Wachat · contacts"
        backHref="/wachat/contacts"
        actions={
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <ZoruDialogTrigger asChild>
              <WaButton variant="outline" leftIcon={Upload}>Bulk add</WaButton>
            </ZoruDialogTrigger>
            <ZoruDialogContent>
              <ZoruDialogHeader>
                <ZoruDialogTitle>Bulk add to blacklist</ZoruDialogTitle>
                <ZoruDialogDescription>
                  Paste one phone number per line. All numbers will be blocked from contacting this project.
                </ZoruDialogDescription>
              </ZoruDialogHeader>
              <Textarea
                rows={6}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'+1234567890\n+19876543210\n...'}
                className="min-h-[160px]"
              />
              <ZoruDialogFooter>
                <WaButton variant="outline" onClick={() => setBulkOpen(false)}>Cancel</WaButton>
                <WaButton onClick={handleBulkAdd} disabled={!bulkText.trim() || isMutating}>
                  {isMutating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Add all
                </WaButton>
              </ZoruDialogFooter>
            </ZoruDialogContent>
          </Dialog>
        }
      />

      {/* Add a number */}
      <Section
        title="Add a number"
        description="Block individual phone numbers from this project."
        className="mb-6"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
            <Label htmlFor="bl-phone">Phone number</Label>
            <Input
              id="bl-phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1234567890"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="rounded-xl"
            />
          </div>
          <WaButton onClick={handleAdd} disabled={!phone.trim() || isMutating} leftIcon={Plus}>
            Block number
          </WaButton>
        </div>
      </Section>

      {/* List */}
      <Section
        title="Blocked numbers"
        action={<StatusPill tone="failed">{numbers.length} blocked</StatusPill>}
        padded={false}
      >
        {isLoadingInitial ? (
          <div className="divide-y divide-zinc-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="h-3 w-40 animate-pulse rounded-full bg-zinc-100" />
              </div>
            ))}
          </div>
        ) : numbers.length === 0 ? (
          <div className="px-5 py-12">
            <EmptyState
              icon={ShieldBan}
              title="No numbers blacklisted"
              description="Add phone numbers above to block them from contacting this project."
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            <AnimatePresence initial={false}>
              {numbers.map((item, i) => (
                <m.li
                  key={item._id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, delay: i * stagger, ease: EASE_OUT }}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-50 text-rose-600">
                    <ShieldBan className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  </span>
                  <span className="text-[10.5px] font-semibold tabular-nums text-zinc-400">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="flex-1 truncate font-mono text-[13.5px] tabular-nums text-zinc-900">{item.phone}</p>
                  <ZoruAlertDialog>
                    <ZoruAlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-rose-600 transition-colors hover:bg-rose-50 active:scale-[0.97]"
                        disabled={isMutating}
                      >
                        <Trash2 className="h-3 w-3" strokeWidth={2.25} />
                        Remove
                      </button>
                    </ZoruAlertDialogTrigger>
                    <ZoruAlertDialogContent>
                      <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Remove from blacklist?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                          {item.phone} will be allowed to message your project again.
                        </ZoruAlertDialogDescription>
                      </ZoruAlertDialogHeader>
                      <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                          destructive
                          onClick={() => handleRemove(item._id, item.phone)}
                        >
                          Remove
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

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
  Input,
  cn,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
} from 'react';
import {
  Search,
  GitMerge,
  Check,
  Loader2,
  Users,
  ArrowRight,
} from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import { getContactsPageData, updateContactTags } from '@/app/actions/contact.actions';

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

export default function ContactMergePage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<[string | null, string | null]>([null, null]);
  const [merging, setMerging] = useState(false);
  const reduceMotion = useReducedMotion();

  const load = useCallback(
    (search = '') => {
      if (!activeProject?._id) return;
      startTransition(async () => {
        const res = await getContactsPageData(
          String(activeProject._id),
          undefined,
          1,
          search,
        );
        setContacts(res.contacts ?? []);
      });
    },
    [activeProject?._id],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = () => load(query);

  const selectContact = (id: string) => {
    if (selected[0] === id) {
      setSelected([null, selected[1]]);
      return;
    }
    if (selected[1] === id) {
      setSelected([selected[0], null]);
      return;
    }
    if (!selected[0]) setSelected([id, selected[1]]);
    else if (!selected[1]) setSelected([selected[0], id]);
    else setSelected([id, null]);
  };

  const contactA = contacts.find((c) => c._id === selected[0]);
  const contactB = contacts.find((c) => c._id === selected[1]);

  const handleMerge = async () => {
    if (!contactA || !contactB) return;
    setMerging(true);
    const combinedTags = [...new Set([...(contactA.tagIds || []), ...(contactB.tagIds || [])])];
    const res = await updateContactTags(contactA._id, combinedTags);
    if (res.success) {
      toast({
        title: 'Merged',
        description: `Tags from "${contactB.name || contactB.waId}" merged into "${contactA.name || contactA.waId}".`,
      });
      setSelected([null, null]);
      load(query);
    } else {
      toast({ title: 'Error', description: res.error || 'Merge failed.', variant: 'destructive' });
    }
    setMerging(false);
  };

  const renderContactCard = (c: any, label: string, tone: 'primary' | 'secondary') => (
    <Section
      title={
        <span className="inline-flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: tone === 'primary' ? 'var(--mt-accent)' : '#a1a1aa' }}
          />
          {label}
        </span>
      }
      className="flex-1"
    >
      <dl className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-zinc-100 text-[12px] font-semibold text-zinc-700">
            {(c.name || '?').slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <dt className="sr-only">Name</dt>
            <dd className="truncate text-[14px] font-semibold text-zinc-950">{c.name || 'Unknown'}</dd>
            <dd className="truncate font-mono text-[12px] tabular-nums text-zinc-500">{c.waId || '-'}</dd>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-zinc-100 pt-3 text-[12.5px]">
          <dt className="text-zinc-500">Tags</dt>
          <dd className="font-mono tabular-nums text-zinc-900">{c.tagIds?.length || 0}</dd>
        </div>
      </dl>
    </Section>
  );

  const isLoadingInitial = isPending && contacts.length === 0;
  const stagger = reduceMotion ? 0 : 0.025;

  return (
    <WaPage>
      <PageHeader
        title="Merge contacts"
        description="Find and merge duplicate contacts to keep your list clean."
        kicker="Wachat · contacts"
        backHref="/wachat/contacts"
      />

      {/* Search */}
      <Section padded={false} className="mb-6">
        <div className="flex items-center gap-3 p-4">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 focus-within:border-zinc-400">
            <Search className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search contacts by name or phone..."
              className="h-7 border-0 bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-0"
            />
          </div>
          <WaButton onClick={handleSearch} disabled={isPending}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
          </WaButton>
        </div>
      </Section>

      {/* Compare & merge surface */}
      {contactA && contactB && (
        <m.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
          className="mb-6"
        >
          <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-stretch">
            {renderContactCard(contactA, 'Primary (keep)', 'primary')}
            <div className="grid place-items-center lg:px-2">
              <span
                aria-hidden
                className="grid h-12 w-12 place-items-center rounded-full text-white shadow-[0_12px_28px_-12px_var(--mt-accent-glow)]"
                style={{ backgroundImage: 'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 60%, white))' }}
              >
                <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
              </span>
            </div>
            {renderContactCard(contactB, 'Secondary (merge into primary)', 'secondary')}
          </div>
          <div className="mt-4 flex justify-end">
            <ZoruAlertDialog>
              <ZoruAlertDialogTrigger asChild>
                <WaButton disabled={merging} leftIcon={merging ? Loader2 : GitMerge}>
                  {merging ? 'Merging...' : 'Merge contacts'}
                </WaButton>
              </ZoruAlertDialogTrigger>
              <ZoruAlertDialogContent>
                <ZoruAlertDialogHeader>
                  <ZoruAlertDialogTitle>Merge contacts?</ZoruAlertDialogTitle>
                  <ZoruAlertDialogDescription>
                    Tags from &ldquo;{contactB.name || contactB.waId}&rdquo; will be combined into &ldquo;{contactA.name || contactA.waId}&rdquo;. This cannot be undone.
                  </ZoruAlertDialogDescription>
                </ZoruAlertDialogHeader>
                <ZoruAlertDialogFooter>
                  <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                  <ZoruAlertDialogAction onClick={handleMerge}>Merge</ZoruAlertDialogAction>
                </ZoruAlertDialogFooter>
              </ZoruAlertDialogContent>
            </ZoruAlertDialog>
          </div>
        </m.div>
      )}

      {/* Candidate list */}
      <Section
        title="Candidate contacts"
        description="Pick two contacts to compare and merge."
        padded={false}
      >
        {isLoadingInitial ? (
          <div className="divide-y divide-zinc-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="h-5 w-5 animate-pulse rounded-md bg-zinc-100" />
                <div className="h-3 w-32 animate-pulse rounded-full bg-zinc-100" />
              </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="px-5 py-12">
            <EmptyState
              icon={Users}
              title="No contacts found"
              description={isPending ? 'Loading...' : 'Try a different search to surface duplicates.'}
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            <AnimatePresence initial={false}>
              {contacts.map((c: any, i) => {
                const isSelected = selected.includes(c._id);
                return (
                  <m.li
                    key={c._id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, delay: i * stagger, ease: EASE_OUT }}
                  >
                    <button
                      type="button"
                      onClick={() => selectContact(c._id)}
                      className={cn(
                        'flex w-full items-center gap-3 px-5 py-3 text-left transition-colors duration-150',
                        isSelected ? 'bg-emerald-50/50' : 'hover:bg-zinc-50',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
                          isSelected ? 'border-transparent text-white' : 'border-zinc-300',
                        )}
                        style={isSelected ? { background: 'var(--mt-accent)' } : undefined}
                      >
                        {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-700">
                        {(c.name || '?').slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-zinc-900">{c.name || 'Unknown'}</p>
                        <p className="truncate font-mono text-[11.5px] tabular-nums text-zinc-500">{c.waId || '-'}</p>
                      </div>
                      <StatusPill tone="draft">{c.tagIds?.length || 0} tags</StatusPill>
                    </button>
                  </m.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </Section>
    </WaPage>
  );
}

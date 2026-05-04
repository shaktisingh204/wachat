'use client';

/**
 * Wachat Contact Merge — rebuilt on ZoruUI primitives (phase 2).
 *
 * Same data, same handlers. Visual primitives swapped to ZoruUI.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import {
  Search,
  GitMerge,
  Check,
  Loader2,
  Users,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import {
  getContactsPageData,
  updateContactTags,
} from '@/app/actions/contact.actions';

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
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruEmptyState,
  ZoruInput,
  ZoruSkeleton,
  cn,
} from '@/components/zoruui';

export default function ContactMergePage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<[string | null, string | null]>([
    null,
    null,
  ]);
  const [merging, setMerging] = useState(false);

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
    const combinedTags = [
      ...new Set([...(contactA.tagIds || []), ...(contactB.tagIds || [])]),
    ];
    const res = await updateContactTags(contactA._id, combinedTags);
    if (res.success) {
      toast({
        title: 'Merged',
        description: `Tags from "${contactB.name || contactB.waId}" merged into "${contactA.name || contactA.waId}".`,
      });
      setSelected([null, null]);
      load(query);
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Merge failed.',
        variant: 'destructive',
      });
    }
    setMerging(false);
  };

  const renderContact = (c: any, label: string) => (
    <div className="min-w-[200px] flex-1">
      <p className="mb-2 text-[11px] uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </p>
      <div className="space-y-2 text-[13px]">
        <p>
          <span className="text-zoru-ink-muted">Name: </span>
          <span className="text-zoru-ink">{c.name || 'Unknown'}</span>
        </p>
        <p>
          <span className="text-zoru-ink-muted">Phone: </span>
          <span className="font-mono text-zoru-ink">{c.waId || '—'}</span>
        </p>
        <p>
          <span className="text-zoru-ink-muted">Tags: </span>
          <span className="text-zoru-ink">{c.tagIds?.length || 0}</span>
        </p>
      </div>
    </div>
  );

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
            <ZoruBreadcrumbPage>Merge</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div>
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Contact Merge
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          Find and merge duplicate contacts to keep your list clean.
        </p>
      </div>

      <ZoruCard className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <ZoruInput
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search contacts by name or phone…"
              leadingSlot={<Search />}
            />
          </div>
          <ZoruButton size="sm" onClick={handleSearch} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : 'Search'}
          </ZoruButton>
        </div>
      </ZoruCard>

      {isLoadingInitial ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <ZoruEmptyState
          icon={<Users />}
          title="No contacts found"
          description={
            isPending
              ? 'Loading…'
              : 'Try a different search to surface duplicates.'
          }
        />
      ) : (
        <ZoruCard className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zoru-line text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                <th className="w-8 px-5 py-3" />
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zoru-line">
              {contacts.map((c: any) => {
                const isSelected = selected.includes(c._id);
                return (
                  <tr
                    key={c._id}
                    onClick={() => selectContact(c._id)}
                    className={cn(
                      'cursor-pointer transition-colors',
                      isSelected
                        ? 'bg-zoru-surface-2'
                        : 'hover:bg-zoru-surface',
                    )}
                  >
                    <td className="px-5 py-3">
                      <div
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-[4px] border-2 transition-colors',
                          isSelected
                            ? 'border-zoru-ink bg-zoru-ink text-zoru-on-primary'
                            : 'border-zoru-line',
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[13px] text-zoru-ink">
                      {c.name || 'Unknown'}
                    </td>
                    <td className="px-5 py-3 font-mono text-[13px] text-zoru-ink-muted">
                      {c.waId || '—'}
                    </td>
                    <td className="px-5 py-3">
                      <ZoruBadge variant="secondary">
                        {c.tagIds?.length || 0} tags
                      </ZoruBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ZoruCard>
      )}

      {contactA && contactB && (
        <ZoruCard className="p-5">
          <h2 className="mb-4 text-[15px] text-zoru-ink">Compare & merge</h2>
          <div className="flex flex-wrap gap-6">
            {renderContact(contactA, 'Primary (keep)')}
            <div className="hidden items-center sm:flex">
              <GitMerge className="h-6 w-6 text-zoru-ink-muted" />
            </div>
            {renderContact(
              contactB,
              'Secondary (merge tags into primary)',
            )}
          </div>
          <div className="mt-4">
            <ZoruAlertDialog>
              <ZoruAlertDialogTrigger asChild>
                <ZoruButton disabled={merging}>
                  {merging ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <GitMerge />
                  )}
                  {merging ? 'Merging…' : 'Merge contacts'}
                </ZoruButton>
              </ZoruAlertDialogTrigger>
              <ZoruAlertDialogContent>
                <ZoruAlertDialogHeader>
                  <ZoruAlertDialogTitle>Merge contacts?</ZoruAlertDialogTitle>
                  <ZoruAlertDialogDescription>
                    Tags from "{contactB.name || contactB.waId}" will be
                    combined into "{contactA.name || contactA.waId}". This
                    cannot be undone.
                  </ZoruAlertDialogDescription>
                </ZoruAlertDialogHeader>
                <ZoruAlertDialogFooter>
                  <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                  <ZoruAlertDialogAction onClick={handleMerge}>
                    Merge
                  </ZoruAlertDialogAction>
                </ZoruAlertDialogFooter>
              </ZoruAlertDialogContent>
            </ZoruAlertDialog>
          </div>
        </ZoruCard>
      )}
      <div className="h-6" />
    </div>
  );
}

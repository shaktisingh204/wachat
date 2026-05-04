'use client';

/**
 * Wachat Contact Merge — find and merge duplicate contacts using real data.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuChartBar, LuCircleCheck, LuCircleX, LuTriangleAlert, LuSearch, LuMerge, LuCheck, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';
import { getContactsPageData } from '@/app/actions/contact.actions';
import { updateContactTags } from '@/app/actions/contact.actions';

export default function ContactMergePage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<[string | null, string | null]>([null, null]);
  const [merging, setMerging] = useState(false);

  const load = useCallback((search = '') => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getContactsPageData(String(activeProject._id), undefined, 1, search);
      setContacts(res.contacts ?? []);
    });
  }, [activeProject?._id]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = () => load(query);

  const selectContact = (id: string) => {
    if (selected[0] === id) { setSelected([null, selected[1]]); return; }
    if (selected[1] === id) { setSelected([selected[0], null]); return; }
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
      toast({ title: 'Merged', description: `Tags from "${contactB.name || contactB.waId}" merged into "${contactA.name || contactA.waId}".` });
      setSelected([null, null]);
      load(query);
    } else {
      toast({ title: 'Error', description: res.error || 'Merge failed.', variant: 'destructive' });
    }
    setMerging(false);
  };

  const renderContact = (c: any, label: string) => (
    <div className="flex-1 min-w-[200px]">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-2">{label}</p>
      <div className="space-y-2 text-[13px]">
        <p><span className="text-muted-foreground">Name:</span> <span className="text-foreground font-medium">{c.name || 'Unknown'}</span></p>
        <p><span className="text-muted-foreground">Phone:</span> <span className="text-foreground font-mono">{c.waId || '--'}</span></p>
        <p><span className="text-muted-foreground">Tags:</span> <span className="text-foreground">{c.tagIds?.length || 0}</span></p>
      </div>
    </div>
  );

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Contact Merge' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">Contact Merge</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Find and merge duplicate contacts to keep your list clean.</p>
      </div>

      <ClayCard padded={false} className="p-5">
        <div className="flex gap-3 items-center">
          <LuSearch className="h-4 w-4 text-muted-foreground shrink-0" />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search contacts by name or phone..."
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none" />
          <ClayButton size="sm" variant="pill" onClick={handleSearch} disabled={isPending}>
            {isPending ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
          </ClayButton>
        </div>
      </ClayCard>

      <ClayCard padded={false} className="overflow-x-auto">
        {contacts.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-muted-foreground">
            {isPending ? 'Loading...' : 'No contacts found. Try a different search.'}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 w-8" />
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Tags</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c: any) => {
                const isSelected = selected.includes(c._id);
                return (
                  <tr key={c._id} onClick={() => selectContact(c._id)}
                    className={`border-b border-border last:border-0 cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted'}`}>
                    <td className="px-5 py-3">
                      <div className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary' : 'border-border'}`}>
                        {isSelected && <LuCheck className="h-3 w-3 text-white" />}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[13px] font-medium text-foreground">{c.name || 'Unknown'}</td>
                    <td className="px-5 py-3 text-[13px] font-mono text-muted-foreground">{c.waId || '--'}</td>
                    <td className="px-5 py-3"><ClayBadge tone="neutral">{c.tagIds?.length || 0} tags</ClayBadge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </ClayCard>

      {contactA && contactB && (
        <ClayCard padded={false} className="p-5">
          <h2 className="text-[15px] font-semibold text-foreground mb-4">Compare & Merge</h2>
          <div className="flex gap-6 flex-wrap">
            {renderContact(contactA, 'Primary (keep)')}
            <div className="hidden sm:flex items-center"><LuMerge className="h-6 w-6 text-muted-foreground" /></div>
            {renderContact(contactB, 'Secondary (merge tags into primary)')}
          </div>
          <div className="mt-4">
            <ClayButton variant="obsidian" onClick={handleMerge} disabled={merging} leading={merging ? <LuLoader className="h-4 w-4 animate-spin" /> : <LuMerge className="h-4 w-4" />}>
              {merging ? 'Merging...' : 'Merge Contacts'}
            </ClayButton>
          </div>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}

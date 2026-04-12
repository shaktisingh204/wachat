'use client';

/**
 * Wachat Contact Merge — find and merge duplicate contacts.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuUsers, LuSearch, LuMerge, LuCheck } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';

interface Contact {
  id: string;
  name: string;
  phone: string;
  tags: string[];
  messages: number;
  createdAt: string;
}

const MOCK_CONTACTS: Contact[] = [
  { id: '1', name: 'John Doe', phone: '+1234567890', tags: ['vip', 'active'], messages: 142, createdAt: '2025-08-12' },
  { id: '2', name: 'John D.', phone: '+1234567890', tags: ['new'], messages: 8, createdAt: '2026-01-05' },
  { id: '3', name: 'Jane Smith', phone: '+9876543210', tags: ['support'], messages: 56, createdAt: '2025-11-20' },
  { id: '4', name: 'J. Smith', phone: '+9876543210', tags: ['vip'], messages: 3, createdAt: '2026-03-01' },
  { id: '5', name: 'Alex Kumar', phone: '+5551234567', tags: ['active'], messages: 200, createdAt: '2025-06-15' },
];

export default function ContactMergePage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>(MOCK_CONTACTS);
  const [selected, setSelected] = useState<[string | null, string | null]>([null, null]);
  const [merged, setMerged] = useState(false);

  const filtered = query
    ? contacts.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query))
    : contacts;

  const selectContact = (id: string) => {
    if (selected[0] === id) { setSelected([null, selected[1]]); return; }
    if (selected[1] === id) { setSelected([selected[0], null]); return; }
    if (!selected[0]) setSelected([id, selected[1]]);
    else if (!selected[1]) setSelected([selected[0], id]);
    else setSelected([id, null]);
    setMerged(false);
  };

  const contactA = contacts.find((c) => c.id === selected[0]);
  const contactB = contacts.find((c) => c.id === selected[1]);

  const handleMerge = () => {
    if (!contactA || !contactB) return;
    const mergedContact: Contact = {
      id: contactA.id,
      name: contactA.name,
      phone: contactA.phone,
      tags: [...new Set([...contactA.tags, ...contactB.tags])],
      messages: contactA.messages + contactB.messages,
      createdAt: contactA.createdAt < contactB.createdAt ? contactA.createdAt : contactB.createdAt,
    };
    setContacts((prev) => prev.filter((c) => c.id !== contactB.id).map((c) => (c.id === contactA.id ? mergedContact : c)));
    setSelected([null, null]);
    setMerged(true);
    toast({ title: 'Merged', description: `Contacts merged into "${mergedContact.name}".` });
  };

  const renderContact = (c: Contact, label: string) => (
    <div className="flex-1 min-w-[200px]">
      <p className="text-[11px] font-semibold text-clay-ink-muted uppercase mb-2">{label}</p>
      <div className="space-y-2 text-[13px]">
        <p><span className="text-clay-ink-muted">Name:</span> <span className="text-clay-ink font-medium">{c.name}</span></p>
        <p><span className="text-clay-ink-muted">Phone:</span> <span className="text-clay-ink font-mono">{c.phone}</span></p>
        <p><span className="text-clay-ink-muted">Messages:</span> <span className="text-clay-ink">{c.messages}</span></p>
        <p><span className="text-clay-ink-muted">Created:</span> <span className="text-clay-ink">{c.createdAt}</span></p>
        <div className="flex gap-1 flex-wrap">
          {c.tags.map((t) => <ClayBadge key={t} tone="blue">{t}</ClayBadge>)}
        </div>
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
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Contact Merge</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Find and merge duplicate contacts to keep your list clean.</p>
      </div>

      {/* Search */}
      <ClayCard padded={false} className="p-5">
        <div className="flex gap-3 items-center">
          <LuSearch className="h-4 w-4 text-clay-ink-muted shrink-0" />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts by name or phone..."
            className="flex-1 rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none" />
        </div>
      </ClayCard>

      {/* Contact list */}
      <ClayCard padded={false} className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
              <th className="px-5 py-3 w-8" />
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Messages</th>
              <th className="px-5 py-3">Tags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const isSelected = selected.includes(c.id);
              return (
                <tr key={c.id} onClick={() => selectContact(c.id)}
                  className={`border-b border-clay-border last:border-0 cursor-pointer transition-colors ${isSelected ? 'bg-clay-rose/5' : 'hover:bg-clay-bg-2'}`}>
                  <td className="px-5 py-3">
                    <div className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-clay-rose bg-clay-rose' : 'border-clay-border'}`}>
                      {isSelected && <LuCheck className="h-3 w-3 text-white" />}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[13px] font-medium text-clay-ink">{c.name}</td>
                  <td className="px-5 py-3 text-[13px] font-mono text-clay-ink-muted">{c.phone}</td>
                  <td className="px-5 py-3 text-[13px] text-clay-ink">{c.messages}</td>
                  <td className="px-5 py-3"><div className="flex gap-1">{c.tags.map((t) => <ClayBadge key={t} tone="neutral">{t}</ClayBadge>)}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ClayCard>

      {/* Side-by-side comparison */}
      {contactA && contactB && (
        <ClayCard padded={false} className="p-5">
          <h2 className="text-[15px] font-semibold text-clay-ink mb-4">Compare & Merge</h2>
          <div className="flex gap-6 flex-wrap">
            {renderContact(contactA, 'Primary (keep)')}
            <div className="hidden sm:flex items-center"><LuMerge className="h-6 w-6 text-clay-ink-muted" /></div>
            {renderContact(contactB, 'Secondary (merge into primary)')}
          </div>
          <div className="mt-4">
            <ClayButton variant="obsidian" onClick={handleMerge} leading={<LuMerge className="h-4 w-4" />}>
              Merge Contacts
            </ClayButton>
          </div>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}

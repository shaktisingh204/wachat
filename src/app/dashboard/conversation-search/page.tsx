'use client';

/**
 * Wachat Conversation Search — full-text search across conversations.
 */

import * as React from 'react';
import { useState, useMemo } from 'react';
import { LuSearch, LuMessageCircle } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayCard } from '@/components/clay';

const MOCK_MESSAGES = [
  { id: '1', contact: 'Rahul Sharma', phone: '+91 98765 43210', message: 'I need help with my order #1234, it has not been delivered yet.', timestamp: '2026-04-12T10:30:00Z' },
  { id: '2', contact: 'Priya Patel', phone: '+91 87654 32109', message: 'Can you send me the invoice for last month payment?', timestamp: '2026-04-11T14:15:00Z' },
  { id: '3', contact: 'Amit Singh', phone: '+91 76543 21098', message: 'What are your business hours on weekends?', timestamp: '2026-04-11T09:45:00Z' },
  { id: '4', contact: 'Sneha Gupta', phone: '+91 65432 10987', message: 'I want to schedule an appointment for next Tuesday.', timestamp: '2026-04-10T16:20:00Z' },
  { id: '5', contact: 'Vikram Joshi', phone: '+91 54321 09876', message: 'The payment link is not working. Can you resend it?', timestamp: '2026-04-10T11:00:00Z' },
  { id: '6', contact: 'Ananya Das', phone: '+91 43210 98765', message: 'Thank you for the quick delivery! Very happy with the service.', timestamp: '2026-04-09T08:30:00Z' },
  { id: '7', contact: 'Rohan Mehta', phone: '+91 32109 87654', message: 'Is there a discount code available for new customers?', timestamp: '2026-04-09T13:10:00Z' },
  { id: '8', contact: 'Kavita Nair', phone: '+91 21098 76543', message: 'My order was delivered but the product is damaged. Need a replacement.', timestamp: '2026-04-08T15:45:00Z' },
];

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i} className="bg-amber-200/60 rounded px-0.5">{part}</mark> : part
  );
}

export default function ConversationSearchPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return MOCK_MESSAGES.filter(
      (m) => m.message.toLowerCase().includes(q) || m.contact.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Conversation Search' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Conversation Search</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Search across all conversations by contact name or message content.</p>
      </div>

      <div className="relative max-w-xl">
        <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-clay-ink-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages or contacts..."
          className="w-full rounded-lg border border-clay-border bg-clay-bg pl-10 pr-4 py-2.5 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none"
        />
      </div>

      {query.trim() && (
        <p className="text-[12.5px] text-clay-ink-muted">{results.length} result{results.length !== 1 ? 's' : ''} found</p>
      )}

      {results.length > 0 ? (
        <div className="flex flex-col gap-3">
          {results.map((r) => (
            <ClayCard key={r.id} padded={false} className="p-4">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-clay-surface-2 text-[12px] font-semibold text-clay-ink">
                    {r.contact.split(' ').map((w) => w[0]).join('')}
                  </span>
                  <div>
                    <span className="text-[14px] font-semibold text-clay-ink">{highlightMatch(r.contact, query)}</span>
                    <span className="ml-2 text-[11px] text-clay-ink-muted">{r.phone}</span>
                  </div>
                </div>
                <span className="text-[11px] text-clay-ink-muted whitespace-nowrap">
                  {new Date(r.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-[13px] text-clay-ink leading-relaxed pl-10">{highlightMatch(r.message, query)}</p>
            </ClayCard>
          ))}
        </div>
      ) : query.trim() ? (
        <ClayCard className="p-12 text-center">
          <LuMessageCircle className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">No conversations match your search.</p>
        </ClayCard>
      ) : null}
      <div className="h-6" />
    </div>
  );
}

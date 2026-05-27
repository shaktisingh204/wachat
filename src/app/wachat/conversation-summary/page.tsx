'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { CircleX, Search, Loader2, MessageSquare, Inbox, Send, StickyNote } from 'lucide-react';
import { m } from 'motion/react';

import { useZoruToast } from '@/components/zoruui';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  MetricTile,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import { fmtDate } from '@/lib/utils';
import { useProject } from '@/context/project-context';
import { getContactTimeline } from '@/app/actions/wachat-features.actions';
import { getContactsPageData } from '@/app/actions/contact.actions';

/**
 * /wachat/conversation-summary — AI-aggregated timeline summary,
 * rebuilt on wachat-ui primitives.
 */

export default function ConversationSummaryPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<any[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [events, setEvents] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadContacts = useCallback(
    (q = '') => {
      if (!activeProject?._id) return;
      startTransition(async () => {
        const res = await getContactsPageData(
          String(activeProject._id),
          undefined,
          1,
          q,
        );
        setContacts(res.contacts ?? []);
      });
    },
    [activeProject?._id],
  );

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleSearch = () => loadContacts(searchQ);

  const loadTimeline = (contactId: string) => {
    if (!activeProject?._id) return;
    setSelectedId(contactId);
    startTransition(async () => {
      const res = await getContactTimeline(String(activeProject._id), contactId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setEvents(res.events ?? []);
      setLoaded(true);
    });
  };

  const selectedContact = contacts.find((c: any) => c._id === selectedId);
  const inbound = events.filter((e: any) => e.type === 'message' && e.direction === 'in');
  const outbound = events.filter((e: any) => e.type === 'message' && e.direction === 'out');
  const notes = events.filter((e: any) => e.type === 'note');

  return (
    <WaPage>
      <PageHeader
        title="Conversation summary"
        description="Pick a contact and get a single-screen overview of their entire conversation history."
        kicker="Wachat · summary"
        backHref="/wachat"
        eyebrowIcon={MessageSquare}
      />

      <Section title="Pick a contact" description="Search by name or phone, then click one to load their timeline." className="mb-6">
        <div className="mb-4 flex max-w-xl items-center gap-2 rounded-full border border-zinc-200 bg-white p-1.5">
          <span className="pl-3 text-zinc-400">
            <Search className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </span>
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Search by name or phone..."
            className="flex-1 bg-transparent text-[13.5px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            aria-label="Search contacts"
          />
          <WaButton size="sm" leftIcon={isPending ? Loader2 : Search} variant="outline" onClick={handleSearch} disabled={isPending}>
            Search
          </WaButton>
        </div>
        {contacts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {contacts.slice(0, 12).map((c: any, i) => {
              const isSelected = selectedId === c._id;
              return (
                <m.button
                  key={c._id}
                  type="button"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.02, ease: EASE_OUT }}
                  onClick={() => loadTimeline(c._id)}
                  className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150 active:scale-[0.97] ${
                    isSelected
                      ? 'border-transparent text-white'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-900'
                  }`}
                  style={isSelected ? { background: 'var(--mt-accent)' } : undefined}
                >
                  {c.name || c.waId || 'Unknown'}
                </m.button>
              );
            })}
          </div>
        )}
      </Section>

      {isPending && selectedId && !loaded && (
        <div className="flex h-32 items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          <p className="text-[13px] text-zinc-500">Loading timeline...</p>
        </div>
      )}

      {loaded && !isPending && (
        <div className="space-y-6">
          <Section
            title={selectedContact?.name || selectedContact?.waId || 'Contact'}
            description={selectedContact?.waId}
            action={
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-[11.5px] font-semibold text-zinc-700">
                <MessageSquare className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                {events.length.toLocaleString('en-IN')} events
              </span>
            }
          >
            {events.length === 0 ? (
              <p className="text-[13px] text-zinc-500">No messages found for this contact.</p>
            ) : (
              <p className="text-[13.5px] leading-relaxed text-zinc-700">
                This conversation has{' '}
                <span className="font-semibold text-zinc-950">{inbound.length}</span> inbound and{' '}
                <span className="font-semibold text-zinc-950">{outbound.length}</span> outbound messages
                {notes.length > 0 ? (
                  <>, plus <span className="font-semibold text-zinc-950">{notes.length}</span> internal note{notes.length === 1 ? '' : 's'}</>
                ) : null}
                .
                {events[0]?.timestamp && ` Most recent activity: ${fmtDate(events[0].timestamp)}.`}
                {events[events.length - 1]?.timestamp && ` First recorded activity: ${fmtDate(events[events.length - 1].timestamp)}.`}
              </p>
            )}
          </Section>

          <section aria-label="Message counts" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricTile label="Inbound" value={inbound.length} icon={Inbox} delay={0} />
            <MetricTile label="Outbound" value={outbound.length} icon={Send} delay={0.04} />
            <MetricTile label="Notes" value={notes.length} icon={StickyNote} delay={0.08} />
          </section>

          {events.length > 0 && (
            <Section title="Recent activity" description="The latest 15 events on this thread." padded={false}>
              <ul className="divide-y divide-zinc-100">
                {events.slice(0, 15).map((e: any, i: number) => {
                  const tone =
                    e.type === 'note'
                      ? { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Note' }
                      : e.direction === 'in'
                      ? { bg: 'bg-sky-50', text: 'text-sky-700', label: 'In' }
                      : { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Out' };
                  return (
                    <m.li
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.03, ease: EASE_OUT }}
                      className="flex items-start gap-3 px-5 py-3"
                    >
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em] ${tone.bg} ${tone.text}`}>
                        {tone.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] text-zinc-800">{e.content || '-'}</p>
                        <span className="text-[11px] text-zinc-400 tabular-nums">
                          {e.timestamp ? fmtDate(e.timestamp) : ''}
                        </span>
                      </div>
                    </m.li>
                  );
                })}
              </ul>
            </Section>
          )}
        </div>
      )}

      {!loaded && !isPending && (
        <EmptyState
          icon={CircleX}
          title="Select a contact"
          description="Choose a contact above to generate a conversation summary."
        />
      )}
    </WaPage>
  );
}

'use client';

import * as React from 'react';
import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import {
  CircleX,
  Search,
  Loader2,
  MessageSquare,
  Inbox,
  Send,
  StickyNote,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Tag,
} from 'lucide-react';
import { m, AnimatePresence } from 'motion/react';

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
 * /wachat/conversation-summary - AI-aggregated timeline summary. Adds
 * a per-contact metric strip (total messages, avg response time, last
 * topic, sentiment trend), and a motion-staggered activity feed.
 */

const POSITIVE = ['great', 'thanks', 'thank you', 'awesome', 'love', 'happy', 'good', 'helpful', 'resolved'];
const NEGATIVE = ['bad', 'angry', 'refund', 'broken', 'issue', 'problem', 'cancel', 'delay', 'waiting', 'frustrated'];

function fmtMinutes(min?: number | null) {
  if (min === null || min === undefined || !Number.isFinite(min)) return '--';
  if (min < 1) return '<1m';
  if (min < 60) return `${Math.round(min)}m`;
  if (min < 60 * 24) return `${(min / 60).toFixed(1)}h`;
  return `${Math.round(min / 60 / 24)}d`;
}

function sentimentOf(text: string): -1 | 0 | 1 {
  if (!text) return 0;
  const t = text.toLowerCase();
  let s = 0;
  for (const w of POSITIVE) if (t.includes(w)) s += 1;
  for (const w of NEGATIVE) if (t.includes(w)) s -= 1;
  return s > 0 ? 1 : s < 0 ? -1 : 0;
}

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
    setEvents([]);
    setLoaded(false);
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

  // Avg first response time: pair each inbound with the next outbound after it.
  const avgResponseMin = useMemo(() => {
    if (events.length === 0) return null;
    // events ordered most-recent-first; reverse to ascending
    const ordered = [...events]
      .filter((e: any) => e.type === 'message' && e.timestamp)
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const gaps: number[] = [];
    for (let i = 0; i < ordered.length - 1; i++) {
      const cur = ordered[i];
      const nxt = ordered[i + 1];
      if (cur.direction === 'in' && nxt.direction === 'out') {
        const dt = new Date(nxt.timestamp).getTime() - new Date(cur.timestamp).getTime();
        if (Number.isFinite(dt) && dt >= 0) gaps.push(dt / 60000);
      }
    }
    if (gaps.length === 0) return null;
    return gaps.reduce((a, b) => a + b, 0) / gaps.length;
  }, [events]);

  // Last topic - first content phrase of the most recent inbound message.
  const lastTopic = useMemo(() => {
    const recent = events.find((e: any) => e.type === 'message' && e.direction === 'in' && (e.content || e.messageText));
    if (!recent) return null;
    const txt = String(recent.content || recent.messageText || '').replace(/\s+/g, ' ').trim();
    if (!txt) return null;
    return txt.length > 40 ? `${txt.slice(0, 40)}...` : txt;
  }, [events]);

  // Sentiment trend - compare older half vs newer half of inbound messages.
  const sentimentTrend = useMemo(() => {
    const inboundOrdered = inbound
      .filter((e: any) => e.timestamp && (e.content || e.messageText))
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    if (inboundOrdered.length < 2) return null;
    const mid = Math.floor(inboundOrdered.length / 2);
    const older = inboundOrdered.slice(0, mid);
    const newer = inboundOrdered.slice(mid);
    const score = (arr: any[]) =>
      arr.reduce((s, m) => s + sentimentOf(String(m.content || m.messageText || '')), 0) / Math.max(arr.length, 1);
    const olderScore = score(older);
    const newerScore = score(newer);
    const delta = newerScore - olderScore;
    if (delta > 0.05) return { dir: 'up', delta };
    if (delta < -0.05) return { dir: 'down', delta };
    return { dir: 'flat', delta };
  }, [inbound]);

  const SentimentIcon = sentimentTrend?.dir === 'up'
    ? TrendingUp
    : sentimentTrend?.dir === 'down'
      ? TrendingDown
      : Minus;
  const sentimentValue = sentimentTrend
    ? sentimentTrend.dir === 'up'
      ? 'Improving'
      : sentimentTrend.dir === 'down'
        ? 'Declining'
        : 'Steady'
    : '--';

  // Tag chip pool from selected contact
  const contactTags: string[] = Array.isArray(selectedContact?.tagIds)
    ? selectedContact!.tagIds.map(String).slice(0, 6)
    : [];

  return (
    <WaPage>
      <PageHeader
        title="Conversation summary"
        description="Pick a contact and get a single-screen overview of their entire conversation history."
        kicker="Wachat · summary"
        backHref="/wachat"
        eyebrowIcon={MessageSquare}
      />

      <Section title="Pick a contact" description="Search by name or phone, then click one to load their timeline." className="mb-4">
        <div className="mb-3 flex max-w-xl items-center gap-2 rounded-full border border-zinc-200 bg-white p-1.5">
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
        <div className="space-y-4">
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
            {contactTags.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
                  <Tag className="h-3 w-3" strokeWidth={2.25} aria-hidden /> Tags
                </span>
                {contactTags.map((t) => (
                  <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-medium text-zinc-700">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {events.length === 0 ? (
              <p className="text-[13px] text-zinc-500">No messages found for this contact.</p>
            ) : (
              <p className="text-[13px] leading-relaxed text-zinc-700">
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

          <section aria-label="Per-contact metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <MetricTile label="Total events" value={events.length.toLocaleString('en-IN')} icon={MessageSquare} delay={0} />
            <MetricTile label="Inbound" value={inbound.length} icon={Inbox} delay={0.04} />
            <MetricTile label="Outbound" value={outbound.length} icon={Send} delay={0.08} />
            <MetricTile label="Notes" value={notes.length} icon={StickyNote} delay={0.12} />
            <MetricTile label="Avg response" value={fmtMinutes(avgResponseMin)} icon={Clock} delay={0.16} />
            <MetricTile label="Sentiment" value={sentimentValue} icon={SentimentIcon} delay={0.2} />
          </section>

          {lastTopic && (
            <m.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-zinc-500">Last topic</span>
                <span className="truncate text-[13px] text-zinc-800">{lastTopic}</span>
              </div>
            </m.div>
          )}

          {events.length > 0 && (
            <Section title="Recent activity" description="The latest 15 events on this thread." padded={false}>
              <ul className="divide-y divide-zinc-100">
                <AnimatePresence initial={false}>
                  {events.slice(0, 15).map((e: any, i: number) => {
                    const tone =
                      e.type === 'note'
                        ? { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Note' }
                        : e.direction === 'in'
                          ? { bg: 'bg-sky-50', text: 'text-sky-700', label: 'In' }
                          : { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Out' };
                    const sent = e.type === 'message' && e.direction === 'in'
                      ? sentimentOf(String(e.content || e.messageText || ''))
                      : 0;
                    return (
                      <m.li
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.28, delay: i * 0.035, ease: EASE_OUT }}
                        className="flex items-start gap-3 px-4 py-2.5"
                      >
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em] ${tone.bg} ${tone.text}`}>
                          {tone.label}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[12.5px] leading-snug text-zinc-800">{e.content || e.messageText || '-'}</p>
                          <span className="text-[11px] text-zinc-400 tabular-nums">
                            {e.timestamp ? fmtDate(e.timestamp) : ''}
                          </span>
                        </div>
                        {sent !== 0 && (
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                              sent > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}
                            aria-label={sent > 0 ? 'Positive signal' : 'Negative signal'}
                          >
                            {sent > 0 ? 'pos' : 'neg'}
                          </span>
                        )}
                      </m.li>
                    );
                  })}
                </AnimatePresence>
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

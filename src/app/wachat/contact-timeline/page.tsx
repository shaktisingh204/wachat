'use client';

import { fmtDate } from '@/lib/utils';

import {
  useZoruToast,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuRadioGroup,
  ZoruDropdownMenuRadioItem,
  ZoruDropdownMenuTrigger,
  Input,
  Label,
  cn,
} from '@/components/zoruui';
import {
  useState,
  useTransition,
  useCallback,
  useMemo,
} from 'react';
import {
  History,
  Search,
  MessageSquare,
  StickyNote,
  Loader2,
  Filter,
  ChevronDown,
  Phone,
  Tag as TagIcon,
  GitMerge,
  ShieldOff,
  Clock,
  Activity,
} from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import { getContactTimeline } from '@/app/actions/wachat-features.actions';

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

type FilterMode = 'all' | 'message' | 'note';

const FILTER_LABELS: Record<FilterMode, string> = {
  all: 'All events',
  message: 'Messages only',
  note: 'Notes only',
};

const WA_GREEN = '#25D366';

function monogram(name: string | undefined | null): string {
  const s = (name || '').trim();
  if (!s) return '??';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function eventIcon(type: string) {
  switch (type) {
    case 'note':
      return StickyNote;
    case 'call':
      return Phone;
    case 'tag-added':
    case 'tag':
      return TagIcon;
    case 'merge':
      return GitMerge;
    case 'opt-out':
      return ShieldOff;
    case 'message':
    default:
      return MessageSquare;
  }
}

export default function ContactTimelinePage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const reduceMotion = useReducedMotion();

  const [contactId, setContactId] = useState('');
  const [events, setEvents] = useState<any[] | null>(null);
  const [contactMeta, setContactMeta] = useState<any | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleSearch = useCallback(() => {
    if (!contactId.trim() || !projectId) {
      toast({ title: 'Required', description: 'Enter a contact ID or phone.', variant: 'destructive' });
      return;
    }
    startLoading(async () => {
      const res = await getContactTimeline(projectId, contactId.trim());
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        setEvents([]);
        setContactMeta(null);
      } else {
        setEvents(res.events || []);
        setContactMeta((res as any).contact || null);
      }
    });
  }, [contactId, projectId, toast]);

  const filteredEvents = useMemo(() => {
    if (!events) return null;
    if (filter === 'all') return events;
    return events.filter((e) =>
      filter === 'note' ? e.type === 'note' : e.type !== 'note',
    );
  }, [events, filter]);

  const lifetimeStats = useMemo(() => {
    if (!events) return null;
    const messages = events.filter((e) => e.type !== 'note');
    const sent = messages.filter((e) => e.direction === 'out').length;
    const received = messages.filter((e) => e.direction === 'in').length;
    const notes = events.filter((e) => e.type === 'note').length;

    // Average response time: time between consecutive in -> out pairs
    const sortedAsc = messages
      .filter((m) => m.timestamp)
      .map((m) => ({ direction: m.direction, t: new Date(m.timestamp).getTime() }))
      .sort((a, b) => a.t - b.t);
    let totalResp = 0;
    let respCount = 0;
    for (let i = 1; i < sortedAsc.length; i++) {
      if (sortedAsc[i].direction === 'out' && sortedAsc[i - 1].direction === 'in') {
        totalResp += sortedAsc[i].t - sortedAsc[i - 1].t;
        respCount++;
      }
    }
    const avgRespMs = respCount > 0 ? totalResp / respCount : 0;
    const avgRespLabel = avgRespMs >= 60_000
      ? `${Math.round(avgRespMs / 60_000)}m`
      : avgRespMs > 0
        ? `${Math.round(avgRespMs / 1000)}s`
        : '-';

    const timestamps = sortedAsc.map((m) => m.t);
    const firstContact = timestamps[0];
    const lastContact = timestamps[timestamps.length - 1];

    return {
      sent,
      received,
      notes,
      avgRespLabel,
      firstContact: firstContact ? new Date(firstContact) : null,
      lastContact: lastContact ? new Date(lastContact) : null,
    };
  }, [events]);

  const stagger = reduceMotion ? 0 : 0.025;
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <WaPage>
      <PageHeader
        title="Contact timeline"
        description="View the full interaction history of any contact."
        kicker="Wachat · contacts"
        backHref="/wachat/contacts"
      />

      {/* Search & filter */}
      <Section className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
            <Label htmlFor="ct-contact">Contact ID or phone number</Label>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 focus-within:border-zinc-400">
              <Search className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
              <Input
                id="ct-contact"
                type="text"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Contact ID or phone number..."
                className="h-7 border-0 bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <WaButton onClick={handleSearch} disabled={isLoading} leftIcon={isLoading ? Loader2 : Search}>
              Load timeline
            </WaButton>
            <DropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-[12px] font-semibold text-zinc-700 transition-colors hover:border-zinc-900 active:scale-[0.97]"
                >
                  <Filter className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  {FILTER_LABELS[filter]}
                  <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={2.25} aria-hidden />
                </button>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuLabel>Filter by type</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuRadioGroup
                  value={filter}
                  onValueChange={(v) => setFilter(v as FilterMode)}
                >
                  <ZoruDropdownMenuRadioItem value="all">All events</ZoruDropdownMenuRadioItem>
                  <ZoruDropdownMenuRadioItem value="message">Messages only</ZoruDropdownMenuRadioItem>
                  <ZoruDropdownMenuRadioItem value="note">Notes only</ZoruDropdownMenuRadioItem>
                </ZoruDropdownMenuRadioGroup>
              </ZoruDropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Section>

      {/* Contact header card + lifetime stats */}
      {events && events.length > 0 && lifetimeStats && (
        <Section className="mb-4">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex items-center gap-3">
              <span
                className="grid h-12 w-12 place-items-center rounded-full text-[14px] font-semibold text-white"
                style={{ backgroundColor: WA_GREEN }}
              >
                {monogram(contactMeta?.name || contactId)}
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-zinc-950">
                  {contactMeta?.name || contactId || 'Contact'}
                </p>
                <p className="font-mono text-[11.5px] tabular-nums text-zinc-500">
                  {contactMeta?.waId || contactMeta?.phone || contactId}
                </p>
              </div>
            </div>
            <dl className="ml-auto grid flex-1 grid-cols-3 gap-2 sm:grid-cols-6">
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                <dt className="text-[9.5px] font-semibold uppercase tracking-wider text-zinc-500">Sent</dt>
                <dd className="mt-0.5 text-[14px] font-semibold tabular-nums text-zinc-950">{lifetimeStats.sent.toLocaleString()}</dd>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                <dt className="text-[9.5px] font-semibold uppercase tracking-wider text-zinc-500">Received</dt>
                <dd className="mt-0.5 text-[14px] font-semibold tabular-nums text-zinc-950">{lifetimeStats.received.toLocaleString()}</dd>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                <dt className="text-[9.5px] font-semibold uppercase tracking-wider text-zinc-500">Notes</dt>
                <dd className="mt-0.5 text-[14px] font-semibold tabular-nums text-zinc-950">{lifetimeStats.notes.toLocaleString()}</dd>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                <dt className="text-[9.5px] font-semibold uppercase tracking-wider text-zinc-500">Avg resp</dt>
                <dd className="mt-0.5 text-[14px] font-semibold tabular-nums text-zinc-950">{lifetimeStats.avgRespLabel}</dd>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                <dt className="text-[9.5px] font-semibold uppercase tracking-wider text-zinc-500">First</dt>
                <dd className="mt-0.5 truncate text-[11px] tabular-nums text-zinc-700">
                  {lifetimeStats.firstContact ? fmtDate(lifetimeStats.firstContact) : '-'}
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                <dt className="text-[9.5px] font-semibold uppercase tracking-wider text-zinc-500">Last</dt>
                <dd className="mt-0.5 truncate text-[11px] tabular-nums text-zinc-700">
                  {lifetimeStats.lastContact ? fmtDate(lifetimeStats.lastContact) : '-'}
                </dd>
              </div>
            </dl>
          </div>
        </Section>
      )}

      {isLoading && (
        <Section padded={false}>
          <div className="divide-y divide-zinc-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3">
                <div className="h-5 w-5 animate-pulse rounded-full bg-zinc-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-2.5 w-48 animate-pulse rounded-full bg-zinc-100" />
                  <div className="h-2 w-64 animate-pulse rounded-full bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {filteredEvents && !isLoading && filteredEvents.length > 0 && (
        <Section title="Activity" padded={false} action={<StatusPill tone="draft">{filteredEvents.length} events</StatusPill>}>
          <div className="relative px-5 py-4">
            {/* Hairline left rail */}
            <span
              aria-hidden
              className="absolute bottom-2 left-[36px] top-2 w-px bg-zinc-200"
            />
            <ol className="space-y-0.5">
              {filteredEvents.map((ev, i) => {
                const isNote = ev.type === 'note';
                const isIn = ev.direction === 'in';
                const Icon = eventIcon(isNote ? 'note' : (ev.type || 'message'));
                const eventId = String(ev._id || ev.id || i);
                const isExpanded = expandedIds.has(eventId);
                const content = ev.content || ev.text || '-';
                const isLong = typeof content === 'string' && content.length > 140;
                const display = isLong && !isExpanded ? content.slice(0, 140) + '...' : content;

                const tone = isNote ? 'queued' : isIn ? 'sent' : 'sending';
                const eventLabel = isNote
                  ? 'Note'
                  : ev.type === 'call'
                    ? 'Call'
                    : ev.type === 'tag-added'
                      ? 'Tag added'
                      : ev.type === 'merge'
                        ? 'Merged'
                        : ev.type === 'opt-out'
                          ? 'Opted out'
                          : isIn
                            ? 'Received'
                            : 'Sent';

                return (
                  <m.li
                    key={eventId}
                    initial={{ opacity: 0, y: 4 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-5%' }}
                    transition={{ duration: 0.25, delay: i * stagger, ease: EASE_OUT }}
                    className="relative flex items-start gap-3 py-2 pl-0"
                  >
                    <span
                      className={cn(
                        'relative z-10 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full ring-4 ring-white',
                        isNote
                          ? 'bg-amber-100 text-amber-700'
                          : isIn
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-sky-100 text-sky-700',
                      )}
                      style={{ marginLeft: 28 }}
                    >
                      <Icon className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 pl-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <StatusPill tone={tone}>{eventLabel}</StatusPill>
                          {ev.agent && (
                            <span className="inline-flex items-center gap-1 text-[10.5px] text-zinc-500">
                              <span
                                className="grid h-3.5 w-3.5 place-items-center rounded-full text-[7px] font-bold text-white"
                                style={{ backgroundColor: WA_GREEN }}
                              >
                                {monogram(ev.agent)}
                              </span>
                              {ev.agent}
                            </span>
                          )}
                        </div>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[10.5px] tabular-nums text-zinc-500">
                          <Clock className="h-2.5 w-2.5 opacity-70" strokeWidth={2.5} />
                          {ev.timestamp ? fmtDate(ev.timestamp) : ''}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-700">
                        {display}
                      </p>
                      {isLong && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(eventId)}
                          className="mt-1 text-[10.5px] font-semibold uppercase tracking-wider"
                          style={{ color: WA_GREEN }}
                        >
                          {isExpanded ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  </m.li>
                );
              })}
            </ol>
          </div>
        </Section>
      )}

      {filteredEvents && !isLoading && filteredEvents.length === 0 && (
        <EmptyState
          icon={History}
          title="No events found"
          description={
            events && events.length > 0
              ? 'Try a different filter to surface events.'
              : 'No events found for this contact.'
          }
        />
      )}

      {!events && !isLoading && (
        <EmptyState
          icon={Activity}
          title="Enter a contact ID"
          description="Type a contact ID or phone number above to view their interaction timeline."
        />
      )}
    </WaPage>
  );
}

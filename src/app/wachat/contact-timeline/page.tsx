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
} from '@/components/zoruui';
import {
  useState,
  useTransition,
  useCallback,
} from 'react';
import {
  History,
  Search,
  MessageSquare,
  StickyNote,
  Loader2,
  Filter,
  ChevronDown,
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

export default function ContactTimelinePage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();
  const reduceMotion = useReducedMotion();

  const [contactId, setContactId] = useState('');
  const [events, setEvents] = useState<any[] | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [filter, setFilter] = useState<FilterMode>('all');

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
      } else {
        setEvents(res.events || []);
      }
    });
  }, [contactId, projectId, toast]);

  const filteredEvents = React.useMemo(() => {
    if (!events) return null;
    if (filter === 'all') return events;
    return events.filter((e) =>
      filter === 'note' ? e.type === 'note' : e.type !== 'note',
    );
  }, [events, filter]);

  const stagger = reduceMotion ? 0 : 0.05;

  return (
    <WaPage>
      <PageHeader
        title="Contact timeline"
        description="View the full interaction history of any contact."
        kicker="Wachat · contacts"
        backHref="/wachat/contacts"
      />

      {/* Search & filter */}
      <Section className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
            <Label htmlFor="ct-contact">Contact ID or phone number</Label>
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 focus-within:border-zinc-400">
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
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 text-[12px] font-semibold text-zinc-700 transition-colors hover:border-zinc-900 active:scale-[0.97]"
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

      {isLoading && (
        <Section padded={false}>
          <div className="divide-y divide-zinc-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3.5">
                <div className="h-7 w-7 animate-pulse rounded-full bg-zinc-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-48 animate-pulse rounded-full bg-zinc-100" />
                  <div className="h-2.5 w-64 animate-pulse rounded-full bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {filteredEvents && !isLoading && filteredEvents.length > 0 && (
        <Section title="Activity" padded={false}>
          <div className="relative px-5 py-5">
            {/* Hairline left rail */}
            <span
              aria-hidden
              className="absolute bottom-2 left-[36px] top-2 w-px bg-zinc-200"
            />
            <ol className="space-y-1">
              {filteredEvents.map((ev, i) => {
                const isNote = ev.type === 'note';
                const isIn = ev.direction === 'in';
                const Icon = isNote ? StickyNote : MessageSquare;
                return (
                  <m.li
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-5%' }}
                    transition={{ duration: 0.3, delay: i * stagger, ease: EASE_OUT }}
                    className="relative flex items-start gap-3 py-2.5 pl-0"
                  >
                    <span
                      className={`relative z-10 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full ring-4 ring-white ${
                        isNote
                          ? 'bg-amber-100 text-amber-700'
                          : isIn
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-sky-100 text-sky-700'
                      }`}
                      style={{ marginLeft: 28 }}
                    >
                      <Icon className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 pl-2">
                      <div className="flex items-center justify-between gap-2">
                        <StatusPill tone={isNote ? 'queued' : isIn ? 'sent' : 'sending'}>
                          {isNote ? 'Note' : isIn ? 'Received' : 'Sent'}
                        </StatusPill>
                        <span className="whitespace-nowrap text-[11px] tabular-nums text-zinc-500">
                          {ev.timestamp ? fmtDate(ev.timestamp) : ''}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-700">{ev.content || '-'}</p>
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
          icon={History}
          title="Enter a contact ID"
          description="Type a contact ID or phone number above to view their interaction timeline."
        />
      )}
    </WaPage>
  );
}

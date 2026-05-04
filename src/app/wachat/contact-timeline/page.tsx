'use client';

/**
 * Wachat Contact Timeline — rebuilt on ZoruUI primitives (phase 2).
 *
 * Same data, same handlers. Visual primitives swapped to ZoruUI.
 */

import * as React from 'react';
import { useState, useTransition, useCallback } from 'react';
import {
  History,
  Search,
  MessageSquare,
  StickyNote,
  Loader2,
  Filter,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useZoruToast } from '@/components/zoruui';
import { getContactTimeline } from '@/app/actions/wachat-features.actions';

import {
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuRadioGroup,
  ZoruDropdownMenuRadioItem,
  ZoruDropdownMenuTrigger,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruScrollArea,
  ZoruSkeleton,
  cn,
} from '@/components/zoruui';

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

  const [contactId, setContactId] = useState('');
  const [events, setEvents] = useState<any[] | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [filter, setFilter] = useState<FilterMode>('all');

  const handleSearch = useCallback(() => {
    if (!contactId.trim() || !projectId) {
      toast({
        title: 'Required',
        description: 'Enter a contact ID or phone.',
        variant: 'destructive',
      });
      return;
    }
    startLoading(async () => {
      const res = await getContactTimeline(projectId, contactId.trim());
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
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
            <ZoruBreadcrumbPage>Timeline</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div>
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Contact Timeline
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          View the full interaction history of any contact.
        </p>
      </div>

      <ZoruCard className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
            <ZoruLabel htmlFor="ct-contact">
              Contact ID or phone number
            </ZoruLabel>
            <ZoruInput
              id="ct-contact"
              type="text"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Contact ID or phone number…"
              leadingSlot={<Search />}
            />
          </div>
          <div className="flex items-center gap-2">
            <ZoruButton onClick={handleSearch} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Search />
              )}
              Load timeline
            </ZoruButton>
            <ZoruDropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <ZoruButton variant="outline" size="sm">
                  <Filter /> {FILTER_LABELS[filter]}
                </ZoruButton>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuLabel>Filter by type</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuRadioGroup
                  value={filter}
                  onValueChange={(v) => setFilter(v as FilterMode)}
                >
                  <ZoruDropdownMenuRadioItem value="all">
                    All events
                  </ZoruDropdownMenuRadioItem>
                  <ZoruDropdownMenuRadioItem value="message">
                    Messages only
                  </ZoruDropdownMenuRadioItem>
                  <ZoruDropdownMenuRadioItem value="note">
                    Notes only
                  </ZoruDropdownMenuRadioItem>
                </ZoruDropdownMenuRadioGroup>
              </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>
          </div>
        </div>
      </ZoruCard>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {filteredEvents && !isLoading && filteredEvents.length > 0 && (
        <ZoruScrollArea className="max-h-[640px]">
          <div className="relative pl-8">
            <div className="absolute left-3.5 bottom-0 top-0 w-px bg-zoru-line" />
            <div className="space-y-4">
              {filteredEvents.map((ev, i) => {
                const isNote = ev.type === 'note';
                const isIn = ev.direction === 'in';
                const Icon = isNote ? StickyNote : MessageSquare;
                return (
                  <div key={i} className="relative flex gap-4">
                    <div
                      className={cn(
                        'absolute -left-4.5 z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                        'bg-zoru-surface-2 text-zoru-ink',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <ZoruCard className="ml-4 flex-1 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <ZoruBadge
                          variant={
                            isNote ? 'warning' : isIn ? 'success' : 'info'
                          }
                        >
                          {isNote ? 'Note' : isIn ? 'Received' : 'Sent'}
                        </ZoruBadge>
                        <span className="whitespace-nowrap text-[11px] text-zoru-ink-muted">
                          {ev.timestamp
                            ? new Date(ev.timestamp).toLocaleString()
                            : ''}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-zoru-ink-muted">
                        {ev.content || '—'}
                      </p>
                    </ZoruCard>
                  </div>
                );
              })}
            </div>
          </div>
        </ZoruScrollArea>
      )}

      {filteredEvents && !isLoading && filteredEvents.length === 0 && (
        <ZoruEmptyState
          icon={<History />}
          title="No events found"
          description={
            events && events.length > 0
              ? 'Try a different filter to surface events.'
              : 'No events found for this contact.'
          }
        />
      )}

      {!events && !isLoading && (
        <ZoruEmptyState
          icon={<History />}
          title="Enter a contact ID"
          description="Type a contact ID or phone number above to view their interaction timeline."
        />
      )}
      <div className="h-6" />
    </div>
  );
}

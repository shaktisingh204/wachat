'use client';

/**
 * Wachat Contact Timeline -- chronological interaction history for a contact.
 */

import * as React from 'react';
import { useState, useTransition, useCallback } from 'react';
import { LuHistory, LuSearch, LuMessageSquare, LuStickyNote, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';
import { getContactTimeline } from '@/app/actions/wachat-features.actions';

export default function ContactTimelinePage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [contactId, setContactId] = useState('');
  const [events, setEvents] = useState<any[] | null>(null);
  const [isLoading, startLoading] = useTransition();

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

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Contact Timeline' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Contact Timeline</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">View the full interaction history of any contact.</p>
      </div>

      <ClayCard padded={false} className="p-5">
        <div className="flex gap-3">
          <input type="text" value={contactId} onChange={(e) => setContactId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Contact ID or phone number..."
            className="flex-1 rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none" />
          <ClayButton size="sm" variant="obsidian" onClick={handleSearch} disabled={isLoading}>
            {isLoading ? <LuLoader className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <LuSearch className="mr-1.5 h-3.5 w-3.5" />}
            Load Timeline
          </ClayButton>
        </div>
      </ClayCard>

      {isLoading && (
        <div className="flex h-32 items-center justify-center gap-3">
          <LuLoader className="h-5 w-5 animate-spin text-clay-ink-muted" />
          <p className="text-[13px] text-clay-ink-muted">Loading timeline...</p>
        </div>
      )}

      {events && !isLoading && events.length > 0 && (
        <div className="relative pl-8">
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-clay-border" />
          <div className="space-y-4">
            {events.map((ev, i) => {
              const isNote = ev.type === 'note';
              const isIn = ev.direction === 'in';
              const Icon = isNote ? LuStickyNote : LuMessageSquare;
              const color = isNote ? 'text-pink-600 bg-pink-100' : isIn ? 'text-green-600 bg-green-100' : 'text-blue-600 bg-blue-100';
              return (
                <div key={i} className="relative flex gap-4">
                  <div className={`absolute -left-4.5 flex h-7 w-7 items-center justify-center rounded-full ${color} shrink-0 z-10`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <ClayCard padded={false} className="flex-1 p-4 ml-4">
                    <div className="flex items-center justify-between gap-2">
                      <ClayBadge tone={isNote ? 'amber' : isIn ? 'green' : 'blue'}>{isNote ? 'Note' : isIn ? 'Received' : 'Sent'}</ClayBadge>
                      <span className="text-[11px] text-clay-ink-muted whitespace-nowrap">
                        {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : ''}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-clay-ink-muted">{ev.content || '--'}</p>
                  </ClayCard>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {events && !isLoading && events.length === 0 && (
        <ClayCard className="p-12 text-center">
          <LuHistory className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">No events found for this contact.</p>
        </ClayCard>
      )}

      {!events && !isLoading && (
        <ClayCard className="p-12 text-center">
          <LuHistory className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">Enter a contact ID to view their interaction timeline.</p>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}

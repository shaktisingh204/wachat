'use client';

/**
 * Wachat Contact Timeline — chronological interaction history for a contact.
 */

import * as React from 'react';
import { useState } from 'react';
import {
  LuHistory, LuSearch, LuMessageSquare, LuMegaphone, LuTag,
  LuStickyNote, LuArrowRightLeft, LuLoader, LuCircle,
} from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';

interface TimelineEvent {
  id: string;
  type: 'message_in' | 'message_out' | 'broadcast' | 'status_change' | 'note' | 'tag';
  title: string;
  description: string;
  timestamp: string;
}

const MOCK_EVENTS: TimelineEvent[] = [
  { id: '1', type: 'message_in', title: 'Message Received', description: '"Hi, I need help with my order"', timestamp: '2026-04-12 14:32' },
  { id: '2', type: 'message_out', title: 'Message Sent', description: '"Sure! Can you share your order ID?"', timestamp: '2026-04-12 14:33' },
  { id: '3', type: 'tag', title: 'Tag Added', description: 'Added tag: support', timestamp: '2026-04-12 14:34' },
  { id: '4', type: 'message_in', title: 'Message Received', description: '"Order #12345"', timestamp: '2026-04-12 14:35' },
  { id: '5', type: 'note', title: 'Note Added', description: 'Customer reported missing item in order #12345', timestamp: '2026-04-12 14:36' },
  { id: '6', type: 'status_change', title: 'Status Changed', description: 'Conversation marked as Pending', timestamp: '2026-04-12 14:37' },
  { id: '7', type: 'broadcast', title: 'Broadcast Sent', description: 'Received "Weekly Promo" broadcast', timestamp: '2026-04-10 10:00' },
  { id: '8', type: 'message_out', title: 'Message Sent', description: '"Your replacement is on the way!"', timestamp: '2026-04-12 15:10' },
  { id: '9', type: 'tag', title: 'Tag Added', description: 'Added tag: resolved', timestamp: '2026-04-12 15:11' },
  { id: '10', type: 'status_change', title: 'Status Changed', description: 'Conversation marked as Resolved', timestamp: '2026-04-12 15:12' },
];

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  message_in:    { icon: LuMessageSquare,  color: 'text-green-600',  bg: 'bg-green-100' },
  message_out:   { icon: LuMessageSquare,  color: 'text-blue-600',   bg: 'bg-blue-100' },
  broadcast:     { icon: LuMegaphone,      color: 'text-purple-600', bg: 'bg-purple-100' },
  status_change: { icon: LuArrowRightLeft, color: 'text-amber-600',  bg: 'bg-amber-100' },
  note:          { icon: LuStickyNote,     color: 'text-pink-600',   bg: 'bg-pink-100' },
  tag:           { icon: LuTag,            color: 'text-cyan-600',   bg: 'bg-cyan-100' },
};

export default function ContactTimelinePage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [contactId, setContactId] = useState('');
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);

  const handleSearch = () => {
    if (!contactId.trim()) {
      toast({ title: 'Required', description: 'Enter a contact ID or phone.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setEvents(null);
    setTimeout(() => {
      setEvents(MOCK_EVENTS);
      setLoading(false);
    }, 1000);
  };

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

      {/* Search */}
      <ClayCard padded={false} className="p-5">
        <div className="flex gap-3">
          <input type="text" value={contactId} onChange={(e) => setContactId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Contact ID or phone number..."
            className="flex-1 rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none" />
          <ClayButton size="sm" variant="obsidian" onClick={handleSearch} disabled={loading}>
            {loading ? <LuLoader className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <LuSearch className="mr-1.5 h-3.5 w-3.5" />}
            Load Timeline
          </ClayButton>
        </div>
      </ClayCard>

      {loading && (
        <div className="flex h-32 items-center justify-center gap-3">
          <LuLoader className="h-5 w-5 animate-spin text-clay-ink-muted" />
          <p className="text-[13px] text-clay-ink-muted">Loading timeline...</p>
        </div>
      )}

      {/* Timeline */}
      {events && !loading && (
        <div className="relative pl-8">
          {/* Vertical line */}
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-clay-border" />
          <div className="space-y-4">
            {events.map((ev) => {
              const cfg = EVENT_CONFIG[ev.type];
              const Icon = cfg.icon;
              return (
                <div key={ev.id} className="relative flex gap-4">
                  <div className={`absolute -left-4.5 flex h-7 w-7 items-center justify-center rounded-full ${cfg.bg} ${cfg.color} shrink-0 z-10`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <ClayCard padded={false} className="flex-1 p-4 ml-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[13px] font-semibold text-clay-ink">{ev.title}</h3>
                      <span className="text-[11px] text-clay-ink-muted whitespace-nowrap">{ev.timestamp}</span>
                    </div>
                    <p className="mt-1 text-[12px] text-clay-ink-muted">{ev.description}</p>
                  </ClayCard>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!events && !loading && (
        <ClayCard className="p-12 text-center">
          <LuHistory className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">Enter a contact ID to view their interaction timeline.</p>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}

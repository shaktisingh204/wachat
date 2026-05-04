'use client';

/**
 * Wachat Conversation Summary — aggregate real timeline data into a readable summary.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuChartBar, LuCircleCheck, LuCircleX, LuTriangleAlert, LuSearch, LuLoader, LuMessageSquare } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';
import { getContactTimeline } from '@/app/actions/wachat-features.actions';
import { getContactsPageData } from '@/app/actions/contact.actions';

export default function ConversationSummaryPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<any[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [events, setEvents] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadContacts = useCallback((q = '') => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getContactsPageData(String(activeProject._id), undefined, 1, q);
      setContacts(res.contacts ?? []);
    });
  }, [activeProject?._id]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const handleSearch = () => loadContacts(searchQ);

  const loadTimeline = (contactId: string) => {
    if (!activeProject?._id) return;
    setSelectedId(contactId);
    startTransition(async () => {
      const res = await getContactTimeline(String(activeProject._id), contactId);
      if (res.error) { toast({ title: 'Error', description: res.error, variant: 'destructive' }); return; }
      setEvents(res.events ?? []);
      setLoaded(true);
    });
  };

  const selectedContact = contacts.find((c: any) => c._id === selectedId);
  const inbound = events.filter((e: any) => e.type === 'message' && e.direction === 'in');
  const outbound = events.filter((e: any) => e.type === 'message' && e.direction === 'out');
  const notes = events.filter((e: any) => e.type === 'note');

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Conversation Summary' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">Conversation Summary</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Select a contact to see an aggregated summary of their conversation timeline.</p>
      </div>

      <ClayCard padded={false} className="p-5">
        <h2 className="text-[15px] font-semibold text-foreground mb-3">Select Contact</h2>
        <div className="flex gap-3 mb-3">
          <input type="text" value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by name or phone..."
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none" />
          <ClayButton size="sm" variant="pill" onClick={handleSearch} disabled={isPending}>
            {isPending ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : <LuSearch className="h-3.5 w-3.5" />}
          </ClayButton>
        </div>
        {contacts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {contacts.slice(0, 10).map((c: any) => (
              <ClayButton key={c._id} variant={selectedId === c._id ? 'obsidian' : 'pill'} size="sm"
                onClick={() => loadTimeline(c._id)}>
                {c.name || c.waId || 'Unknown'}
              </ClayButton>
            ))}
          </div>
        )}
      </ClayCard>

      {isPending && selectedId && (
        <div className="flex h-32 items-center justify-center gap-3">
          <LuLoader className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-[13px] text-muted-foreground">Loading timeline...</p>
        </div>
      )}

      {loaded && !isPending && (
        <>
          <ClayCard padded={false} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-[15px] font-semibold text-foreground">{selectedContact?.name || selectedContact?.waId || 'Contact'}</h2>
                <p className="text-[12px] text-muted-foreground font-mono">{selectedContact?.waId}</p>
              </div>
              <div className="flex items-center gap-2">
                <LuMessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px] text-foreground">{events.length} events</span>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              {events.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No messages found for this contact.</p>
              ) : (
                <p className="text-[13px] text-foreground leading-relaxed">
                  This conversation has {inbound.length} inbound and {outbound.length} outbound messages
                  {notes.length > 0 ? `, plus ${notes.length} internal note(s)` : ''}.
                  {events[0]?.timestamp && ` Most recent activity: ${new Date(events[0].timestamp).toLocaleDateString()}.`}
                  {events[events.length - 1]?.timestamp && ` First recorded activity: ${new Date(events[events.length - 1].timestamp).toLocaleDateString()}.`}
                </p>
              )}
            </div>
          </ClayCard>

          <div className="grid gap-4 sm:grid-cols-3">
            <ClayCard padded={false} className="p-5 text-center">
              <div className="text-[12px] text-muted-foreground mb-1">Inbound</div>
              <div className="text-[28px] font-bold text-foreground">{inbound.length}</div>
              <ClayBadge tone="blue">Customer</ClayBadge>
            </ClayCard>
            <ClayCard padded={false} className="p-5 text-center">
              <div className="text-[12px] text-muted-foreground mb-1">Outbound</div>
              <div className="text-[28px] font-bold text-foreground">{outbound.length}</div>
              <ClayBadge tone="green">Agent</ClayBadge>
            </ClayCard>
            <ClayCard padded={false} className="p-5 text-center">
              <div className="text-[12px] text-muted-foreground mb-1">Notes</div>
              <div className="text-[28px] font-bold text-foreground">{notes.length}</div>
              <ClayBadge tone="amber">Internal</ClayBadge>
            </ClayCard>
          </div>

          {events.length > 0 && (
            <ClayCard padded={false} className="overflow-x-auto">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-[15px] font-semibold text-foreground">Recent Activity</h2>
              </div>
              <div className="divide-y divide-border">
                {events.slice(0, 15).map((e: any, i: number) => (
                  <div key={i} className="px-5 py-3 flex items-start gap-3">
                    <ClayBadge tone={e.type === 'note' ? 'amber' : e.direction === 'in' ? 'blue' : 'green'}>
                      {e.type === 'note' ? 'Note' : e.direction === 'in' ? 'In' : 'Out'}
                    </ClayBadge>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] text-foreground truncate">{e.content || '--'}</p>
                      <span className="text-[11px] text-muted-foreground">{e.timestamp ? new Date(e.timestamp).toLocaleString() : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ClayCard>
          )}
        </>
      )}

      {!loaded && !isPending && (
        <ClayCard className="p-12 text-center">
          <LuCircleX className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">Select a contact above to generate a conversation summary.</p>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}

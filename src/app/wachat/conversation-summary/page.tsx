'use client';

/**
 * /wachat/conversation-summary — AI-aggregated timeline summary,
 * rebuilt on ZoruUI primitives.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import {
  CircleX,
  Search,
  Loader2,
  MessageSquare,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { getContactTimeline } from '@/app/actions/wachat-features.actions';
import { getContactsPageData } from '@/app/actions/contact.actions';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruBadge,
  ZoruEmptyState,
} from '@/components/zoruui';

export default function ConversationSummaryPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
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
  const inbound = events.filter(
    (e: any) => e.type === 'message' && e.direction === 'in',
  );
  const outbound = events.filter(
    (e: any) => e.type === 'message' && e.direction === 'out',
  );
  const notes = events.filter((e: any) => e.type === 'note');

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
            <ZoruBreadcrumbPage>Conversation Summary</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div>
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Conversation Summary
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          Select a contact to see an aggregated summary of their conversation timeline.
        </p>
      </div>

      <ZoruCard className="p-5">
        <h2 className="mb-3 text-[15px] text-zoru-ink">Select Contact</h2>
        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <ZoruInput
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by name or phone..."
            />
          </div>
          <ZoruButton
            size="sm"
            variant="outline"
            onClick={handleSearch}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Search />
            )}
          </ZoruButton>
        </div>
        {contacts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {contacts.slice(0, 10).map((c: any) => (
              <ZoruButton
                key={c._id}
                variant={selectedId === c._id ? 'default' : 'outline'}
                size="sm"
                onClick={() => loadTimeline(c._id)}
              >
                {c.name || c.waId || 'Unknown'}
              </ZoruButton>
            ))}
          </div>
        )}
      </ZoruCard>

      {isPending && selectedId && (
        <div className="flex h-32 items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
          <p className="text-[13px] text-zoru-ink-muted">Loading timeline...</p>
        </div>
      )}

      {loaded && !isPending && (
        <>
          <ZoruCard className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-[15px] text-zoru-ink">
                  {selectedContact?.name || selectedContact?.waId || 'Contact'}
                </h2>
                <p className="font-mono text-[12px] text-zoru-ink-muted">
                  {selectedContact?.waId}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-zoru-ink-muted" />
                <span className="text-[13px] text-zoru-ink">
                  {events.length} events
                </span>
              </div>
            </div>
            <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-4">
              {events.length === 0 ? (
                <p className="text-[13px] text-zoru-ink-muted">
                  No messages found for this contact.
                </p>
              ) : (
                <p className="text-[13px] leading-relaxed text-zoru-ink">
                  This conversation has {inbound.length} inbound and{' '}
                  {outbound.length} outbound messages
                  {notes.length > 0
                    ? `, plus ${notes.length} internal note(s)`
                    : ''}
                  .
                  {events[0]?.timestamp &&
                    ` Most recent activity: ${new Date(events[0].timestamp).toLocaleDateString()}.`}
                  {events[events.length - 1]?.timestamp &&
                    ` First recorded activity: ${new Date(events[events.length - 1].timestamp).toLocaleDateString()}.`}
                </p>
              )}
            </div>
          </ZoruCard>

          <div className="grid gap-4 sm:grid-cols-3">
            <ZoruCard className="p-5 text-center">
              <div className="mb-1 text-[12px] text-zoru-ink-muted">Inbound</div>
              <div className="text-[28px] text-zoru-ink">{inbound.length}</div>
              <ZoruBadge variant="info">Customer</ZoruBadge>
            </ZoruCard>
            <ZoruCard className="p-5 text-center">
              <div className="mb-1 text-[12px] text-zoru-ink-muted">Outbound</div>
              <div className="text-[28px] text-zoru-ink">{outbound.length}</div>
              <ZoruBadge variant="success">Agent</ZoruBadge>
            </ZoruCard>
            <ZoruCard className="p-5 text-center">
              <div className="mb-1 text-[12px] text-zoru-ink-muted">Notes</div>
              <div className="text-[28px] text-zoru-ink">{notes.length}</div>
              <ZoruBadge variant="warning">Internal</ZoruBadge>
            </ZoruCard>
          </div>

          {events.length > 0 && (
            <ZoruCard className="overflow-x-auto p-0">
              <div className="border-b border-zoru-line px-5 py-4">
                <h2 className="text-[15px] text-zoru-ink">Recent Activity</h2>
              </div>
              <div className="divide-y divide-zoru-line">
                {events.slice(0, 15).map((e: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 px-5 py-3">
                    <ZoruBadge
                      variant={
                        e.type === 'note'
                          ? 'warning'
                          : e.direction === 'in'
                            ? 'info'
                            : 'success'
                      }
                    >
                      {e.type === 'note'
                        ? 'Note'
                        : e.direction === 'in'
                          ? 'In'
                          : 'Out'}
                    </ZoruBadge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] text-zoru-ink">
                        {e.content || '--'}
                      </p>
                      <span className="text-[11px] text-zoru-ink-muted">
                        {e.timestamp ? new Date(e.timestamp).toLocaleString() : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ZoruCard>
          )}
        </>
      )}

      {!loaded && !isPending && (
        <ZoruEmptyState
          icon={<CircleX />}
          title="Select a contact"
          description="Choose a contact above to generate a conversation summary."
        />
      )}
      <div className="h-6" />
    </div>
  );
}

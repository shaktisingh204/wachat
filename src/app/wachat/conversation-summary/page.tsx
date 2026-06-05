'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Input,
  Badge,
  EmptyState,
  Spinner,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import {
  Search,
  MessageSquare,
  } from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useProject } from '@/context/project-context';
import { getContactTimeline } from '@/app/actions/wachat-features.actions';
import { getContactsPageData } from '@/app/actions/contact.actions';

/**
 * /wachat/conversation-summary — AI-aggregated timeline summary,
 * rebuilt on the 20ui design system inside the standard WachatPage frame.
 */

import * as React from 'react';

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
        toast({ title: 'Error', description: res.error, tone: 'danger' });
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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Conversation Summary' },
      ]}
      title="Conversation Summary"
      description="Select a contact to see an aggregated summary of their conversation timeline."
    >
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Select Contact</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="mb-3 flex gap-3">
              <div className="flex-1">
                <Input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by name or phone..."
                  iconLeft={Search}
                  aria-label="Search contacts by name or phone"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSearch}
                loading={isPending}
                iconLeft={Search}
              >
                Search
              </Button>
            </div>
            {contacts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {contacts.slice(0, 10).map((c: any) => (
                  <Button
                    key={c._id}
                    variant={selectedId === c._id ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => loadTimeline(c._id)}
                  >
                    {c.name || c.waId || 'Unknown'}
                  </Button>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {isPending && selectedId && (
          <div className="flex h-32 items-center justify-center gap-3">
            <Spinner size="sm" />
            <p className="text-[13px]" style={{ color: 'var(--st-text-secondary)' }}>
              Loading timeline...
            </p>
          </div>
        )}

        {loaded && !isPending && (
          <>
            <Card>
              <CardBody>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px]" style={{ color: 'var(--st-text)' }}>
                      {selectedContact?.name || selectedContact?.waId || 'Contact'}
                    </h2>
                    <p
                      className="font-mono text-[12px]"
                      style={{ color: 'var(--st-text-secondary)' }}
                    >
                      {selectedContact?.waId}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare
                      className="h-4 w-4"
                      style={{ color: 'var(--st-text-secondary)' }}
                      aria-hidden="true"
                    />
                    <span className="text-[13px]" style={{ color: 'var(--st-text)' }}>
                      {events.length} events
                    </span>
                  </div>
                </div>
                <div
                  className="p-4"
                  style={{
                    borderRadius: 'var(--st-radius)',
                    border: '1px solid var(--st-border)',
                    background: 'var(--st-bg-secondary)',
                  }}
                >
                  {events.length === 0 ? (
                    <p
                      className="text-[13px]"
                      style={{ color: 'var(--st-text-secondary)' }}
                    >
                      No messages found for this contact.
                    </p>
                  ) : (
                    <p
                      className="text-[13px] leading-relaxed"
                      style={{ color: 'var(--st-text)' }}
                    >
                      This conversation has {inbound.length} inbound and{' '}
                      {outbound.length} outbound messages
                      {notes.length > 0
                        ? `, plus ${notes.length} internal note(s)`
                        : ''}
                      .
                      {events[0]?.timestamp &&
                        ` Most recent activity: ${fmtDate(events[0].timestamp)}.`}
                      {events[events.length - 1]?.timestamp &&
                        ` First recorded activity: ${fmtDate(events[events.length - 1].timestamp)}.`}
                    </p>
                  )}
                </div>
              </CardBody>
            </Card>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardBody className="text-center">
                  <div
                    className="mb-1 text-[12px]"
                    style={{ color: 'var(--st-text-secondary)' }}
                  >
                    Inbound
                  </div>
                  <div className="text-[28px]" style={{ color: 'var(--st-text)' }}>
                    {inbound.length}
                  </div>
                  <Badge tone="info">Customer</Badge>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="text-center">
                  <div
                    className="mb-1 text-[12px]"
                    style={{ color: 'var(--st-text-secondary)' }}
                  >
                    Outbound
                  </div>
                  <div className="text-[28px]" style={{ color: 'var(--st-text)' }}>
                    {outbound.length}
                  </div>
                  <Badge tone="success">Agent</Badge>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="text-center">
                  <div
                    className="mb-1 text-[12px]"
                    style={{ color: 'var(--st-text-secondary)' }}
                  >
                    Notes
                  </div>
                  <div className="text-[28px]" style={{ color: 'var(--st-text)' }}>
                    {notes.length}
                  </div>
                  <Badge tone="warning">Internal</Badge>
                </CardBody>
              </Card>
            </div>

            {events.length > 0 && (
              <Card className="overflow-x-auto">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <div
                  style={{ borderTop: '1px solid var(--st-border)' }}
                >
                  {events.slice(0, 15).map((e: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 px-5 py-3"
                      style={
                        i > 0
                          ? { borderTop: '1px solid var(--st-border)' }
                          : undefined
                      }
                    >
                      <Badge
                        tone={
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
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-[12.5px]"
                          style={{ color: 'var(--st-text)' }}
                        >
                          {e.content || '--'}
                        </p>
                        <span
                          className="text-[11px]"
                          style={{ color: 'var(--st-text-secondary)' }}
                        >
                          {e.timestamp ? fmtDate(e.timestamp) : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        {!loaded && !isPending && (
          <EmptyState
            icon={MessageSquare}
            title="Select a contact"
            description="Choose a contact above to generate a conversation summary."
          />
        )}
      </div>
    </WachatPage>
  );
}

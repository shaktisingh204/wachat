'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Input,
  Badge,
  EmptyState,
  Spinner,
  StatCard,
  Callout,
  Separator,
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
            <p className="text-[13px] u-text-secondary">
              Loading timeline...
            </p>
          </div>
        )}

        {loaded && !isPending && (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {selectedContact?.name || selectedContact?.waId || 'Contact'}
                    </CardTitle>
                    {selectedContact?.waId && (
                      <CardDescription className="font-mono">
                        {selectedContact.waId}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare
                      className="h-4 w-4 u-text-secondary"
                      aria-hidden="true"
                    />
                    <span className="text-[13px] u-text">
                      {events.length} events
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardBody>
                {events.length === 0 ? (
                  <Callout tone="neutral">
                    No messages found for this contact.
                  </Callout>
                ) : (
                  <Callout tone="neutral" icon={null}>
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
                  </Callout>
                )}
              </CardBody>
            </Card>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Inbound"
                value={inbound.length}
                delta={{ value: 'Customer', tone: 'neutral' }}
              />
              <StatCard
                label="Outbound"
                value={outbound.length}
                delta={{ value: 'Agent', tone: 'neutral' }}
              />
              <StatCard
                label="Notes"
                value={notes.length}
                delta={{ value: 'Internal', tone: 'neutral' }}
              />
            </div>

            {events.length > 0 && (
              <Card className="overflow-x-auto">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                  {events.slice(0, 15).map((e: any, i: number) => (
                    <React.Fragment key={i}>
                      {i > 0 && <Separator />}
                      <div className="flex items-start gap-3 px-5 py-3">
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
                          <p className="truncate text-[12.5px] u-text">
                            {e.content || '--'}
                          </p>
                          <span className="text-[11px] u-text-secondary">
                            {e.timestamp ? fmtDate(e.timestamp) : ''}
                          </span>
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </CardBody>
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

'use client';
import { fmtDate } from "@/lib/utils";
import "@/components/wachat/motion/wachat-motion.css";

import {
  useToast,
  Badge,
  Button,
  Card,
  Menu,
  MenuItem,
  MenuLabel,
  EmptyState,
  Field,
  Input,
  ScrollArea,
  Skeleton,
} from '@/components/sabcrm/20ui';
import {
  useState,
  useTransition,
  useCallback } from 'react';
import {
  History,
  Search,
  MessageSquare,
  StickyNote,
  Filter,
  Check,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getContactTimeline } from '@/app/actions/wachat-features.actions';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat Contact Timeline — rebuilt on 20ui primitives.
 *
 * Same data, same handlers. Visual primitives swapped to 20ui.
 */

import * as React from 'react';

type FilterMode = 'all' | 'message' | 'note';

const FILTER_LABELS: Record<FilterMode, string> = {
  all: 'All events',
  message: 'Messages only',
  note: 'Notes only',
};

const FILTER_ORDER: FilterMode[] = ['all', 'message', 'note'];

export default function ContactTimelinePage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
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
        tone: 'danger',
      });
      return;
    }
    startLoading(async () => {
      const res = await getContactTimeline(projectId, contactId.trim());
      if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          tone: 'danger',
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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Contacts', href: '/wachat/contacts' },
        { label: 'Timeline' },
      ]}
      title="Contact Timeline"
      description="View the full interaction history of any contact."
    >
      <div className="flex flex-col gap-6">
        <Card padding="md">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Contact ID or phone number" className="min-w-[260px] flex-1">
              <Input
                id="ct-contact"
                type="text"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Contact ID or phone number…"
                iconLeft={Search}
              />
            </Field>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={handleSearch}
                loading={isLoading}
                iconLeft={Search}
              >
                Load timeline
              </Button>
              <Menu
                align="end"
                label="Filter by type"
                trigger={
                  <Button variant="outline" size="sm" iconLeft={Filter}>
                    {FILTER_LABELS[filter]}
                  </Button>
                }
              >
                <MenuLabel>Filter by type</MenuLabel>
                {FILTER_ORDER.map((mode) => (
                  <MenuItem
                    key={mode}
                    onSelect={() => setFilter(mode)}
                    hint={
                      filter === mode ? (
                        <Check size={14} aria-hidden="true" />
                      ) : null
                    }
                  >
                    {FILTER_LABELS[mode]}
                  </MenuItem>
                ))}
              </Menu>
            </div>
          </div>
        </Card>

        {isLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={64} width="100%" />
            ))}
          </div>
        )}

        {filteredEvents && !isLoading && filteredEvents.length > 0 && (
          <ScrollArea style={{ maxHeight: 640 }}>
            <div className="relative pl-8">
              <div
                className="absolute left-3.5 bottom-0 top-0 w-px bg-[var(--st-border)]"
                aria-hidden="true"
              />
              <div className="space-y-4">
                {filteredEvents.map((ev, i) => {
                  const isNote = ev.type === 'note';
                  const isIn = ev.direction === 'in';
                  const Icon = isNote ? StickyNote : MessageSquare;
                  return (
                    <div
                      key={i}
                      className="wachat-stagger-item relative flex gap-4"
                      style={{ ['--i' as string]: Math.min(i, 14) } as React.CSSProperties}
                    >
                      <div
                        className="absolute -left-4.5 z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </div>
                      <Card padding="sm" className="ml-4 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            tone={isNote ? 'warning' : isIn ? 'success' : 'info'}
                          >
                            {isNote ? 'Note' : isIn ? 'Received' : 'Sent'}
                          </Badge>
                          <span
                            className="whitespace-nowrap text-[11px] text-[var(--st-text-tertiary)]"
                          >
                            {ev.timestamp ? fmtDate(ev.timestamp) : ''}
                          </span>
                        </div>
                        <p
                          className="mt-1 text-[12px] text-[var(--st-text-secondary)]"
                        >
                          {ev.content || '—'}
                        </p>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
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
      </div>
    </WachatPage>
  );
}

'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  Button,
  Card,
  Badge,
  Dot,
  ScrollArea,
  EmptyState,
  Spinner,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import {
  MessageCircle,
  User,
  RefreshCw,
  Inbox,
  } from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useProject } from '@/context/project-context';
import { getContactsPageData } from '@/app/actions/contact.actions';

/**
 * /wachat/conversation-kanban — Real contacts grouped by status, rebuilt on the
 * 20ui design system inside the WaChat full-bleed app frame. Neutral palette
 * only — column dots use 20ui status tones, not raw greens/blues/ambers.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

type ColumnTone = 'info' | 'warning' | 'success';

type Column = {
  id: string;
  title: string;
  /** 20ui status tone for the column header dot. */
  tone: ColumnTone;
  items: any[];
};

function groupContacts(contacts: any[]): Column[] {
  const cols: Column[] = [
    { id: 'new', title: 'New', tone: 'info', items: [] },
    { id: 'active', title: 'Active', tone: 'warning', items: [] },
    { id: 'resolved', title: 'Resolved', tone: 'success', items: [] },
  ];
  for (const c of contacts) {
    const status = c.conversationStatus || c.status || 'new';
    if (status === 'resolved' || status === 'closed') cols[2].items.push(c);
    else if (c.lastMessageTimestamp || status === 'active') cols[1].items.push(c);
    else cols[0].items.push(c);
  }
  return cols;
}

export default function ConversationKanbanPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [columns, setColumns] = useState<Column[]>([]);

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getContactsPageData(
        String(activeProject._id),
        undefined,
        1,
        '',
      );
      if (!res.contacts) {
        toast({
          title: 'Error',
          description: 'Could not load contacts.',
          tone: 'danger',
        });
        return;
      }
      setColumns(groupContacts(res.contacts));
    });
  }, [activeProject?._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const totalCards = columns.reduce((s, c) => s + c.items.length, 0);

  return (
    <WachatPage variant="app">
      <div className="flex h-full min-h-0 flex-col gap-6 px-6 pt-6 pb-10">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="text-[30px] leading-[1.1] tracking-[-0.015em]"
              style={{ color: 'var(--st-text)' }}
            >
              Conversation Kanban
            </h1>
            <p
              className="mt-1.5 text-[13px]"
              style={{ color: 'var(--st-text-secondary)' }}
            >
              View conversations organized by status ({totalCards} contacts).
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            iconLeft={RefreshCw}
            loading={isPending}
            onClick={load}
          >
            Refresh
          </Button>
        </div>

        {isPending && columns.length === 0 ? (
          <div className="flex h-40 items-center justify-center gap-3">
            <Spinner size="sm" label="Loading contacts" />
            <span className="text-[13px]" style={{ color: 'var(--st-text-secondary)' }}>
              Loading contacts...
            </span>
          </div>
        ) : (
          <ScrollArea horizontal className="min-h-0 flex-1 pb-4">
            <div className="flex gap-4">
              {columns.map((col) => (
                <div key={col.id} className="w-80 flex-shrink-0">
                  <div className="mb-3 flex items-center gap-2">
                    <Dot tone={col.tone} aria-hidden="true" />
                    <h2 className="text-[15px]" style={{ color: 'var(--st-text)' }}>
                      {col.title}
                    </h2>
                    <Badge tone="neutral" className="ml-auto">
                      {col.items.length}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-3">
                    {col.items.map((item: any) => (
                      <Card key={item._id} variant="interactive" padding="md">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span
                            className="truncate text-[14px]"
                            style={{ color: 'var(--st-text)' }}
                          >
                            {item.name || item.waId || 'Unknown'}
                          </span>
                          {item.lastMessageTimestamp && (
                            <span
                              className="whitespace-nowrap text-[11px]"
                              style={{ color: 'var(--st-text-tertiary)' }}
                            >
                              {fmtDate(item.lastMessageTimestamp)}
                            </span>
                          )}
                        </div>
                        <p
                          className="flex items-center gap-1 truncate text-[12.5px]"
                          style={{ color: 'var(--st-text-secondary)' }}
                        >
                          <MessageCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {item.waId || 'No phone'}
                        </p>
                        {item.tagIds?.length > 0 && (
                          <div
                            className="mt-2 flex items-center gap-1 text-[11px]"
                            style={{ color: 'var(--st-text-tertiary)' }}
                          >
                            <User className="h-3 w-3" aria-hidden="true" />
                            {item.tagIds.length} tag(s)
                          </div>
                        )}
                      </Card>
                    ))}
                    {col.items.length === 0 && (
                      <EmptyState
                        icon={Inbox}
                        size="sm"
                        title="No conversations"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </WachatPage>
  );
}

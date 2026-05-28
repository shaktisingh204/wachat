'use client';
import { fmtDate } from "@/lib/utils";

import {
  useZoruToast,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Badge,
  ScrollArea,
  cn,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import {
  MessageCircle,
  User,
  Loader2,
  RefreshCw,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getContactsPageData } from '@/app/actions/contact.actions';

/**
 * /wachat/conversation-kanban — Real contacts grouped by status,
 * rebuilt on ZoruUI primitives. Neutral palette only — column dots
 * use ink shades instead of green/blue/amber.
 */

import * as React from 'react';

type Column = {
  id: string;
  title: string;
  /** Tailwind utility for the column header dot — neutral palette only. */
  dotClass: string;
  items: any[];
};

function groupContacts(contacts: any[]): Column[] {
  const cols: Column[] = [
    { id: 'new', title: 'New', dotClass: 'bg-zoru-info', items: [] },
    { id: 'active', title: 'Active', dotClass: 'bg-zoru-warning', items: [] },
    { id: 'resolved', title: 'Resolved', dotClass: 'bg-zoru-success', items: [] },
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
  const { toast } = useZoruToast();
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
          variant: 'destructive',
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
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
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
            <ZoruBreadcrumbPage>Conversation Kanban</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Conversation Kanban
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            View conversations organized by status ({totalCards} contacts).
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <RefreshCw />
          )}
          Refresh
        </Button>
      </div>

      {isPending && columns.length === 0 ? (
        <div className="flex h-40 items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
          <span className="text-[13px] text-zoru-ink-muted">
            Loading contacts...
          </span>
        </div>
      ) : (
        <ScrollArea className="pb-4">
          <div className="flex gap-4">
            {columns.map((col) => (
              <div key={col.id} className="w-80 flex-shrink-0">
                <div className="mb-3 flex items-center gap-2">
                  <span className={cn('h-3 w-3 rounded-full', col.dotClass)} />
                  <h2 className="text-[15px] text-zoru-ink">{col.title}</h2>
                  <Badge variant="secondary" className="ml-auto">
                    {col.items.length}
                  </Badge>
                </div>
                <div className="flex flex-col gap-3">
                  {col.items.map((item: any) => (
                    <Card
                      key={item._id}
                      className="p-4 transition-shadow hover:shadow-[var(--zoru-shadow-md)]"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-[14px] text-zoru-ink">
                          {item.name || item.waId || 'Unknown'}
                        </span>
                        {item.lastMessageTimestamp && (
                          <span className="whitespace-nowrap text-[11px] text-zoru-ink-muted">
                            {fmtDate(item.lastMessageTimestamp)}
                          </span>
                        )}
                      </div>
                      <p className="flex items-center gap-1 truncate text-[12.5px] text-zoru-ink-muted">
                        <MessageCircle className="h-3 w-3 shrink-0" />
                        {item.waId || 'No phone'}
                      </p>
                      {item.tagIds?.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-[11px] text-zoru-ink-muted">
                          <User className="h-3 w-3" />
                          {item.tagIds.length} tag(s)
                        </div>
                      )}
                    </Card>
                  ))}
                  {col.items.length === 0 && (
                    <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line p-6 text-center text-[12px] text-zoru-ink-muted">
                      No conversations
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
      <div className="h-6" />
    </div>
  );
}

'use client';

/**
 * Wachat Conversation Kanban — real contacts grouped by status.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuChartBar, LuCircleCheck, LuCircleX, LuTriangleAlert, LuUser, LuMessageCircle, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { getContactsPageData } from '@/app/actions/contact.actions';

type Column = { id: string; title: string; color: string; items: any[] };

function groupContacts(contacts: any[]): Column[] {
  const cols: Column[] = [
    { id: 'new', title: 'New', color: 'bg-blue-400', items: [] },
    { id: 'active', title: 'Active', color: 'bg-amber-400', items: [] },
    { id: 'resolved', title: 'Resolved', color: 'bg-emerald-400', items: [] },
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
      const res = await getContactsPageData(String(activeProject._id), undefined, 1, '');
      if (!res.contacts) { toast({ title: 'Error', description: 'Could not load contacts.', variant: 'destructive' }); return; }
      setColumns(groupContacts(res.contacts));
    });
  }, [activeProject?._id, toast]);

  useEffect(() => { load(); }, [load]);

  const totalCards = columns.reduce((s, c) => s + c.items.length, 0);

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Conversation Kanban' },
      ]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">Conversation Kanban</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">View conversations organized by status ({totalCards} contacts).</p>
        </div>
        <ClayButton variant="pill" size="sm" onClick={load} disabled={isPending}>
          {isPending ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
        </ClayButton>
      </div>

      {isPending && columns.length === 0 ? (
        <div className="flex h-40 items-center justify-center gap-3">
          <LuLoader className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-[13px] text-muted-foreground">Loading contacts...</span>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <div key={col.id} className="flex-shrink-0 w-80">
              <div className="flex items-center gap-2 mb-3">
                <span className={`h-3 w-3 rounded-full ${col.color}`} />
                <h2 className="text-[15px] font-semibold text-foreground">{col.title}</h2>
                <ClayBadge tone="neutral" className="ml-auto">{col.items.length}</ClayBadge>
              </div>
              <div className="flex flex-col gap-3">
                {col.items.map((item: any) => (
                  <ClayCard key={item._id} padded={false} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[14px] font-semibold text-foreground truncate">{item.name || item.waId || 'Unknown'}</span>
                      {item.lastMessageTimestamp && (
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {new Date(item.lastMessageTimestamp).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-[12.5px] text-muted-foreground truncate flex items-center gap-1">
                      <LuMessageCircle className="h-3 w-3 shrink-0" />
                      {item.waId || 'No phone'}
                    </p>
                    {item.tagIds?.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <LuUser className="h-3 w-3" />
                        {item.tagIds.length} tag(s)
                      </div>
                    )}
                  </ClayCard>
                ))}
                {col.items.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-[12px] text-muted-foreground">
                    No conversations
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="h-6" />
    </div>
  );
}

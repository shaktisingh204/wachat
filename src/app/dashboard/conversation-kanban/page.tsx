'use client';

/**
 * Wachat Conversation Kanban — kanban board for conversations by status.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuGripVertical, LuUser, LuMessageCircle } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayCard } from '@/components/clay';

type ConvoCard = { id: string; contact: string; lastMessage: string; agent: string; time: string };
type Column = { id: string; title: string; color: string; items: ConvoCard[] };

const INITIAL_COLUMNS: Column[] = [
  {
    id: 'new', title: 'New', color: 'bg-blue-400',
    items: [
      { id: '1', contact: 'Rahul Sharma', lastMessage: 'Hi, I need help with my order', agent: 'Unassigned', time: '2m ago' },
      { id: '2', contact: 'Priya Patel', lastMessage: 'Can you send the invoice?', agent: 'Unassigned', time: '5m ago' },
      { id: '3', contact: 'Amit Singh', lastMessage: 'What are your working hours?', agent: 'Unassigned', time: '12m ago' },
    ],
  },
  {
    id: 'in_progress', title: 'In Progress', color: 'bg-amber-400',
    items: [
      { id: '4', contact: 'Sneha Gupta', lastMessage: 'OK I will share the details now', agent: 'Priya P.', time: '8m ago' },
      { id: '5', contact: 'Vikram Joshi', lastMessage: 'Payment link received, thanks', agent: 'Rahul S.', time: '15m ago' },
    ],
  },
  {
    id: 'resolved', title: 'Resolved', color: 'bg-emerald-400',
    items: [
      { id: '6', contact: 'Ananya Das', lastMessage: 'Thank you, issue is fixed!', agent: 'Amit K.', time: '1h ago' },
      { id: '7', contact: 'Rohan Mehta', lastMessage: 'Got it, all good now', agent: 'Sneha G.', time: '2h ago' },
      { id: '8', contact: 'Kavita Nair', lastMessage: 'Replacement received. Thanks!', agent: 'Priya P.', time: '3h ago' },
    ],
  },
];

export default function ConversationKanbanPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [columns] = useState<Column[]>(INITIAL_COLUMNS);

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Conversation Kanban' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Conversation Kanban</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">View and manage conversations organized by status.</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div key={col.id} className="flex-shrink-0 w-80">
            <div className="flex items-center gap-2 mb-3">
              <span className={`h-3 w-3 rounded-full ${col.color}`} />
              <h2 className="text-[15px] font-semibold text-clay-ink">{col.title}</h2>
              <span className="ml-auto text-[12px] text-clay-ink-muted tabular-nums">{col.items.length}</span>
            </div>
            <div className="flex flex-col gap-3">
              {col.items.map((item) => (
                <ClayCard key={item.id} padded={false} className="p-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-2">
                    <LuGripVertical className="h-4 w-4 text-clay-ink-muted/40 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[14px] font-semibold text-clay-ink truncate">{item.contact}</span>
                        <span className="text-[11px] text-clay-ink-muted whitespace-nowrap">{item.time}</span>
                      </div>
                      <p className="text-[12.5px] text-clay-ink-muted truncate flex items-center gap-1">
                        <LuMessageCircle className="h-3 w-3 shrink-0" />
                        {item.lastMessage}
                      </p>
                      <div className="mt-2 flex items-center gap-1 text-[11px] text-clay-ink-muted">
                        <LuUser className="h-3 w-3" />
                        {item.agent}
                      </div>
                    </div>
                  </div>
                </ClayCard>
              ))}
              {col.items.length === 0 && (
                <div className="rounded-lg border border-dashed border-clay-border p-6 text-center text-[12px] text-clay-ink-muted">
                  No conversations
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="h-6" />
    </div>
  );
}

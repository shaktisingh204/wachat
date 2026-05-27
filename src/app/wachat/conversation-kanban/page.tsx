'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { MessageCircle, User, Loader2, RefreshCw, LayoutGrid } from 'lucide-react';
import { m } from 'motion/react';

import { useZoruToast } from '@/components/zoruui';
import {
  WaPage,
  PageHeader,
  WaButton,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import { fmtDate } from '@/lib/utils';
import { useProject } from '@/context/project-context';
import { getContactsPageData } from '@/app/actions/contact.actions';

/**
 * /wachat/conversation-kanban — Real contacts grouped by status.
 * Rebuilt on wachat-ui primitives. Asymmetric column widths give it
 * the landing-page-grade feel rather than a rigid 3-col grid.
 */

type Column = {
  id: string;
  title: string;
  /** dot color — semantic state only (new/active/resolved). */
  dotClass: string;
  /** asymmetric widths to break the rigid 4-col grid look. */
  width: number;
  items: any[];
};

function groupContacts(contacts: any[]): Column[] {
  const cols: Column[] = [
    { id: 'new', title: 'New', dotClass: 'bg-sky-500', width: 320, items: [] },
    { id: 'active', title: 'Active', dotClass: 'bg-amber-500', width: 360, items: [] },
    { id: 'resolved', title: 'Resolved', dotClass: 'bg-emerald-500', width: 320, items: [] },
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
        toast({ title: 'Error', description: 'Could not load contacts.', variant: 'destructive' });
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
    <WaPage fullBleed>
      <div className="mx-auto w-full max-w-[1400px] px-6 pb-10 pt-8">
        <PageHeader
          title="Conversation kanban"
          description={`Conversations grouped by lifecycle stage. ${totalCards.toLocaleString('en-IN')} contacts visible.`}
          kicker="Wachat · kanban"
          backHref="/wachat"
          eyebrowIcon={LayoutGrid}
          actions={
            <WaButton
              variant="outline"
              size="sm"
              leftIcon={isPending ? Loader2 : RefreshCw}
              onClick={load}
              disabled={isPending}
            >
              Refresh
            </WaButton>
          }
        />

        {isPending && columns.length === 0 ? (
          <div className="flex h-40 items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            <span className="text-[13px] text-zinc-500">Loading contacts...</span>
          </div>
        ) : columns.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title="No conversations yet"
            description="Once contacts start messaging, they'll appear in these columns by lifecycle stage."
          />
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4">
              {columns.map((col, colIdx) => (
                <m.section
                  key={col.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: colIdx * 0.06, ease: EASE_OUT }}
                  className="flex-shrink-0"
                  style={{ width: col.width }}
                >
                  <header className="mb-3 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${col.dotClass}`} aria-hidden />
                    <h2 className="text-[13px] font-semibold tracking-tight text-zinc-900">{col.title}</h2>
                    <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 tabular-nums">
                      {col.items.length}
                    </span>
                  </header>
                  <div className="flex flex-col gap-3">
                    {col.items.map((item: any, i) => (
                      <m.article
                        key={item._id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: colIdx * 0.06 + i * 0.03, ease: EASE_OUT }}
                        className="group cursor-pointer rounded-2xl border border-zinc-200 bg-white p-4 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[1px]"
                        style={{ boxShadow: '0 0 0 1px transparent' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 14px 32px -22px var(--mt-accent-glow)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px transparent'; }}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="truncate text-[13.5px] font-semibold text-zinc-900">
                            {item.name || item.waId || 'Unknown'}
                          </span>
                          {item.lastMessageTimestamp && (
                            <span className="shrink-0 whitespace-nowrap text-[10.5px] text-zinc-500 tabular-nums">
                              {fmtDate(item.lastMessageTimestamp)}
                            </span>
                          )}
                        </div>
                        <p className="flex items-center gap-1.5 truncate text-[12px] text-zinc-500">
                          <MessageCircle className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                          <span className="font-mono">{item.waId || 'No phone'}</span>
                        </p>
                        {item.tagIds?.length > 0 && (
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500">
                            <User className="h-3 w-3" strokeWidth={2} aria-hidden />
                            {item.tagIds.length} tag{item.tagIds.length === 1 ? '' : 's'}
                          </div>
                        )}
                      </m.article>
                    ))}
                    {col.items.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-[12px] text-zinc-400">
                        No conversations
                      </div>
                    )}
                  </div>
                </m.section>
              ))}
            </div>
          </div>
        )}
      </div>
    </WaPage>
  );
}

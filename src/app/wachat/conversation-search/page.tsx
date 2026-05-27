'use client';

import * as React from 'react';
import Link from 'next/link';
import { useState, useTransition, useCallback } from 'react';
import { Search, MessageCircle, Loader2 } from 'lucide-react';
import { m, AnimatePresence } from 'motion/react';

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
import { searchConversations } from '@/app/actions/wachat-features.actions';

/**
 * /wachat/conversation-search — Full-text search across conversations,
 * rebuilt on wachat-ui primitives.
 */

export default function ConversationSearchPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [isLoading, startLoading] = useTransition();

  const handleSearch = useCallback(() => {
    if (!query.trim() || !projectId) return;
    setSearched(true);
    startLoading(async () => {
      const res = await searchConversations(projectId, query.trim());
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        setResults([]);
      } else {
        setResults(res.messages || []);
      }
    });
  }, [query, projectId, toast]);

  return (
    <WaPage>
      <PageHeader
        title="Conversation search"
        description="Search across every message in this project, then jump directly into the matching thread."
        kicker="Wachat · search"
        backHref="/wachat"
        eyebrowIcon={Search}
      />

      <m.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE_OUT }}
        className="mb-6 flex max-w-2xl items-center gap-2 rounded-full border border-zinc-200 bg-white p-1.5 transition-colors focus-within:border-zinc-400"
      >
        <span className="pl-3 text-zinc-400">
          <Search className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch();
          }}
          placeholder="Search messages by content..."
          className="flex-1 bg-transparent text-[14px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          aria-label="Search conversations"
        />
        <WaButton
          size="sm"
          leftIcon={isLoading ? Loader2 : Search}
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
        >
          Search
        </WaButton>
      </m.div>

      {searched && !isLoading && (
        <p className="mb-4 text-[12.5px] tabular-nums text-zinc-500">
          {results.length.toLocaleString('en-IN')} result{results.length !== 1 ? 's' : ''} found
        </p>
      )}

      {isLoading && (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      )}

      {!isLoading && results.length > 0 && (
        <ul className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {results.map((r: any, i) => (
              <m.li
                key={r._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, delay: i * 0.025, ease: EASE_OUT }}
              >
                <Link
                  href={`/wachat/chat?contactId=${r.contactId || ''}`}
                  className="group block rounded-2xl border border-zinc-200 bg-white p-4 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-[1px]"
                  style={{ boxShadow: '0 0 0 1px transparent' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 14px 32px -22px var(--mt-accent-glow)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px transparent'; }}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[13.5px] font-semibold text-zinc-900">
                      {r.contactName || r.contactId || r.from || 'Unknown'}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-[11px] text-zinc-400 tabular-nums">
                      {r.timestamp ? fmtDate(r.timestamp) : ''}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-[13px] leading-relaxed text-zinc-600">
                    {r.content?.text || r.messageText || r.type || '-'}
                  </p>
                </Link>
              </m.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {!isLoading && !searched && (
        <EmptyState
          icon={Search}
          title="Start searching"
          description="Type a query above to find messages across every conversation in this project."
        />
      )}

      {!isLoading && searched && results.length === 0 && (
        <EmptyState
          icon={MessageCircle}
          title="No matches"
          description="No conversations contain that text. Try a different query or shorter keyword."
        />
      )}
    </WaPage>
  );
}

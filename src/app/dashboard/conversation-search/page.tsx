'use client';

/**
 * Wachat Conversation Search -- full-text search across conversations.
 */

import * as React from 'react';
import { useState, useTransition, useCallback } from 'react';
import { LuSearch, LuMessageCircle, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';
import { searchConversations } from '@/app/actions/wachat-features.actions';

export default function ConversationSearchPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
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
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Conversation Search' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Conversation Search</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Search across all conversations by message content.</p>
      </div>

      <div className="flex gap-3 max-w-xl">
        <div className="relative flex-1">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-clay-ink-muted" />
          <input type="text" value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search messages..."
            className="w-full rounded-lg border border-clay-border bg-clay-bg pl-10 pr-4 py-2.5 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none" />
        </div>
        <ClayButton variant="obsidian" size="sm" onClick={handleSearch} disabled={isLoading || !query.trim()}>
          {isLoading ? <LuLoader className="h-3.5 w-3.5 animate-spin" /> : 'Search'}
        </ClayButton>
      </div>

      {searched && !isLoading && (
        <p className="text-[12.5px] text-clay-ink-muted">{results.length} result{results.length !== 1 ? 's' : ''} found</p>
      )}

      {isLoading && (
        <div className="flex h-32 items-center justify-center">
          <LuLoader className="h-5 w-5 animate-spin text-clay-ink-muted" />
        </div>
      )}

      {!isLoading && results.length > 0 && (
        <div className="flex flex-col gap-3">
          {results.map((r: any) => (
            <a
              key={r._id}
              href={`/dashboard/chat?contactId=${r.contactId || ''}`}
              className="block transition-transform hover:-translate-y-0.5"
            >
              <ClayCard padded={false} className="p-4 hover:border-clay-border-strong">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-medium text-clay-ink">{r.contactName || r.contactId || r.from || 'Unknown'}</span>
                  <span className="text-[11px] text-clay-ink-muted whitespace-nowrap">
                    {r.timestamp ? new Date(r.timestamp).toLocaleString() : ''}
                  </span>
                </div>
                <p className="text-[13px] text-clay-ink-muted leading-relaxed">{r.content?.text || r.messageText || r.type || '--'}</p>
              </ClayCard>
            </a>
          ))}
        </div>
      )}

      {!isLoading && !searched && (
        <ClayCard className="p-12 text-center">
          <LuSearch className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">Start searching to see messages here.</p>
        </ClayCard>
      )}

      {!isLoading && searched && results.length === 0 && (
        <ClayCard className="p-12 text-center">
          <LuMessageCircle className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">No conversations match your search.</p>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}

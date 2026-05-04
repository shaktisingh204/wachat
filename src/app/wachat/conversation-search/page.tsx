'use client';

/**
 * /wachat/conversation-search — Full-text search across conversations,
 * rebuilt on ZoruUI primitives.
 */

import * as React from 'react';
import { useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { Search, MessageCircle, Loader2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useZoruToast } from '@/components/zoruui';
import { searchConversations } from '@/app/actions/wachat-features.actions';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruEmptyState,
} from '@/components/zoruui';

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
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
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
            <ZoruBreadcrumbPage>Conversation Search</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div>
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Conversation Search
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          Search across all conversations by message content.
        </p>
      </div>

      <div className="flex max-w-xl gap-3">
        <div className="flex-1">
          <ZoruInput
            leadingSlot={<Search />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search messages..."
          />
        </div>
        <ZoruButton
          size="sm"
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
        >
          {isLoading ? <Loader2 className="animate-spin" /> : <Search />}
          Search
        </ZoruButton>
      </div>

      {searched && !isLoading && (
        <p className="text-[12.5px] text-zoru-ink-muted">
          {results.length} result{results.length !== 1 ? 's' : ''} found
        </p>
      )}

      {isLoading && (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
        </div>
      )}

      {!isLoading && results.length > 0 && (
        <div className="flex flex-col gap-3">
          {results.map((r: any) => (
            <Link
              key={r._id}
              href={`/wachat/chat?contactId=${r.contactId || ''}`}
              className="block transition-transform hover:-translate-y-0.5"
            >
              <ZoruCard className="p-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[13px] text-zoru-ink">
                    {r.contactName || r.contactId || r.from || 'Unknown'}
                  </span>
                  <span className="whitespace-nowrap text-[11px] text-zoru-ink-muted">
                    {r.timestamp ? new Date(r.timestamp).toLocaleString() : ''}
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-zoru-ink-muted">
                  {r.content?.text || r.messageText || r.type || '--'}
                </p>
              </ZoruCard>
            </Link>
          ))}
        </div>
      )}

      {!isLoading && !searched && (
        <ZoruEmptyState
          icon={<Search />}
          title="Start searching"
          description="Type a query above to find messages across all conversations."
        />
      )}

      {!isLoading && searched && results.length === 0 && (
        <ZoruEmptyState
          icon={<MessageCircle />}
          title="No matches"
          description="No conversations match your search."
        />
      )}
      <div className="h-6" />
    </div>
  );
}

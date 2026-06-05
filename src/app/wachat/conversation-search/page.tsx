'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  Button,
  Card,
  Input,
  Field,
  EmptyState,
  Spinner,
} from '@/components/sabcrm/20ui';
import {
  useState,
  useTransition,
  useCallback } from 'react';
import Link from 'next/link';
import { Search,
  MessageCircle } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { searchConversations } from '@/app/actions/wachat-features.actions';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * /wachat/conversation-search — Full-text search across conversations,
 * rebuilt on 20ui primitives.
 */

import * as React from 'react';

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
        toast({ title: 'Error', description: res.error, tone: 'danger' });
        setResults([]);
      } else {
        setResults(res.messages || []);
      }
    });
  }, [query, projectId, toast]);

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Conversation Search' },
      ]}
      title="Conversation Search"
      description="Search across all conversations by message content."
    >
      <div className="flex max-w-xl gap-3">
        <div className="flex-1">
          <Field label="Search messages">
            <Input
              iconLeft={Search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search messages..."
            />
          </Field>
        </div>
        <Button
          variant="primary"
          size="sm"
          iconLeft={Search}
          loading={isLoading}
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          className="self-end"
        >
          Search
        </Button>
      </div>

      {searched && !isLoading && (
        <p className="text-[12.5px]" style={{ color: 'var(--st-text-tertiary)' }}>
          {results.length} result{results.length !== 1 ? 's' : ''} found
        </p>
      )}

      {isLoading && (
        <div className="flex h-32 items-center justify-center">
          <Spinner size="md" label="Searching conversations" />
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
              <Card variant="interactive" padding="md">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[13px]" style={{ color: 'var(--st-text)' }}>
                    {r.contactName || r.contactId || r.from || 'Unknown'}
                  </span>
                  <span className="whitespace-nowrap text-[11px]" style={{ color: 'var(--st-text-tertiary)' }}>
                    {r.timestamp ? fmtDate(r.timestamp) : ''}
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--st-text-secondary)' }}>
                  {r.content?.text || r.messageText || r.type || '--'}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!isLoading && !searched && (
        <EmptyState
          icon={Search}
          title="Start searching"
          description="Type a query above to find messages across all conversations."
        />
      )}

      {!isLoading && searched && results.length === 0 && (
        <EmptyState
          icon={MessageCircle}
          title="No matches"
          description="No conversations match your search."
        />
      )}
    </WachatPage>
  );
}

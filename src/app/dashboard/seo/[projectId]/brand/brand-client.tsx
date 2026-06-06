'use client';

import { useQuery } from '@tanstack/react-query';
import { Button, Card, ZoruCardContent, ZoruCardDescription, ZoruCardHeader, ZoruCardTitle, Badge, Skeleton } from '@/components/sabcrm/20ui/compat';
import { Radar, RefreshCw, Link2, Unlink } from 'lucide-react';
import { AlertsDialog } from './alerts-dialog';
import { useEffect, useState } from 'react';

import { fetchRealBrandMentions, fetchRealBrandSentiment } from './actions';

export function BrandDashboardClient({ projectId }: { projectId: string }) {
  const { data: mentions, isLoading: mentionsLoading, refetch: refetchMentions, isFetching: mentionsFetching } = useQuery({
    queryKey: ['brand-mentions', projectId],
    queryFn: () => fetchRealBrandMentions(projectId),
  });

  const { data: sentiment, isLoading: sentimentLoading, refetch: refetchSentiment } = useQuery({
    queryKey: ['brand-sentiment', projectId],
    queryFn: () => fetchRealBrandSentiment(projectId),
  });

  const handleRefresh = () => {
    refetchMentions();
    refetchSentiment();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-[var(--st-text)] flex items-center gap-3">
            <Radar className="h-8 w-8 text-[var(--st-text)]" />
            Brand Radar
          </h1>
          <p className="text-[var(--st-text-secondary)] mt-1">Monitor sentiment and unlinked mentions across social media and the web.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={mentionsFetching}>
            <RefreshCw className={`h-4 w-4 ${mentionsFetching ? 'animate-spin' : ''}`} />
          </Button>
          <AlertsDialog projectId={projectId} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Sentiment Score</ZoruCardTitle>
            <ZoruCardDescription>AI Analysis of last 100 mentions</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            {sentimentLoading ? (
              <Skeleton className="h-10 w-24 mb-1" />
            ) : (
              <>
                <div className="text-4xl text-[var(--st-status-ok)]">{sentiment?.positiveSentiment}</div>
                <p className="text-sm text-[var(--st-text-secondary)] mt-1">Positive Sentiment</p>
              </>
            )}
          </ZoruCardContent>
        </Card>
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>New Mentions</ZoruCardTitle>
            <ZoruCardDescription>Last 7 Days</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            {sentimentLoading ? (
              <Skeleton className="h-10 w-24 mb-1" />
            ) : (
              <>
                <div className="text-4xl text-[var(--st-text)]">{sentiment?.newMentions}</div>
                <p className="text-sm text-[var(--st-text-secondary)] mt-1">{sentiment?.mentionsDiff} from previous week</p>
              </>
            )}
          </ZoruCardContent>
        </Card>
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Share of Voice</ZoruCardTitle>
            <ZoruCardDescription>vs Competitors</ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            {sentimentLoading ? (
              <Skeleton className="h-10 w-24 mb-1" />
            ) : (
              <>
                <div className="text-4xl text-[var(--st-text)]">{sentiment?.shareOfVoice}</div>
                <p className="text-sm text-[var(--st-text-secondary)] mt-1">{sentiment?.rankText}</p>
              </>
            )}
          </ZoruCardContent>
        </Card>
      </div>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Recent Mentions (Social Listening)</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {mentionsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              {mentions?.map((m: { id: string; title: string; source: string; unlinked: boolean; date: string; sentiment: string; url?: string; }) => (
                <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-[var(--zoru-radius)] border border-[var(--st-border)] p-4 gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-[var(--st-text)] font-medium">{m.title}</h4>
                      {m.unlinked ? (
                        <Badge variant="outline" className="text-[var(--st-warn)] border-[var(--st-warn)]/30 bg-[var(--st-warn)]/10 text-[10px] py-0">
                          <Unlink className="h-3 w-3 mr-1" /> Unlinked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[var(--st-status-ok)] border-[var(--st-status-ok)]/30 bg-[var(--st-status-ok)]/10 text-[10px] py-0">
                          <Link2 className="h-3 w-3 mr-1" /> Linked
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-[var(--st-text-secondary)] font-medium">{m.source}</p>
                      <span className="text-[var(--st-text-secondary)]/50 text-xs">•</span>
                      <p className="text-xs text-[var(--st-text-secondary)]">{new Date(m.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded text-xs uppercase font-medium ${
                        m.sentiment === 'positive'
                          ? 'bg-[var(--st-status-ok)]/10 text-[var(--st-status-ok)]'
                          : m.sentiment === 'negative'
                            ? 'bg-[var(--st-danger)]/10 text-[var(--st-danger)]'
                            : 'bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]'
                      }`}
                    >
                      {m.sentiment}
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <a href={m.url || '#'} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ZoruCardContent>
      </Card>
    </div>
  );
}

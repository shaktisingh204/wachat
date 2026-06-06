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
          <h1 className="text-3xl text-zoru-ink flex items-center gap-3">
            <Radar className="h-8 w-8 text-zoru-ink" />
            Brand Radar
          </h1>
          <p className="text-zoru-ink-muted mt-1">Monitor sentiment and unlinked mentions across social media and the web.</p>
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
                <div className="text-4xl text-zoru-success">{sentiment?.positiveSentiment}</div>
                <p className="text-sm text-zoru-ink-muted mt-1">Positive Sentiment</p>
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
                <div className="text-4xl text-zoru-ink">{sentiment?.newMentions}</div>
                <p className="text-sm text-zoru-ink-muted mt-1">{sentiment?.mentionsDiff} from previous week</p>
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
                <div className="text-4xl text-zoru-ink">{sentiment?.shareOfVoice}</div>
                <p className="text-sm text-zoru-ink-muted mt-1">{sentiment?.rankText}</p>
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
                <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-[var(--zoru-radius)] border border-zoru-line p-4 gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-zoru-ink font-medium">{m.title}</h4>
                      {m.unlinked ? (
                        <Badge variant="outline" className="text-zoru-warning border-zoru-warning/30 bg-zoru-warning/10 text-[10px] py-0">
                          <Unlink className="h-3 w-3 mr-1" /> Unlinked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-zoru-success border-zoru-success/30 bg-zoru-success/10 text-[10px] py-0">
                          <Link2 className="h-3 w-3 mr-1" /> Linked
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-zoru-ink-muted font-medium">{m.source}</p>
                      <span className="text-zoru-ink-muted/50 text-xs">•</span>
                      <p className="text-xs text-zoru-ink-muted">{new Date(m.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded text-xs uppercase font-medium ${
                        m.sentiment === 'positive'
                          ? 'bg-zoru-success/10 text-zoru-success'
                          : m.sentiment === 'negative'
                            ? 'bg-zoru-danger/10 text-zoru-danger-ink'
                            : 'bg-zoru-surface-2 text-zoru-ink-muted'
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

'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { Users, LoaderCircle, RefreshCw, MessageSquare } from 'lucide-react';
import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getLiveVisitors } from '@/app/actions/sabchat.actions';
import type { WithId, SabChatSession } from '@/lib/definitions';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

function PageSkeleton() {
  return (
    <ClayCard>
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg bg-border" style={{ height: '3rem' }} />
        ))}
      </div>
    </ClayCard>
  );
}

export default function SabChatVisitorsPage() {
  const [visitors, setVisitors] = useState<WithId<SabChatSession>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const { toast } = useToast();

  const fetchData = useCallback((showToast = false) => {
    startLoading(async () => {
      try {
        const data = await getLiveVisitors();
        setVisitors(data);
        if (showToast) {
          toast({ title: 'Refreshed', description: 'Visitor list has been updated.' });
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to fetch live visitors.', variant: 'destructive' });
      }
    });
  }, [toast]);

  useEffect(() => {
    fetchData(); // Initial fetch
    const intervalId = setInterval(() => fetchData(), 10000); // Poll every 10 seconds
    return () => clearInterval(intervalId);
  }, [fetchData]);

  if (isLoading && visitors.length === 0) {
    return (
      <div className="flex w-full flex-col gap-6">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Live Visitors"
        subtitle="Real-time visitors currently on your website"
        icon={Users}
        actions={
          <ClayButton
            variant="pill"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={isLoading}
            leading={
              isLoading
                ? <LoaderCircle className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />
            }
          >
            Refresh
          </ClayButton>
        }
      />

      <ClayCard>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border bg-secondary">
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">Visitor</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">Last Seen</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">Location</th>
                <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {visitors.length > 0 ? (
                visitors.map(visitor => {
                  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                  const isOnline = new Date(visitor.updatedAt) > fiveMinutesAgo;
                  const name = visitor.visitorInfo?.name || 'Visitor';
                  const email = visitor.visitorInfo?.email;

                  return (
                    <tr key={visitor._id.toString()} className="border-b border-border last:border-0 hover:bg-secondary/50">
                      <td className="px-4 py-2.5 text-[13px] text-foreground">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{name}</span>
                          {email && <span className="text-[12px] text-muted-foreground">{email}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-foreground">
                        <ClayBadge tone={isOnline ? 'green' : 'neutral'} dot>
                          {isOnline ? 'Online' : 'Offline'}
                        </ClayBadge>
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-foreground">
                        {formatDistanceToNow(new Date(visitor.updatedAt), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-foreground">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-[12px] text-foreground">{visitor.visitorInfo?.ip}</span>
                          <span className="max-w-[200px] truncate text-[12px] text-muted-foreground" title={visitor.visitorInfo?.page}>
                            {visitor.visitorInfo?.page}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-foreground">
                        <a href={`/dashboard/sabchat/inbox?sessionId=${visitor._id.toString()}`}>
                          <ClayButton
                            variant="obsidian"
                            size="sm"
                            leading={<MessageSquare className="h-4 w-4" />}
                          >
                            Chat
                          </ClayButton>
                        </a>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-2.5 text-[13px] text-muted-foreground h-24 text-center">
                    No live visitors right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ClayCard>
    </div>
  );
}

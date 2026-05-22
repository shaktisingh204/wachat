'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import {
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
} from '@/components/zoruui';
import { EmailSuiteLayout } from '@/components/email/layout';
import {
  EmailAccountList,
  EmailActivityFeed,
  EmailKpiStrip,
  EmailQuickActions,
} from '@/components/email/overview';
import {
  getEmailCampaigns,
  getEmailSettings,
  getEmailStats,
} from '@/app/actions/email.actions';
import type { EmailCampaign, EmailSettings, WithId } from '@/lib/definitions';

function OverviewContent() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get('accountId') ?? undefined;

  const [accounts, setAccounts] = useState<WithId<EmailSettings>[]>([]);
  const [recentCampaigns, setRecentCampaigns] = useState<WithId<EmailCampaign>[]>([]);
  const [stats, setStats] = useState({ sent: 0, opened: 0, clicks: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      const settingsData = await getEmailSettings();
      if (cancelled) return;
      setAccounts(settingsData);

      if (accountId) {
        const current = settingsData.find((s) => s._id.toString() === accountId);
        const fromEmail = current?.fromEmail;
        const [campaigns, realStats] = await Promise.all([
          getEmailCampaigns(fromEmail),
          getEmailStats(accountId),
        ]);
        if (cancelled) return;
        setRecentCampaigns(campaigns.slice(0, 6));
        setStats(realStats);
      } else {
        setRecentCampaigns([]);
        setStats({ sent: 0, opened: 0, clicks: 0 });
      }

      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ZoruSkeleton className="h-28" />
          <ZoruSkeleton className="h-28" />
          <ZoruSkeleton className="h-28" />
          <ZoruSkeleton className="h-28" />
        </div>
        <ZoruSkeleton className="h-96" />
      </div>
    );
  }

  if (!accountId) {
    return <EmailAccountList accounts={accounts} />;
  }

  const openRate = stats.sent > 0 ? (stats.opened / stats.sent) * 100 : undefined;
  const clickRate = stats.sent > 0 ? (stats.clicks / stats.sent) * 100 : undefined;

  return (
    <div className="flex flex-col gap-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-3">
              <BarChart3 className="h-6 w-6" /> Overview
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Performance summary for this account.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <EmailKpiStrip
        sent={stats.sent}
        openRate={openRate}
        clickRate={clickRate}
        revenue={undefined}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EmailActivityFeed campaigns={recentCampaigns} accountId={accountId} />
        </div>
        <div>
          <EmailQuickActions accountId={accountId} />
        </div>
      </div>
    </div>
  );
}

export default function EmailDashboardPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<ZoruSkeleton className="h-full w-full" />}>
        <OverviewContent />
      </Suspense>
    </EmailSuiteLayout>
  );
}

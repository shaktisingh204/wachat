'use client';

/**
 * Per-campaign analytics. Opens, clicks (CTR), bounces, unsubscribes,
 * and a deal-conversion slot (wired when a campaign is linked to a CRM
 * deal pipeline via the `campaign.conversionPipelineId` field).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, MousePointerClick, Mailbox, UserMinus, Inbox, Activity } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Separator,
  Skeleton,
  StatCard,
} from '@/components/sabcrm/20ui';
import {
  actionGetEmailCampaign,
  actionGetEmailCampaignReport,
  type EmailCampaignDoc,
} from '@/app/actions/email/campaigns.actions';

interface ReportData {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
}

const ZERO: ReportData = {
  sent: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  bounced: 0,
  complained: 0,
  unsubscribed: 0,
};

function pct(num: number, denom: number) {
  if (!denom) return '0.0%';
  return `${((num / denom) * 100).toFixed(1)}%`;
}

export function CampaignAnalyticsClient({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<EmailCampaignDoc | null>(null);
  const [report, setReport] = useState<ReportData>(ZERO);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [c, r] = await Promise.all([
        actionGetEmailCampaign(campaignId),
        actionGetEmailCampaignReport(campaignId),
      ]);
      if (cancelled) return;
      if (!c.ok) {
        setError(c.error);
      } else {
        setCampaign(c.data);
      }
      if (r.ok) {
        setReport({ ...ZERO, ...r.data });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (error || !campaign) {
    return (
      <EmptyState
        icon={Inbox}
        title="Campaign not found"
        description={error ?? 'No campaign matched that id.'}
        action={
          <Button variant="outline" iconLeft={ArrowLeft} onClick={() => router.push('/dashboard/email/campaigns')}>
            Back to campaigns
          </Button>
        }
      />
    );
  }

  const deliveryRate = pct(report.delivered, report.sent);
  const openRate = pct(report.opened, report.delivered);
  const clickRate = pct(report.clicked, report.delivered);
  const ctr = pct(report.clicked, report.opened);
  const bounceRate = pct(report.bounced, report.sent);
  const unsubRate = pct(report.unsubscribed, report.delivered);

  return (
    <div className="ui20 space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>{campaign.name}</PageTitle>
          <PageDescription>
            <Badge variant="outline">{campaign.type}</Badge>{' '}
            <Badge variant="secondary">{campaign.status}</Badge>{' '}
            Subject: {campaign.subject}
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button
            variant="outline"
            iconLeft={ArrowLeft}
            onClick={() => router.push('/dashboard/email/campaigns')}
          >
            Back to campaigns
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Sent" value={report.sent.toLocaleString()} icon={Inbox} />
        <StatCard
          label="Delivered"
          value={`${report.delivered.toLocaleString()} (${deliveryRate})`}
          icon={Mailbox}
        />
        <StatCard
          label="Opens"
          value={`${report.opened.toLocaleString()} (${openRate})`}
          icon={Eye}
        />
        <StatCard
          label="Clicks"
          value={`${report.clicked.toLocaleString()} (${clickRate})`}
          icon={MousePointerClick}
        />
        <StatCard label="CTR (click/open)" value={ctr} icon={Activity} />
        <StatCard
          label="Bounces"
          value={`${report.bounced.toLocaleString()} (${bounceRate})`}
        />
        <StatCard
          label="Unsubscribes"
          value={`${report.unsubscribed.toLocaleString()} (${unsubRate})`}
          icon={UserMinus}
        />
        <StatCard label="Complaints" value={report.complained.toLocaleString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conversion</CardTitle>
          <CardDescription>
            Conversion is recorded against any CRM deal whose contact engaged with this campaign and
            subsequently advanced through the linked pipeline. Link a pipeline on the campaign
            settings to start tracking attribution.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardBody>
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/email/campaigns/${campaign._id}`)}
          >
            Open campaign settings
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event stream</CardTitle>
          <CardDescription>
            Live time-series of opens, clicks, bounces, and unsubscribes from the email-events crate
            surfaces here. (Component pending. The backend already emits to email_events.)
          </CardDescription>
        </CardHeader>
        <Separator />
      </Card>
    </div>
  );
}

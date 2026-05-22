import {
  Button,
  Card,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
} from '@/components/zoruui';
import {
  getShortUrlById,
  getShortUrlAnalyticsTimeline,
  getShortUrlAnalyticsGeo,
  getShortUrlAnalyticsDevices,
  getShortUrlAnalyticsReferrers,
  getCustomDomains,
} from '@/app/actions/url-shortener.actions';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart2,
  Calendar,
  Clock,
  ExternalLink,
  Link as LinkIcon,
  Settings,
} from 'lucide-react';
import type { ShortUrl } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { AnalyticsSummaryCards } from '@/components/wabasimplify/analytics-summary-cards';
import { ClickTimelineChart } from '@/components/wabasimplify/click-timeline-chart';
import { GeoHeatmap } from '@/components/wabasimplify/geo-heatmap';
import { DeviceBreakdownChart } from '@/components/wabasimplify/device-breakdown-chart';
import { ReferrerTable } from '@/components/wabasimplify/referrer-table';
import { AnalyticsTabsShell } from '@/components/wabasimplify/analytics-tabs-shell';
import { EditLinkDrawer } from '@/components/wabasimplify/edit-link-drawer';
import { LinkHistoryDrawer } from '@/components/wabasimplify/link-history-drawer';
import { SharePermissionsModal } from '@/components/wabasimplify/share-permissions-modal';

export const dynamic = 'force-dynamic';

function getShortUrlString(shortUrlDoc: WithId<ShortUrl>, domains: { _id: { toString(): string }; hostname: string }[]): string {
  if (shortUrlDoc.domainId) {
    const domain = domains.find((d) => d._id.toString() === shortUrlDoc.domainId);
    if (domain) return `https://${domain.hostname}/${shortUrlDoc.shortCode}`;
  }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
  return `${baseUrl}/s/${shortUrlDoc.shortCode}`;
}

function getStatus(shortUrl: WithId<ShortUrl>): 'active' | 'expired' | 'scheduled' {
  if (shortUrl.status === 'scheduled' || shortUrl.activateAt) {
    const now = Date.now();
    const activate = shortUrl.activateAt ? new Date(shortUrl.activateAt).getTime() : 0;
    if (activate > now) return 'scheduled';
  }
  if (shortUrl.expiresAt && new Date(shortUrl.expiresAt).getTime() < Date.now()) return 'expired';
  return 'active';
}

function computeUnique(shortUrl: WithId<ShortUrl>): number {
  const ips = new Set(shortUrl.analytics.map((a) => a.ip).filter(Boolean));
  return ips.size;
}

function computeClicksToday(shortUrl: WithId<ShortUrl>): number {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return shortUrl.analytics.filter((a) => new Date(a.timestamp) >= todayStart).length;
}

export default async function ShortUrlAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [shortUrl, timeline, geo, devices, referrers, domains] = await Promise.all([
    getShortUrlById(id),
    getShortUrlAnalyticsTimeline(id, 30),
    getShortUrlAnalyticsGeo(id),
    getShortUrlAnalyticsDevices(id),
    getShortUrlAnalyticsReferrers(id),
    getCustomDomains(),
  ]);

  if (!shortUrl) {
    return (
      <div className="flex min-h-full flex-col gap-6">
        <Card className="p-10 text-center">
          <LinkIcon className="mx-auto h-10 w-10 text-zoru-ink-muted/40 mb-4" />
          <h3 className="text-sm text-zoru-ink mb-1">Link not found</h3>
          <p className="text-xs text-zoru-ink-muted mb-4">This short link does not exist or you do not have access to it.</p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/url-shortener">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to All Links
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  const shortUrlString = getShortUrlString(shortUrl, domains);
  const status = getStatus(shortUrl);
  const uniqueClicks = computeUnique(shortUrl);
  const clicksToday = computeClicksToday(shortUrl);
  const topCountry = geo[0]?.country ?? null;
  const totalReferrerClicks = referrers.reduce((s, r) => s + r.count, 0);

  const statusStyles = {
    active: 'border-zoru-success/40 bg-zoru-success/10 text-zoru-success-ink',
    expired: 'border-zoru-danger/40 bg-zoru-danger/10 text-zoru-danger-ink',
    scheduled: 'border-zoru-warning/40 bg-zoru-warning/10 text-zoru-warning-ink',
  } as const;

  return (
    <div className="flex min-h-full flex-col gap-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">Home</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/url-shortener">URL Shortener</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>{shortUrl.shortCode}</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <BarChart2 className="h-5 w-5 text-zoru-ink-muted shrink-0" />
              <h1 className="text-[18px] text-zoru-ink font-medium leading-tight break-all">
                {shortUrl.customSlug || shortUrl.shortCode}
              </h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] ${statusStyles[status]}`}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                {status[0].toUpperCase() + status.slice(1)}
              </span>
            </div>

            <a
              href={shortUrlString}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] text-zoru-ink-muted hover:text-zoru-ink break-all"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              {shortUrlString}
            </a>

            <p className="mt-1.5 text-[12px] text-zoru-ink-muted truncate max-w-lg">
              {shortUrl.originalUrl}
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-2 text-[11.5px] text-zoru-ink-muted">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Created {new Date(shortUrl.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
              {shortUrl.expiresAt && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Expires {new Date(shortUrl.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <SharePermissionsModal
              resourceType="url"
              resourceId={shortUrl._id.toString()}
              resourceName={shortUrl.shortCode}
            />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/url-shortener">
                <ArrowLeft className="h-3.5 w-3.5" />
                All Links
              </Link>
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <AnalyticsSummaryCards
        totalClicks={shortUrl.clickCount}
        uniqueClicks={uniqueClicks}
        clicksToday={clicksToday}
        topCountry={topCountry}
      />

      {/* Tabbed Content — client shell handles tab switching */}
      <AnalyticsTabsShell
        overviewSlot={<ClickTimelineChart data={timeline} />}
        audienceSlot={
          <div className="grid lg:grid-cols-2 gap-4">
            <DeviceBreakdownChart data={devices} />
            <div className="flex flex-col gap-4">
              <GeoHeatmap data={geo} />
              <ReferrerTable data={referrers} total={totalReferrerClicks} />
            </div>
          </div>
        }
        settingsSlot={
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-zoru-ink-muted" />
                <span className="text-[13px] text-zoru-ink">Link Details</span>
              </div>
              <div className="flex items-center gap-2">
                <LinkHistoryDrawer
                  linkId={shortUrl._id.toString()}
                  currentUrl={shortUrl.originalUrl}
                />
                <EditLinkDrawer shortUrl={shortUrl} />
              </div>
            </div>
            <dl className="space-y-3 text-[13px]">
              <div className="grid grid-cols-[160px_1fr] gap-2">
                <dt className="text-zoru-ink-muted">Short Code</dt>
                <dd className="text-zoru-ink font-mono">{shortUrl.shortCode}</dd>
              </div>
              {shortUrl.customSlug && (
                <div className="grid grid-cols-[160px_1fr] gap-2">
                  <dt className="text-zoru-ink-muted">Custom Alias</dt>
                  <dd className="text-zoru-ink font-mono">{shortUrl.customSlug}</dd>
                </div>
              )}
              <div className="grid grid-cols-[160px_1fr] gap-2">
                <dt className="text-zoru-ink-muted">Destination URL</dt>
                <dd className="text-zoru-ink break-all">{shortUrl.originalUrl}</dd>
              </div>
              <div className="grid grid-cols-[160px_1fr] gap-2">
                <dt className="text-zoru-ink-muted">Status</dt>
                <dd className="text-zoru-ink capitalize">{status}</dd>
              </div>
              <div className="grid grid-cols-[160px_1fr] gap-2">
                <dt className="text-zoru-ink-muted">Created</dt>
                <dd className="text-zoru-ink">{new Date(shortUrl.createdAt).toLocaleString()}</dd>
              </div>
              <div className="grid grid-cols-[160px_1fr] gap-2">
                <dt className="text-zoru-ink-muted">Expires</dt>
                <dd className="text-zoru-ink">{shortUrl.expiresAt ? new Date(shortUrl.expiresAt).toLocaleString() : 'Never'}</dd>
              </div>
              {shortUrl.clickLimit && (
                <div className="grid grid-cols-[160px_1fr] gap-2">
                  <dt className="text-zoru-ink-muted">Click Limit</dt>
                  <dd className="text-zoru-ink">{shortUrl.clickLimit.toLocaleString()}</dd>
                </div>
              )}
              {shortUrl.utmParams && Object.values(shortUrl.utmParams).some(Boolean) && (
                <>
                  <div className="pt-2 border-t border-zoru-line">
                    <p className="text-[11px] uppercase tracking-wider text-zoru-ink-muted mb-2">UTM Parameters</p>
                  </div>
                  {shortUrl.utmParams.source && (
                    <div className="grid grid-cols-[160px_1fr] gap-2">
                      <dt className="text-zoru-ink-muted">UTM Source</dt>
                      <dd className="text-zoru-ink font-mono">{shortUrl.utmParams.source}</dd>
                    </div>
                  )}
                  {shortUrl.utmParams.medium && (
                    <div className="grid grid-cols-[160px_1fr] gap-2">
                      <dt className="text-zoru-ink-muted">UTM Medium</dt>
                      <dd className="text-zoru-ink font-mono">{shortUrl.utmParams.medium}</dd>
                    </div>
                  )}
                  {shortUrl.utmParams.campaign && (
                    <div className="grid grid-cols-[160px_1fr] gap-2">
                      <dt className="text-zoru-ink-muted">UTM Campaign</dt>
                      <dd className="text-zoru-ink font-mono">{shortUrl.utmParams.campaign}</dd>
                    </div>
                  )}
                  {shortUrl.utmParams.term && (
                    <div className="grid grid-cols-[160px_1fr] gap-2">
                      <dt className="text-zoru-ink-muted">UTM Term</dt>
                      <dd className="text-zoru-ink font-mono">{shortUrl.utmParams.term}</dd>
                    </div>
                  )}
                  {shortUrl.utmParams.content && (
                    <div className="grid grid-cols-[160px_1fr] gap-2">
                      <dt className="text-zoru-ink-muted">UTM Content</dt>
                      <dd className="text-zoru-ink font-mono">{shortUrl.utmParams.content}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>
          </Card>
        }
      />
    </div>
  );
}

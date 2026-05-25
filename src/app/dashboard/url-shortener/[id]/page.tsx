import {
  Button,
  Card,
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
  Link as LinkIcon,
  AlertTriangle,
} from 'lucide-react';
import type { ShortUrl } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { AnalyticsSummaryCards } from '@/components/wabasimplify/analytics-summary-cards';
import { ClickTimelineChart } from '@/components/wabasimplify/click-timeline-chart';
import { GeoHeatmap } from '@/components/wabasimplify/geo-heatmap';
import { DeviceBreakdownChart } from '@/components/wabasimplify/device-breakdown-chart';
import { ReferrerTable } from '@/components/wabasimplify/referrer-table';
import { AnalyticsTabsShell } from '@/components/wabasimplify/analytics-tabs-shell';
import { ShortUrlHeader } from './components/short-url-header';
import { ShortUrlSettings } from './components/short-url-settings';
import { GeoAnalyticsTable } from './components/geo-analytics-table';

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
  const ips = new Set(shortUrl.analytics?.map((a) => a.ip).filter(Boolean) || []);
  return ips.size;
}

function computeClicksToday(shortUrl: WithId<ShortUrl>): number {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return (shortUrl.analytics || []).filter((a) => new Date(a.timestamp) >= todayStart).length;
}

export type AnalyticsTimelineResponse = { date: string; count: number }[];
export type AnalyticsGeoResponse = { country: string; count: number }[];
export type AnalyticsReferrersResponse = { domain: string; count: number }[];
export type AnalyticsDevicesResponse = {
  deviceTypes: { type: string; count: number }[];
  browsers: { browser: string; count: number }[];
  os: { os: string; count: number }[];
} | null;
export type CustomDomainResponse = { _id: { toString(): string }; hostname: string }[];

export default async function ShortUrlAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let apiResults: [
    WithId<ShortUrl> | null,
    AnalyticsTimelineResponse,
    AnalyticsGeoResponse,
    AnalyticsDevicesResponse,
    AnalyticsReferrersResponse,
    CustomDomainResponse
  ];
  
  try {
    apiResults = await Promise.all([
      getShortUrlById(id),
      getShortUrlAnalyticsTimeline(id, 30),
      getShortUrlAnalyticsGeo(id),
      getShortUrlAnalyticsDevices(id) as Promise<AnalyticsDevicesResponse>,
      getShortUrlAnalyticsReferrers(id),
      getCustomDomains(),
    ]);
  } catch (error) {
    console.error('Failed to fetch short url analytics:', error);
    return (
      <div className="flex min-h-full flex-col gap-6">
        <Card className="p-10 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-zoru-danger mb-4" />
          <h3 className="text-sm text-zoru-ink mb-1">Failed to load data</h3>
          <p className="text-xs text-zoru-ink-muted mb-4">An error occurred while fetching the short URL data. Please try again later.</p>
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

  const [shortUrl, timeline, geo, devices, referrers, domains] = apiResults;

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
  const topCountry = geo?.[0]?.country ?? null;
  const totalReferrerClicks = referrers?.reduce((s, r) => s + r.count, 0) || 0;

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
      <ShortUrlHeader
        shortUrl={shortUrl}
        shortUrlString={shortUrlString}
        status={status}
      />

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GeoAnalyticsTable data={geo} />
                <ReferrerTable data={referrers} total={totalReferrerClicks} />
              </div>
            </div>
          </div>
        }
        settingsSlot={
          <ShortUrlSettings
            shortUrl={shortUrl}
            status={status}
          />
        }
      />
    </div>
  );
}

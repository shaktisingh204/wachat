'use client';

import {
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Card,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';
import {
  BarChart3,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock,
  ImageIcon,
  Map as MapIcon,
  Megaphone,
  MessageSquare,
  Rocket,
  ShoppingBag,
  Sparkles,
  Target,
  Workflow,
  } from 'lucide-react';

/**
 * /dashboard/facebook/roadmap — Meta Suite product roadmap (ZoruUI).
 *
 * Replaces the legacy redirect-only stub. Renders a status-grouped grid
 * of Card tiles. Status is communicated via Badge using ONLY
 * neutral / success / info / ghost variants (no rainbow accents).
 *
 * Data is local + static — this is product-marketing content, not user
 * data, so there's no server action behind it. Updating this list does
 * not require a backend change.
 */

import * as React from 'react';

type RoadmapStatus = 'shipped' | 'in_progress' | 'planned';

const STATUS_LABELS: Record<RoadmapStatus, string> = {
  shipped: 'Shipped',
  in_progress: 'In progress',
  planned: 'Planned',
};

const STATUS_BADGE: Record<
  RoadmapStatus,
  'success' | 'info' | 'ghost'
> = {
  shipped: 'success',
  in_progress: 'info',
  planned: 'ghost',
};

const STATUS_ICON: Record<
  RoadmapStatus,
  React.ComponentType<{ className?: string }>
> = {
  shipped: CheckCircle2,
  in_progress: Sparkles,
  planned: Clock,
};

interface RoadmapItem {
  title: string;
  description: string;
  status: RoadmapStatus;
  area: string;
  icon: React.ComponentType<{ className?: string }>;
  eta?: string;
}

const ROADMAP: RoadmapItem[] = [
  {
    title: 'Page posting',
    description:
      'Publish text, image, video and link posts to a Facebook Page.',
    status: 'shipped',
    area: 'Publishing',
    icon: Megaphone,
  },
  {
    title: 'Scheduled publishing',
    description:
      'Queue posts for future publication and manage the scheduled queue.',
    status: 'shipped',
    area: 'Publishing',
    icon: CalendarClock,
  },
  {
    title: 'Messenger inbox',
    description:
      'Read and reply to Messenger conversations with assignment + status.',
    status: 'shipped',
    area: 'Engagement',
    icon: MessageSquare,
  },
  {
    title: 'Lead-gen forms',
    description:
      'Sync lead-gen submissions and export them as CSV per form.',
    status: 'shipped',
    area: 'Marketing',
    icon: Target,
  },
  {
    title: 'Auto-reply rules',
    description:
      'Trigger auto-replies on incoming Messenger events with token-aware templates.',
    status: 'in_progress',
    area: 'Automation',
    icon: Bot,
    eta: 'This sprint',
  },
  {
    title: 'Visual flow builder',
    description:
      'Drag-and-drop builder for branching Messenger automations.',
    status: 'in_progress',
    area: 'Automation',
    icon: Workflow,
    eta: 'Next sprint',
  },
  {
    title: 'Insights dashboard',
    description:
      'Account-wide analytics with greyscale charts and export.',
    status: 'in_progress',
    area: 'Analytics',
    icon: BarChart3,
    eta: 'Next sprint',
  },
  {
    title: 'Media manager',
    description:
      'Unified library for photos, albums, videos and playlists with bulk upload.',
    status: 'planned',
    area: 'Library',
    icon: ImageIcon,
  },
  {
    title: 'Custom storefronts',
    description:
      'Conversational storefronts attached directly to a Page.',
    status: 'planned',
    area: 'Commerce',
    icon: ShoppingBag,
  },
  {
    title: 'Competitor tracking',
    description:
      'Side-by-side analytics for competing Pages with exportable diffs.',
    status: 'planned',
    area: 'Analytics',
    icon: MapIcon,
  },
  {
    title: 'Live broadcast launcher',
    description:
      'Pre-broadcast checklist + RTMP stream launcher inside SabNode.',
    status: 'planned',
    area: 'Publishing',
    icon: Rocket,
  },
];

const STATUS_ORDER: RoadmapStatus[] = ['shipped', 'in_progress', 'planned'];

export default function FacebookRoadmapPage() {
  const grouped = React.useMemo(() => {
    const map: Record<RoadmapStatus, RoadmapItem[]> = {
      shipped: [],
      in_progress: [],
      planned: [],
    };
    for (const item of ROADMAP) {
      map[item.status].push(item);
    }
    return map;
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      {/* Breadcrumb */}
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Roadmap</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      {/* Page header */}
      <ZoruPageHeader className="mt-4">
        <ZoruPageHeading>
          <ZoruPageEyebrow>Meta Suite · What&apos;s next</ZoruPageEyebrow>
          <ZoruPageTitle>Roadmap</ZoruPageTitle>
          <ZoruPageDescription>
            Public view of what&apos;s shipped, what&apos;s in flight and
            what&apos;s coming next for the Meta Suite. Subject to change.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      {/* Stat strip */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STATUS_ORDER.map((status) => {
          const Icon = STATUS_ICON[status];
          return (
            <div
              key={status}
              className="rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-4"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink [&_svg]:size-4">
                  <Icon />
                </span>
                <ZoruBadge variant={STATUS_BADGE[status]}>
                  {STATUS_LABELS[status]}
                </ZoruBadge>
              </div>
              <p className="mt-3 text-[22px] tracking-tight text-zoru-ink leading-none">
                {grouped[status].length}
              </p>
              <p className="mt-1 text-[12px] text-zoru-ink-muted">
                {STATUS_LABELS[status].toLowerCase()} item
                {grouped[status].length === 1 ? '' : 's'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Status-grouped grids */}
      <div className="mt-10 flex flex-col gap-10">
        {STATUS_ORDER.map((status) => {
          const items = grouped[status];
          if (items.length === 0) return null;
          const Icon = STATUS_ICON[status];
          return (
            <section key={status}>
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-[18px] tracking-tight text-zoru-ink leading-none">
                    <Icon className="h-4 w-4 text-zoru-ink-muted" />
                    {STATUS_LABELS[status]}
                  </h2>
                  <p className="mt-1.5 text-[12.5px] text-zoru-ink-muted">
                    {items.length} item{items.length === 1 ? '' : 's'}
                  </p>
                </div>
                <ZoruBadge variant={STATUS_BADGE[status]}>
                  {STATUS_LABELS[status]}
                </ZoruBadge>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <ZoruCard
                      key={item.title}
                      className="flex flex-col gap-3 p-5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-surface-2 text-zoru-ink [&_svg]:size-4">
                          <ItemIcon />
                        </span>
                        <ZoruBadge variant={STATUS_BADGE[item.status]}>
                          {STATUS_LABELS[item.status]}
                        </ZoruBadge>
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-[11px] uppercase tracking-wide text-zoru-ink-subtle">
                          {item.area}
                        </p>
                        <p className="text-[15px] text-zoru-ink leading-tight">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                      {item.eta && (
                        <p className="mt-1 inline-flex items-center gap-1.5 text-[11.5px] text-zoru-ink-muted">
                          <Clock className="h-3 w-3" />
                          ETA · {item.eta}
                        </p>
                      )}
                    </ZoruCard>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

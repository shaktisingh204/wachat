'use client';

import * as React from 'react';
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Card,
  PageHeader,
  PageHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Field,
  Input,
  Textarea,
  Skeleton,
} from '@/components/sabcrm/20ui';
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
  ThumbsUp,
  Plus,
} from 'lucide-react';

/**
 * /dashboard/facebook/roadmap - Meta Suite product roadmap (20ui).
 *
 * Renders a status-grouped grid of Card tiles. Status is communicated via
 * Badge using only neutral / success / info / ghost variants (no rainbow
 * accents), keeping a single accent and a single radius across the page.
 */

type RoadmapStatus = 'shipped' | 'in_progress' | 'planned';

const STATUS_LABELS: Record<RoadmapStatus, string> = {
  shipped: 'Shipped',
  in_progress: 'In progress',
  planned: 'Planned',
};

const STATUS_BADGE: Record<
  RoadmapStatus,
  'secondary' | 'success' | 'info'
> = {
  shipped: 'secondary',
  in_progress: 'info',
  planned: 'secondary',
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
  id: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  area: string;
  icon: React.ComponentType<{ className?: string }>;
  eta?: string;
  upvotes: number;
  hasUpvoted: boolean;
}

type BaseRoadmapItem = Omit<RoadmapItem, 'id' | 'upvotes' | 'hasUpvoted'>;

const BASE_ROADMAP: BaseRoadmapItem[] = [
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
      'Read and reply to Messenger conversations with assignment and status.',
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
      'Pre-broadcast checklist plus RTMP stream launcher inside SabNode.',
    status: 'planned',
    area: 'Publishing',
    icon: Rocket,
  },
];

const STATUS_ORDER: RoadmapStatus[] = ['shipped', 'in_progress', 'planned'];

function useRoadmap() {
  const [data, setData] = React.useState<RoadmapItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Simulate fetching roadmap from a CMS or changelog API
    const fetchRoadmap = async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setData(
        BASE_ROADMAP.map((item) => ({
          ...item,
          id: item.title.toLowerCase().replace(/\s+/g, '-'),
          upvotes: item.status === 'planned' ? Math.floor(Math.random() * 50) + 10 : 0,
          hasUpvoted: false,
        }))
      );
      setLoading(false);
    };
    fetchRoadmap();
  }, []);

  const handleUpvote = (id: string) => {
    setData((prev) =>
      prev.map((item) => {
        if (item.id === id && item.status === 'planned') {
          return {
            ...item,
            upvotes: item.hasUpvoted ? item.upvotes - 1 : item.upvotes + 1,
            hasUpvoted: !item.hasUpvoted,
          };
        }
        return item;
      })
    );
  };

  return { data, loading, handleUpvote };
}

export default function FacebookRoadmapPage() {
  const { data: roadmapData, loading, handleUpvote } = useRoadmap();
  const [featureRequestOpen, setFeatureRequestOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const grouped = React.useMemo(() => {
    const map: Record<RoadmapStatus, RoadmapItem[]> = {
      shipped: [],
      in_progress: [],
      planned: [],
    };
    for (const item of roadmapData) {
      map[item.status].push(item);
    }
    return map;
  }, [roadmapData]);

  const handleFeatureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Mock API call to submit feature request
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSubmitting(false);
    setFeatureRequestOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">
              Meta Suite
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Roadmap</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page header */}
      <PageHeader className="mt-4">
        <PageHeading>
          <PageEyebrow>Meta Suite, what&apos;s next</PageEyebrow>
          <PageTitle>Roadmap</PageTitle>
          <PageDescription>
            Public view of what&apos;s shipped, what&apos;s in flight and
            what&apos;s coming next for the Meta Suite. Subject to change.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Dialog open={featureRequestOpen} onOpenChange={setFeatureRequestOpen}>
            <DialogTrigger asChild>
              <Button variant="primary" iconLeft={Plus}>
                Request feature
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleFeatureSubmit}>
                <DialogHeader>
                  <DialogTitle>Request a feature</DialogTitle>
                  <DialogDescription>
                    Tell us what you&apos;d like to see next in the Meta Suite. We review all requests.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Field label="Feature title">
                    <Input
                      placeholder="E.g. Instagram Stories publishing"
                      required
                    />
                  </Field>
                  <Field label="Details and use case">
                    <Textarea
                      placeholder="How would you use this feature?"
                      required
                      className="min-h-[100px]"
                    />
                  </Field>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="ghost">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit" variant="primary" loading={isSubmitting}>
                    {isSubmitting ? 'Submitting' : 'Submit request'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </PageActions>
      </PageHeader>

      {/* Stat strip */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STATUS_ORDER.map((status) => {
          const Icon = STATUS_ICON[status];
          return (
            <div
              key={status}
              className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-4"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text)] [&_svg]:size-4">
                  <Icon aria-hidden="true" />
                </span>
                <Badge variant={STATUS_BADGE[status]}>
                  {STATUS_LABELS[status]}
                </Badge>
              </div>
              {loading ? (
                <Skeleton className="mt-3 h-[22px] w-12" />
              ) : (
                <p className="mt-3 text-[22px] tracking-tight text-[var(--st-text)] leading-none">
                  {grouped[status].length}
                </p>
              )}
              <p className="mt-1 text-[12px] text-[var(--st-text-secondary)]">
                {STATUS_LABELS[status].toLowerCase()} item
                {!loading && grouped[status].length !== 1 ? 's' : ''}
              </p>
            </div>
          );
        })}
      </div>

      {/* Status-grouped grids */}
      <div className="mt-10 flex flex-col gap-10">
        {STATUS_ORDER.map((status) => {
          const items = grouped[status];
          if (!loading && items.length === 0) return null;
          const Icon = STATUS_ICON[status];
          return (
            <section key={status}>
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-[18px] tracking-tight text-[var(--st-text)] leading-none">
                    <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                    {STATUS_LABELS[status]}
                  </h2>
                  <p className="mt-1.5 text-[12.5px] text-[var(--st-text-secondary)]">
                    {loading ? (
                      <Skeleton className="h-4 w-16" />
                    ) : (
                      `${items.length} item${items.length === 1 ? '' : 's'}`
                    )}
                  </p>
                </div>
                <Badge variant={STATUS_BADGE[status]}>
                  {STATUS_LABELS[status]}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="flex flex-col gap-3 p-5">
                      <div className="flex items-start justify-between gap-2">
                        <Skeleton className="h-9 w-9 rounded-[var(--st-radius-sm)]" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="mt-0.5 h-4 w-full" />
                        <Skeleton className="h-4 w-4/5" />
                      </div>
                    </Card>
                  ))
                ) : (
                  items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <Card
                        key={item.id}
                        className="flex flex-col justify-between gap-3 p-5"
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text)] [&_svg]:size-4">
                              <ItemIcon aria-hidden="true" />
                            </span>
                            <Badge variant={STATUS_BADGE[item.status]}>
                              {STATUS_LABELS[item.status]}
                            </Badge>
                          </div>
                          <div className="flex flex-col gap-1">
                            <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                              {item.area}
                            </p>
                            <p className="text-[15px] text-[var(--st-text)] leading-tight">
                              {item.title}
                            </p>
                            <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)] leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                          {item.eta && (
                            <p className="mt-1 inline-flex items-center gap-1.5 text-[11.5px] text-[var(--st-text-secondary)]">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              ETA, {item.eta}
                            </p>
                          )}
                        </div>

                        {item.status === 'planned' && (
                          <div className="mt-2 pt-3 border-t border-[var(--st-border)]">
                            <Button
                              type="button"
                              size="sm"
                              variant={item.hasUpvoted ? 'primary' : 'secondary'}
                              iconLeft={ThumbsUp}
                              onClick={() => handleUpvote(item.id)}
                              aria-pressed={item.hasUpvoted}
                              aria-label={`Upvote ${item.title}, ${item.upvotes} ${item.upvotes === 1 ? 'vote' : 'votes'}`}
                            >
                              {item.upvotes}
                            </Button>
                          </div>
                        )}
                      </Card>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

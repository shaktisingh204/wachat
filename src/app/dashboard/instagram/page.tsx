'use client';

import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Separator,
  Skeleton,
  StatCard,
} from '@/components/sabcrm/20ui';
import { useEffect, useState, useTransition } from 'react';

import { getInstagramAccountForPage } from '@/app/actions/instagram.actions';
import {
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  Heart,
  MessageSquare,
  Newspaper,
  Plus,
  Users,
  Video,
} from 'lucide-react';
import Link from 'next/link';

interface IgAccount {
  username: string;
  account_type?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
}

const QUICK_LINKS = [
  { href: '/dashboard/instagram/feed', label: 'Content feed', icon: Newspaper, hint: 'Posts and engagement' },
  { href: '/dashboard/instagram/stories', label: 'Stories', icon: Clapperboard, hint: 'Live 24-hour stories' },
  { href: '/dashboard/instagram/reels', label: 'Reels', icon: Video, hint: 'Short-form video' },
  { href: '/dashboard/instagram/messages', label: 'Messages', icon: MessageSquare, hint: 'Direct message inbox' },
];

const ACTIVITY = [
  { href: '/dashboard/instagram/feed', label: 'New post published', when: '2 hours ago', icon: Newspaper },
  { href: '/dashboard/instagram/messages', label: 'New message from @harini.nair', when: '5 hours ago', icon: MessageSquare },
  { href: '/dashboard/instagram/stories', label: 'Mentioned you in a story', when: '1 day ago', icon: Clapperboard },
];

function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export default function InstagramDashboardPage() {
  const [account, setAccount] = useState<IgAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    const storedProjectId = localStorage.getItem('activeProjectId');
    if (!storedProjectId) {
      setError('No project selected. Pick an Instagram account from connections.');
      return;
    }
    startLoading(async () => {
      const { instagramAccount, error: fetchError } =
        await getInstagramAccountForPage(storedProjectId);
      if (fetchError) setError(fetchError);
      else setAccount(instagramAccount);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]);

  if (isLoading || (!account && !error)) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
        <Alert tone="danger" title="Could not load this account">
          {error}
        </Alert>
        <EmptyState
          icon={Users}
          title="No account connected"
          description="Connect an Instagram Business account to see followers, posts, and engagement here."
          action={
            <Button asChild>
              <Link href="/dashboard/instagram/connections">
                Choose an account
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!account) return <DashboardSkeleton />;

  const tabular = { fontVariantNumeric: 'tabular-nums' } as const;

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <PageHeader>
        <PageHeaderHeading>
          <PageDescription>Instagram</PageDescription>
          <PageTitle>
            <span className="inline-flex items-center gap-3">
              <Avatar
                name={account.username}
                src={account.profile_picture_url}
                shape="round"
                size="md"
              />
              @{account.username}
            </span>
          </PageTitle>
          <PageDescription>
            <span className="inline-flex items-center gap-2">
              <Badge tone="success" dot>
                Connected
              </Badge>
              <span className="capitalize">
                {account.account_type?.toLowerCase() || 'business'} account
              </span>
            </span>
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button asChild variant="outline">
            <Link href="/dashboard/instagram/connections">Switch account</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/instagram/create-post">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create post
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Followers"
          value={<span style={tabular}>{(account.followers_count ?? 0).toLocaleString()}</span>}
          icon={Users}
          accent="#d6249f"
        />
        <StatCard
          label="Following"
          value={<span style={tabular}>{(account.follows_count ?? 0).toLocaleString()}</span>}
          icon={Heart}
          accent="#7c3aed"
        />
        <StatCard
          label="Posts"
          value={<span style={tabular}>{(account.media_count ?? 0).toLocaleString()}</span>}
          icon={Newspaper}
          accent="#3b7af5"
        />
        <StatCard
          label="Status"
          value="Active"
          icon={CheckCircle2}
          accent="#1f9d55"
          delta={{ value: 'Syncing live', tone: 'up' }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card variant="elevated" padding="none">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="flex flex-col">
              {ACTIVITY.map((a, i) => (
                <li key={a.label}>
                  {i > 0 ? <Separator /> : null}
                  <Link
                    href={a.href}
                    className="group flex items-center gap-3 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                      <a.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="flex-1 text-[var(--st-text)] group-hover:underline">
                      {a.label}
                    </span>
                    <span className="text-xs text-[var(--st-text-secondary)]">{a.when}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card variant="elevated" padding="none">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
              Jump to
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_LINKS.map((q) => (
                <Link
                  key={q.href}
                  href={q.href}
                  className="group flex flex-col gap-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3 outline-none transition-all hover:-translate-y-0.5 hover:border-[var(--st-accent)] hover:shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--st-accent)] active:translate-y-0"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text)] transition-colors group-hover:bg-[var(--st-accent-soft)] group-hover:text-[var(--st-accent)]">
                    <q.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium text-[var(--st-text)]">{q.label}</span>
                  <span className="text-xs text-[var(--st-text-secondary)]">{q.hint}</span>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

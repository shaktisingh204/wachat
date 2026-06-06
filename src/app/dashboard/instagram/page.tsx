'use client';

import { Alert, AlertDescription, AlertTitle, Avatar, AvatarFallback, AvatarImage, Card, CardBody, CardDescription, CardHeader, CardTitle, Skeleton } from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition } from 'react';

import { getInstagramAccountForPage } from '@/app/actions/instagram.actions';
import { AlertCircle, Users, Clapperboard, Newspaper, MessageSquare, Video } from 'lucide-react';
import Link from 'next/link';

const StatCard = ({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
}) => (
  <Card className="p-0">
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm">{title}</CardTitle>
      <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" />
    </CardHeader>
    <CardBody>
      <div className="text-2xl text-[var(--st-text)]">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </CardBody>
  </Card>
);

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export default function InstagramDashboardPage() {
  const [account, setAccount] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      const storedProjectId = localStorage.getItem('activeProjectId');
      if (storedProjectId) {
        startLoading(async () => {
          const { instagramAccount, error: fetchError } =
            await getInstagramAccountForPage(storedProjectId);
          if (fetchError) {
            setError(fetchError);
          } else {
            setAccount(instagramAccount);
          }
        });
      } else {
        setError('No project selected.');
      }
    }
  }, [isClient]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Account</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!account) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 border-2 border-[var(--st-border)]">
          <AvatarImage src={account.profile_picture_url} alt={account.username} />
          <AvatarFallback>{account.username.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl text-[var(--st-text)]">@{account.username}</h1>
          <p className="text-[var(--st-text-secondary)] capitalize">{account.account_type?.toLowerCase()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Followers" value={account.followers_count} icon={Users} />
        <StatCard title="Media Count" value={account.media_count} icon={Newspaper} />
        <StatCard title="Engagement" value="N/A" icon={Clapperboard} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-0">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <Link
                  href="/dashboard/instagram/feed"
                  className="flex-1 text-[var(--st-text)] underline-offset-2 hover:underline"
                >
                  New post published
                </Link>
                <span className="text-xs text-[var(--st-text-secondary)]">2 hours ago</span>
              </li>
              <li className="flex items-center gap-3">
                <Link
                  href="/dashboard/instagram/messages"
                  className="flex-1 text-[var(--st-text)] underline-offset-2 hover:underline"
                >
                  New message from @user
                </Link>
                <span className="text-xs text-[var(--st-text-secondary)]">5 hours ago</span>
              </li>
              <li className="flex items-center gap-3">
                <Link
                  href="/dashboard/instagram/stories"
                  className="flex-1 text-[var(--st-text)] underline-offset-2 hover:underline"
                >
                  Story mentioned you
                </Link>
                <span className="text-xs text-[var(--st-text-secondary)]">1 day ago</span>
              </li>
            </ul>
          </CardBody>
        </Card>
        <Card className="p-0">
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-2 gap-4">
            <Link href="/dashboard/instagram/feed">
              <Card className="p-4 text-center hover:bg-[var(--st-bg-muted)]">
                <Newspaper className="mx-auto h-8 w-8 text-[var(--st-text)] mb-2" />
                Feed
              </Card>
            </Link>
            <Link href="/dashboard/instagram/stories">
              <Card className="p-4 text-center hover:bg-[var(--st-bg-muted)]">
                <Clapperboard className="mx-auto h-8 w-8 text-[var(--st-text)] mb-2" />
                Stories
              </Card>
            </Link>
            <Link href="/dashboard/instagram/reels">
              <Card className="p-4 text-center hover:bg-[var(--st-bg-muted)]">
                <Video className="mx-auto h-8 w-8 text-[var(--st-text)] mb-2" />
                Reels
              </Card>
            </Link>
            <Link href="/dashboard/instagram/messages">
              <Card className="p-4 text-center hover:bg-[var(--st-bg-muted)]">
                <MessageSquare className="mx-auto h-8 w-8 text-[var(--st-text)] mb-2" />
                Messages
              </Card>
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

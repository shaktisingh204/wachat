'use client';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruSkeleton,
} from '@/components/zoruui';
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
  <ZoruCard className="p-0">
    <ZoruCardHeader className="flex flex-row items-center justify-between pb-2">
      <ZoruCardTitle className="text-sm">{title}</ZoruCardTitle>
      <Icon className="h-4 w-4 text-zoru-ink-muted" />
    </ZoruCardHeader>
    <ZoruCardContent>
      <div className="text-2xl text-zoru-ink">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </ZoruCardContent>
  </ZoruCard>
);

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <ZoruSkeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <ZoruSkeleton className="h-6 w-48" />
          <ZoruSkeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <ZoruSkeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ZoruSkeleton className="h-64" />
        <ZoruSkeleton className="h-64" />
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
      <ZoruAlert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <ZoruAlertTitle>Error Loading Account</ZoruAlertTitle>
        <ZoruAlertDescription>{error}</ZoruAlertDescription>
      </ZoruAlert>
    );
  }

  if (!account) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <ZoruAvatar className="h-16 w-16 border-2 border-zoru-line">
          <ZoruAvatarImage src={account.profile_picture_url} alt={account.username} />
          <ZoruAvatarFallback>{account.username.charAt(0).toUpperCase()}</ZoruAvatarFallback>
        </ZoruAvatar>
        <div>
          <h1 className="text-3xl text-zoru-ink">@{account.username}</h1>
          <p className="text-zoru-ink-muted capitalize">{account.account_type?.toLowerCase()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Followers" value={account.followers_count} icon={Users} />
        <StatCard title="Media Count" value={account.media_count} icon={Newspaper} />
        <StatCard title="Engagement" value="N/A" icon={Clapperboard} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ZoruCard className="p-0">
          <ZoruCardHeader>
            <ZoruCardTitle>Recent Activity</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <Link
                  href="/dashboard/instagram/feed"
                  className="flex-1 text-zoru-ink underline-offset-2 hover:underline"
                >
                  New post published
                </Link>
                <span className="text-xs text-zoru-ink-muted">2 hours ago</span>
              </li>
              <li className="flex items-center gap-3">
                <Link
                  href="/dashboard/instagram/messages"
                  className="flex-1 text-zoru-ink underline-offset-2 hover:underline"
                >
                  New message from @user
                </Link>
                <span className="text-xs text-zoru-ink-muted">5 hours ago</span>
              </li>
              <li className="flex items-center gap-3">
                <Link
                  href="/dashboard/instagram/stories"
                  className="flex-1 text-zoru-ink underline-offset-2 hover:underline"
                >
                  Story mentioned you
                </Link>
                <span className="text-xs text-zoru-ink-muted">1 day ago</span>
              </li>
            </ul>
          </ZoruCardContent>
        </ZoruCard>
        <ZoruCard className="p-0">
          <ZoruCardHeader>
            <ZoruCardTitle>Quick Links</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent className="grid grid-cols-2 gap-4">
            <Link href="/dashboard/instagram/feed">
              <ZoruCard className="p-4 text-center hover:bg-zoru-surface-2">
                <Newspaper className="mx-auto h-8 w-8 text-zoru-ink mb-2" />
                Feed
              </ZoruCard>
            </Link>
            <Link href="/dashboard/instagram/stories">
              <ZoruCard className="p-4 text-center hover:bg-zoru-surface-2">
                <Clapperboard className="mx-auto h-8 w-8 text-zoru-ink mb-2" />
                Stories
              </ZoruCard>
            </Link>
            <Link href="/dashboard/instagram/reels">
              <ZoruCard className="p-4 text-center hover:bg-zoru-surface-2">
                <Video className="mx-auto h-8 w-8 text-zoru-ink mb-2" />
                Reels
              </ZoruCard>
            </Link>
            <Link href="/dashboard/instagram/messages">
              <ZoruCard className="p-4 text-center hover:bg-zoru-surface-2">
                <MessageSquare className="mx-auto h-8 w-8 text-zoru-ink mb-2" />
                Messages
              </ZoruCard>
            </Link>
          </ZoruCardContent>
        </ZoruCard>
      </div>
    </div>
  );
}

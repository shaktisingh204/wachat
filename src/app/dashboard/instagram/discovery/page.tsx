'use client';

import { useState, useTransition } from 'react';
import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruInput,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
} from '@/components/zoruui';
import { AlertCircle, Search, Compass, Users, Newspaper, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { discoverInstagramAccount } from '@/app/actions/instagram.actions';

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

const DiscoveryResultSkeleton = () => (
  <div className="space-y-6 mt-6">
    <ZoruCard className="p-6">
      <div className="flex items-center gap-4">
        <ZoruSkeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <ZoruSkeleton className="h-6 w-48" />
          <ZoruSkeleton className="h-4 w-32" />
        </div>
      </div>
    </ZoruCard>
    <div className="grid md:grid-cols-2 gap-4">
      <ZoruSkeleton className="h-24" />
      <ZoruSkeleton className="h-24" />
    </div>
    <ZoruCard className="p-6">
      <ZoruCardHeader>
        <ZoruCardTitle>Recent Media</ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent className="grid md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <ZoruSkeleton key={i} className="aspect-square" />
        ))}
      </ZoruCardContent>
    </ZoruCard>
  </div>
);

export default function InstagramDiscoveryPage() {
  const [username, setUsername] = useState('nike');
  const [discoveredData, setDiscoveredData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();

  const handleSearch = () => {
    if (!username.trim()) return;
    const storedProjectId = localStorage.getItem('activeProjectId');
    if (!storedProjectId) {
      setError('No active project selected. Please select a project from the connections page.');
      return;
    }

    startTransition(async () => {
      setError(null);
      setDiscoveredData(null);
      const result = await discoverInstagramAccount(username, storedProjectId);
      if (result.error) {
        setError(result.error);
      } else {
        setDiscoveredData(result.account);
      }
    });
  };

  // Initial search on load
  useState(() => {
    handleSearch();
  });

  return (
    <div className="flex flex-col gap-8">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-3">
              <Compass className="h-7 w-7" />
              Instagram Discovery
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Analyze public metrics and recent media from other Instagram Business accounts.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <ZoruCard className="p-4">
        <ZoruCardContent className="p-0 flex gap-2">
          <ZoruInput
            placeholder="Enter Instagram username (e.g., nike)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <ZoruButton onClick={handleSearch} disabled={isLoading}>
            <Search className="mr-2 h-4 w-4" />
            Analyze
          </ZoruButton>
        </ZoruCardContent>
      </ZoruCard>

      {isLoading && <DiscoveryResultSkeleton />}

      {error && (
        <ZoruAlert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Error</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </ZoruAlert>
      )}

      {discoveredData && (
        <div className="space-y-6">
          <ZoruCard className="p-6">
            <ZoruCardHeader>
              <div className="flex items-center gap-4">
                <ZoruAvatar className="h-16 w-16">
                  <ZoruAvatarImage
                    src={discoveredData.profile_picture_url}
                    alt={discoveredData.name}
                  />
                  <ZoruAvatarFallback>
                    {discoveredData.name?.charAt(0).toUpperCase() || 'U'}
                  </ZoruAvatarFallback>
                </ZoruAvatar>
                <div>
                  <ZoruCardTitle className="text-2xl">{discoveredData.name}</ZoruCardTitle>
                  <ZoruButton variant="ghost" asChild className="p-0 h-auto">
                    <a
                      href={`https://instagram.com/${username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      @{username} <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </ZoruButton>
                </div>
              </div>
            </ZoruCardHeader>
          </ZoruCard>

          <div className="grid md:grid-cols-2 gap-4">
            <StatCard title="Followers" value={discoveredData.followers_count || 0} icon={Users} />
            <StatCard
              title="Media Count"
              value={discoveredData.media_count || 0}
              icon={Newspaper}
            />
          </div>

          <ZoruCard className="p-6">
            <ZoruCardHeader>
              <ZoruCardTitle>Recent Media</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(discoveredData.media?.data || []).map((item: any) => (
                <Link
                  key={item.id}
                  href={item.permalink || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block relative aspect-square group"
                >
                  <Image
                    src={item.media_url}
                    alt={item.caption || 'Post'}
                    fill
                    className="rounded-md object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                    <p className="text-white text-xs text-center line-clamp-4">{item.caption}</p>
                  </div>
                </Link>
              ))}
            </ZoruCardContent>
          </ZoruCard>
        </div>
      )}
    </div>
  );
}

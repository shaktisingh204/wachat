'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  Input,
  Skeleton,
  zoruSonnerToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useState,
  useTransition } from 'react';
import {
  AlertCircle,
  Compass,
  Image as ImageIcon,
  RefreshCw,
  Search,
  Users,
  } from 'lucide-react';

import { discoverInstagramAccount } from '@/app/actions/instagram.actions';
import { useProject } from '@/context/project-context';

/**
 * /dashboard/instagram/discovery — Public IG Business Discovery lookup.
 *
 * Uses the Instagram Graph `business_discovery` field to look up any
 * public IG Business / Creator account by username. Returns profile
 * metadata + the latest media tiles for inspiration & competitive
 * research.
 */

import * as React from 'react';

interface IgMedia {
  id: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  caption?: string;
  like_count?: number;
  comments_count?: number;
  timestamp?: string;
}

interface IgProfile {
  id?: string;
  username?: string;
  name?: string;
  biography?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  website?: string;
  media?: { data?: IgMedia[] };
}

function formatNumber(n?: number): string {
  if (typeof n !== 'number') return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function InstagramDiscoveryPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [username, setUsername] = useState('');
  const [profile, setProfile] = useState<IgProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const onSearch = useCallback(
    (rawUsername: string) => {
      if (!projectId) {
        zoruSonnerToast.error('Select a project with a connected Instagram account first.');
        return;
      }
      const cleaned = rawUsername.replace(/^@/, '').trim();
      if (!cleaned) {
        zoruSonnerToast.error('Enter an Instagram username to discover.');
        return;
      }
      startLoading(async () => {
        const res = await discoverInstagramAccount(cleaned, projectId);
        if (res.error) {
          setError(res.error);
          setProfile(null);
          return;
        }
        setError(null);
        setProfile((res.account as IgProfile) ?? null);
      });
    },
    [projectId],
  );

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Compass />}
          title="No project selected"
          description="Pick a project with a connected Instagram account to use discovery."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/instagram">Instagram</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Discovery</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-[var(--st-text)]">Business discovery</h1>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
            Look up any public Instagram Business or Creator account by username.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => onSearch(username)}
          disabled={loading || !username}
        >
          <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          Refresh
        </Button>
      </header>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch(username);
        }}
      >
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. instagram"
          aria-label="Instagram username"
          className="max-w-md"
        />
        <Button type="submit" disabled={loading}>
          <Search className="mr-2 h-4 w-4" />
          Discover
        </Button>
      </form>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Discovery failed</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      ) : null}

      {loading && !profile ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="aspect-square w-full" />
          </div>
        </div>
      ) : !profile ? (
        <EmptyState
          icon={<Compass />}
          title="No discovery yet"
          description="Enter a username above to fetch their public profile and recent posts."
        />
      ) : (
        <>
          <Card className="flex flex-col gap-4 p-5 md:flex-row md:items-start">
            <Avatar className="h-20 w-20">
              {profile.profile_picture_url ? (
                <ZoruAvatarImage src={profile.profile_picture_url} alt="" />
              ) : null}
              <ZoruAvatarFallback>
                <Users className="h-6 w-6" />
              </ZoruAvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-lg text-[var(--st-text)]">{profile.name || profile.username}</p>
              <p className="text-sm text-[var(--st-text-secondary)]">@{profile.username}</p>
              {profile.biography ? (
                <p className="mt-2 text-sm text-[var(--st-text)] whitespace-pre-line">
                  {profile.biography}
                </p>
              ) : null}
              {profile.website ? (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex text-xs text-[var(--st-text-secondary)] underline"
                >
                  {profile.website}
                </a>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">
                  Followers · {formatNumber(profile.followers_count)}
                </Badge>
                <Badge variant="outline">
                  Following · {formatNumber(profile.follows_count)}
                </Badge>
                <Badge variant="outline">
                  Posts · {formatNumber(profile.media_count)}
                </Badge>
              </div>
            </div>
          </Card>

          <h2 className="mt-2 text-sm text-[var(--st-text)]">Recent media</h2>
          {!profile.media?.data?.length ? (
            <EmptyState
              icon={<ImageIcon />}
              title="No recent media"
              description="This account has not published any public media recently."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {profile.media.data.map((m) => {
                const src = m.thumbnail_url || m.media_url;
                return (
                  <a
                    key={m.id}
                    href={m.permalink ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-[var(--zoru-radius)] border border-[var(--st-border)] bg-[var(--st-bg-muted)]"
                  >
                    <div className="aspect-square w-full">
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt={m.caption ?? ''}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="p-2 text-[11px] text-[var(--st-text-secondary)]">
                      <p className="line-clamp-2 text-[var(--st-text)]">{m.caption ?? '(no caption)'}</p>
                      <div className="mt-1 flex gap-3">
                        <span>♥ {formatNumber(m.like_count)}</span>
                        <span>💬 {formatNumber(m.comments_count)}</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

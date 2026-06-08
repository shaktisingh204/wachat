'use client';

import {
  Alert,
  Avatar,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Skeleton,
  StatCard,
  toast,
} from '@/components/sabcrm/20ui';
import { useCallback, useState, useTransition } from 'react';
import {
  Compass,
  Hash,
  Heart,
  Image as ImageIcon,
  MessageSquare,
  RefreshCw,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';

import { discoverInstagramAccount } from '@/app/actions/instagram.actions';
import { useProject } from '@/context/project-context';

/**
 * /dashboard/instagram/discovery — Public IG Business Discovery lookup.
 *
 * Uses the Instagram Graph `business_discovery` field to look up any public
 * IG Business / Creator account by username, returning profile metadata plus
 * the latest media tiles for inspiration and competitive research.
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

const tabular = { fontVariantNumeric: 'tabular-nums' } as const;

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
        toast.error('Select a project with a connected Instagram account first.');
        return;
      }
      const cleaned = rawUsername.replace(/^@/, '').trim();
      if (!cleaned) {
        toast.error('Enter an Instagram username to discover.');
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
      <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
        <Card variant="outlined">
          <EmptyState
            icon={Compass}
            title="No project selected"
            description="Pick a project with a connected Instagram account to use discovery."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-6 pt-6 pb-10">
      <PageHeader>
        <PageHeaderHeading>
          <PageDescription>Instagram</PageDescription>
          <PageTitle>
            <span className="inline-flex items-center gap-3">
              <Compass className="h-6 w-6 text-[var(--st-text-secondary)]" aria-hidden="true" />
              Business discovery
            </span>
          </PageTitle>
          <PageDescription>
            Look up any public Instagram Business or Creator account by username.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="ghost"
            iconLeft={RefreshCw}
            loading={loading}
            onClick={() => onSearch(username)}
            disabled={loading || !username}
          >
            Refresh
          </Button>
        </PageActions>
      </PageHeader>

      <Card variant="outlined">
        <form
          className="flex flex-col items-end gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(username);
          }}
        >
          <div className="w-full sm:max-w-md">
            <Field label="Username">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. instagram"
                prefix="@"
                aria-label="Instagram username"
              />
            </Field>
          </div>
          <Button type="submit" iconLeft={Search} loading={loading}>
            Discover
          </Button>
        </form>
      </Card>

      {error ? (
        <Alert tone="danger" title="Discovery failed">
          {error}
        </Alert>
      ) : null}

      {loading && !profile ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        </div>
      ) : !profile ? (
        <Card variant="outlined">
          <EmptyState
            icon={Compass}
            title="No results yet"
            description="Enter a username above to fetch their public profile and recent posts."
          />
        </Card>
      ) : (
        <>
          <Card variant="elevated">
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <Avatar
                name={profile.name || profile.username || 'Account'}
                src={profile.profile_picture_url}
                shape="round"
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-[var(--st-text)]">
                  {profile.name || profile.username}
                </p>
                <p className="text-sm text-[var(--st-text-secondary)]">@{profile.username}</p>
                {profile.biography ? (
                  <p className="mt-2 max-w-[65ch] whitespace-pre-line text-sm text-[var(--st-text)]">
                    {profile.biography}
                  </p>
                ) : null}
                {profile.website ? (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex text-xs text-[var(--st-accent)] underline-offset-2 hover:underline"
                  >
                    {profile.website}
                  </a>
                ) : null}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Followers"
              value={<span style={tabular}>{formatNumber(profile.followers_count)}</span>}
              icon={Users}
              accent="#d6249f"
            />
            <StatCard
              label="Following"
              value={<span style={tabular}>{formatNumber(profile.follows_count)}</span>}
              icon={UserPlus}
              accent="#7c3aed"
            />
            <StatCard
              label="Posts"
              value={<span style={tabular}>{formatNumber(profile.media_count)}</span>}
              icon={Hash}
              accent="#3b7af5"
            />
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-[var(--st-text)]">Recent media</h2>
            {!profile.media?.data?.length ? (
              <Card variant="outlined">
                <EmptyState
                  icon={ImageIcon}
                  title="No recent media"
                  description="This account has not published any public media recently."
                />
              </Card>
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
                      className="group block overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] outline-none transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
                    >
                      <div className="aspect-square w-full bg-[var(--st-bg-muted)]">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt={m.caption ?? ''} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="p-2.5">
                        <p className="line-clamp-2 text-[11px] text-[var(--st-text)]">
                          {m.caption ?? 'No caption'}
                        </p>
                        <div className="mt-1.5 flex gap-3 text-[11px] text-[var(--st-text-secondary)]" style={tabular}>
                          <span className="inline-flex items-center gap-1">
                            <Heart className="h-3 w-3" aria-hidden="true" /> {formatNumber(m.like_count)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" aria-hidden="true" /> {formatNumber(m.comments_count)}
                          </span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

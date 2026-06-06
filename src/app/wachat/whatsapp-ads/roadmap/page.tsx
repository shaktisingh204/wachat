'use client';

import {
  Badge,
  type BadgeTone,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  Separator,
  Button,
  Skeleton,
  Alert,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { useToast } from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import {
  Check,
  Route,
  ThumbsUp,
  RefreshCw,
} from 'lucide-react';
import * as React from 'react';
import { useState, useEffect, useCallback, useTransition } from 'react';

import {
  getAdsRoadmapPhases,
  voteAdsRoadmapPhase,
  syncAdsRoadmap,
} from '@/app/actions/wachat-ads-roadmap.actions';
import type { RoadmapPhase } from '@/lib/rust-client/wachat-ads-roadmap';

/**
 * Normalised, render-ready view of a roadmap phase.
 *
 * The Rust crate stores phases as open-ended Mongo docs, so we coerce the few
 * fields the card needs and derive a stable `slug` (the value the vote endpoint
 * is keyed on: `slug` preferred, `phase` as fallback — matching the handler).
 */
type RoadmapCard = {
  /** Stable slug used as both the React key and the vote path param. */
  slug: string;
  /** Short label shown above the title (the original `phase` text). */
  label: string;
  title: string;
  milestones: string[];
  status: string;
  votes: number;
};

/** Map a free-form status string to a Badge tone, defaulting to neutral. */
function statusTone(status: string): BadgeTone {
  const s = status.trim().toLowerCase();
  if (s === 'completed' || s === 'done' || s === 'shipped') return 'success';
  if (s === 'in progress' || s === 'in-progress' || s === 'active') return 'info';
  return 'neutral';
}

/** Coerce a raw Rust phase doc into a render-ready card model. */
function toCard(p: RoadmapPhase, index: number): RoadmapCard {
  const slug =
    (typeof p.slug === 'string' && p.slug) ||
    (typeof p.phase === 'string' && p.phase) ||
    (typeof p._id === 'string' && p._id) ||
    `phase-${index}`;
  const label = (typeof p.phase === 'string' && p.phase) || slug;
  const title = (typeof p.title === 'string' && p.title) || label;
  const milestones = Array.isArray(p.milestones)
    ? p.milestones.filter((m): m is string => typeof m === 'string')
    : [];
  const status = typeof p.status === 'string' ? p.status : 'Planned';
  const rawVotes =
    typeof p.voteCount === 'number'
      ? p.voteCount
      : typeof p.votes === 'number'
        ? p.votes
        : 0;
  return { slug, label, title, milestones, status, votes: rawVotes };
}

export default function AdsRoadmapPage() {
  const { toast } = useToast();
  const [phases, setPhases] = useState<RoadmapCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [votingSlug, setVotingSlug] = useState<string | null>(null);
  const [isSyncing, startSync] = useTransition();

  const loadRoadmap = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const res = await getAdsRoadmapPhases();
    if (res.error) {
      setError(res.error);
    } else {
      setPhases((res.phases ?? []).map(toCard));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadRoadmap();
  }, [loadRoadmap]);

  const handleVote = useCallback(
    async (slug: string) => {
      setVotingSlug(slug);
      const res = await voteAdsRoadmapPhase(slug);
      setVotingSlug(null);
      if (!res.success) {
        toast({
          title: 'Could not record your vote',
          description: res.error ?? 'Please try again.',
          tone: 'danger',
        });
        return;
      }
      // Trust the server's post-call aggregate so the count stays correct even
      // across reloads / other voters.
      if (typeof res.voteCount === 'number') {
        const next = res.voteCount;
        setPhases((prev) =>
          prev.map((p) => (p.slug === slug ? { ...p, votes: next } : p)),
        );
      }
      toast({
        title: res.created ? 'Vote recorded' : 'Already voted',
        description: res.created
          ? 'Thanks for shaping the roadmap.'
          : 'You had already upvoted this phase.',
        tone: res.created ? 'success' : 'info',
      });
    },
    [toast],
  );

  const handleSync = useCallback(() => {
    startSync(async () => {
      const res = await syncAdsRoadmap();
      if (res.error) {
        toast({ title: 'Sync failed', description: res.error, tone: 'danger' });
      } else if (res.synced) {
        toast({ title: 'Roadmap synced', tone: 'success' });
      } else {
        toast({
          title: 'Sync unavailable',
          description: res.reason ?? 'No external project tool is configured.',
          tone: 'info',
        });
      }
      // Always refresh from the source of truth afterwards.
      await loadRoadmap();
    });
  }, [loadRoadmap, toast]);

  const showSkeletons = isLoading && phases.length === 0;
  const showEmpty = !isLoading && !error && phases.length === 0;

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Ads Roadmap' },
      ]}
      eyebrow="WaChat · Ads"
      title={
        <span className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
            aria-hidden="true"
          >
            <Route className="h-5 w-5" />
          </span>
          Facebook Integration Roadmap
        </span>
      }
      description="Our long-term plan for integrating deeply with the Meta Marketing API."
      actions={
        <Button
          variant="outline"
          size="sm"
          iconLeft={RefreshCw}
          onClick={handleSync}
          disabled={isLoading || isSyncing}
        >
          {isSyncing ? 'Syncing…' : 'Sync roadmap'}
        </Button>
      }
    >
      {error && (
        <Alert tone="danger" title="Could not load the roadmap" className="mb-4">
          {error}{' '}
          <Button variant="ghost" size="sm" onClick={() => void loadRoadmap()}>
            Retry
          </Button>
        </Alert>
      )}

      {showEmpty ? (
        <EmptyState
          icon={Route}
          title="No roadmap phases yet"
          description="Phases will appear here once the team publishes the plan."
          action={
            <Button
              variant="outline"
              size="sm"
              iconLeft={RefreshCw}
              onClick={() => void loadRoadmap()}
            >
              Refresh
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {showSkeletons
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="flex flex-col gap-4">
                  <Skeleton height={16} width="25%" />
                  <Skeleton height={24} width="50%" />
                  <Skeleton height={80} width="100%" />
                </Card>
              ))
            : phases.map((phase) => (
                <Card key={phase.slug} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                          {phase.label}
                        </p>
                        <CardTitle className="mt-1 text-[16px] tracking-tight">
                          {phase.title}
                        </CardTitle>
                      </div>
                      <Badge tone={statusTone(phase.status)}>{phase.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardBody className="flex-1">
                    {phase.milestones.length > 0 ? (
                      <ul className="flex flex-col gap-2.5">
                        {phase.milestones.map((milestone) => (
                          <li
                            key={milestone}
                            className="flex items-start gap-2.5 text-[13px] text-[var(--st-text)]"
                          >
                            <Check
                              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--st-text-secondary)]"
                              aria-hidden="true"
                            />
                            <span>{milestone}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-[var(--st-text-tertiary)]">
                        Milestones coming soon.
                      </p>
                    )}
                  </CardBody>
                  <Separator />
                  <CardFooter className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--st-text-tertiary)]">
                      {phase.votes} {phase.votes === 1 ? 'vote' : 'votes'}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      iconLeft={ThumbsUp}
                      onClick={() => void handleVote(phase.slug)}
                      disabled={votingSlug === phase.slug}
                    >
                      {votingSlug === phase.slug ? 'Voting…' : 'Upvote'}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
        </div>
      )}
    </WachatPage>
  );
}

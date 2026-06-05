'use client';

import {
  Badge,
  type BadgeTone,
  Card,
  Button,
  Skeleton,
  Alert,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import {
  Check,
  Route,
  ThumbsUp,
  RefreshCw,
} from 'lucide-react';
import * as React from 'react';
import { useState, useEffect } from 'react';

type RoadmapStatus = 'Completed' | 'In Progress' | 'Planned';

type RoadmapPhase = {
  phase: string;
  title: string;
  milestones: string[];
  status: RoadmapStatus;
  votes: number;
};

// Mock data to simulate external project management tool state
const INITIAL_ROADMAP: RoadmapPhase[] = [
  {
    phase: 'MVP',
    title: 'Minimum Viable Product',
    milestones: [
      'Embedded signup for easy onboarding',
      'List connected user assets (pages, ad accounts)',
      'Basic campaign creation',
    ],
    status: 'Completed',
    votes: 120,
  },
  {
    phase: 'Phase 2',
    title: 'Insights & Management',
    milestones: [
      'Advanced campaign performance insights',
      'Audience management tools',
      'Sync leads from Lead Ads',
    ],
    status: 'In Progress',
    votes: 85,
  },
  {
    phase: 'Phase 3',
    title: 'Automation & Optimization',
    milestones: [
      'Dynamic Creative Optimization (DCO) support',
      'Automated rules for budget and bidding',
      'A/B testing for creatives and copy',
    ],
    status: 'Planned',
    votes: 215,
  },
  {
    phase: 'Phase 4',
    title: 'Scale & Enterprise',
    milestones: [
      'Multi-user dashboards with role-based access',
      'Advanced billing and performance reports',
      'Full support for catalog-based ads',
    ],
    status: 'Planned',
    votes: 42,
  },
];

// Mock API call to fetch live roadmap status from Linear/Jira
const fetchLiveRoadmap = async (): Promise<RoadmapPhase[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([...INITIAL_ROADMAP]);
    }, 1200);
  });
};

function statusTone(status: RoadmapStatus): BadgeTone {
  if (status === 'Completed') return 'success';
  if (status === 'In Progress') return 'info';
  return 'neutral';
}

export default function AdsRoadmapPage() {
  const [phases, setPhases] = useState<RoadmapPhase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoadmap = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchLiveRoadmap();
      setPhases(data);
    } catch (err) {
      setError('Failed to sync with Linear. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRoadmap();
  }, []);

  const handleVote = (phaseName: string) => {
    setPhases((prev) =>
      prev.map((p) =>
        p.phase === phaseName ? { ...p, votes: p.votes + 1 } : p
      )
    );
  };

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
            className="flex h-9 w-9 items-center justify-center"
            style={{
              borderRadius: 'var(--st-radius)',
              background: 'var(--st-bg-secondary)',
              color: 'var(--st-text)',
            }}
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
          onClick={loadRoadmap}
          disabled={isLoading}
        >
          Sync with Linear
        </Button>
      }
    >
      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {isLoading && phases.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="flex flex-col gap-4">
                <Skeleton height={16} width="25%" />
                <Skeleton height={24} width="50%" />
                <Skeleton height={80} width="100%" />
              </Card>
            ))
          : phases.map((phase) => (
              <Card key={phase.phase} className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className="text-[11px] uppercase tracking-wide"
                      style={{ color: 'var(--st-text-tertiary)' }}
                    >
                      {phase.phase}
                    </p>
                    <h3
                      className="mt-1 text-[16px] tracking-tight"
                      style={{ color: 'var(--st-text)' }}
                    >
                      {phase.title}
                    </h3>
                  </div>
                  <Badge tone={statusTone(phase.status)}>{phase.status}</Badge>
                </div>
                <ul className="flex flex-col gap-2.5 mb-2">
                  {phase.milestones.map((milestone) => (
                    <li
                      key={milestone}
                      className="flex items-start gap-2.5 text-[13px]"
                      style={{ color: 'var(--st-text)' }}
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: 'var(--st-text-secondary)' }}
                        aria-hidden="true"
                      />
                      <span>{milestone}</span>
                    </li>
                  ))}
                </ul>
                <div
                  className="mt-auto flex items-center justify-between pt-4"
                  style={{ borderTop: '1px solid var(--st-border)' }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--st-text-tertiary)' }}
                  >
                    {phase.votes} votes
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={ThumbsUp}
                    onClick={() => handleVote(phase.phase)}
                  >
                    Upvote
                  </Button>
                </div>
              </Card>
            ))}
      </div>
    </WachatPage>
  );
}

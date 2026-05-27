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
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Button,
  Skeleton,
} from '@/components/zoruui';
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

function statusVariant(
  status: RoadmapStatus,
): 'success' | 'info' | 'ghost' {
  if (status === 'Completed') return 'success';
  if (status === 'In Progress') return 'info';
  return 'ghost';
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
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Ads Roadmap</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-2">
        <ZoruPageHeading>
          <ZoruPageEyebrow>WaChat · Ads</ZoruPageEyebrow>
          <ZoruPageTitle className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
              <Route className="h-5 w-5" />
            </span>
            Facebook Integration Roadmap
          </ZoruPageTitle>
          <ZoruPageDescription>
            Our long-term plan for integrating deeply with the Meta Marketing
            API.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button variant="outline" size="sm" onClick={loadRoadmap} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Sync with Linear
          </Button>
        </ZoruPageActions>
      </PageHeader>

      {error && (
        <div className="rounded-md bg-zoru-surface-2 p-4 text-sm text-zoru-ink">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {isLoading && phases.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="flex flex-col gap-4 p-5">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-20 w-full" />
              </Card>
            ))
          : phases.map((phase) => (
              <Card key={phase.phase} className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-zoru-ink-subtle">
                      {phase.phase}
                    </p>
                    <h3 className="mt-1 text-[16px] tracking-tight text-zoru-ink">
                      {phase.title}
                    </h3>
                  </div>
                  <Badge variant={statusVariant(phase.status)}>
                    {phase.status}
                  </Badge>
                </div>
                <ul className="flex flex-col gap-2.5 mb-2">
                  {phase.milestones.map((milestone) => (
                    <li
                      key={milestone}
                      className="flex items-start gap-2.5 text-[13px] text-zoru-ink"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-zoru-ink-muted" />
                      <span>{milestone}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex items-center justify-between border-t border-zoru-border pt-4">
                  <span className="text-sm font-medium text-zoru-ink-subtle">
                    {phase.votes} votes
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleVote(phase.phase)}
                  >
                    <ThumbsUp className="h-4 w-4" />
                    Upvote
                  </Button>
                </div>
              </Card>
            ))}
      </div>
    </div>
  );
}

'use client';

/**
 * Wachat WhatsApp Ads — Facebook integration roadmap (ZoruUI).
 *
 * Static grid of ZoruCard tiles, one per phase, with a status badge.
 */

import * as React from 'react';
import { Check, Route } from 'lucide-react';

import {
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruCard,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';

type RoadmapStatus = 'Completed' | 'In Progress' | 'Planned';

const ROADMAP_PHASES: Array<{
  phase: string;
  title: string;
  milestones: string[];
  status: RoadmapStatus;
}> = [
  {
    phase: 'MVP',
    title: 'Minimum Viable Product',
    milestones: [
      'Embedded signup for easy onboarding',
      'List connected user assets (pages, ad accounts)',
      'Basic campaign creation',
    ],
    status: 'Completed',
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
  },
];

function statusVariant(
  status: RoadmapStatus,
): 'success' | 'info' | 'ghost' {
  if (status === 'Completed') return 'success';
  if (status === 'In Progress') return 'info';
  return 'ghost';
}

export default function AdsRoadmapPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
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
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-2">
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
        <ZoruPageActions />
      </ZoruPageHeader>

      <div className="grid gap-4 md:grid-cols-2">
        {ROADMAP_PHASES.map((phase) => (
          <ZoruCard key={phase.phase} className="flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-zoru-ink-subtle">
                  {phase.phase}
                </p>
                <h3 className="mt-1 text-[16px] tracking-tight text-zoru-ink">
                  {phase.title}
                </h3>
              </div>
              <ZoruBadge variant={statusVariant(phase.status)}>
                {phase.status}
              </ZoruBadge>
            </div>
            <ul className="flex flex-col gap-2.5">
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
          </ZoruCard>
        ))}
      </div>
    </div>
  );
}

import * as React from 'react';

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
} from '@/components/sabcrm/20ui';
import { ListChecks, Repeat, Layers, Gauge, FolderOpen } from 'lucide-react';

export const dynamic = 'force-dynamic';

const SECTIONS = [
  {
    icon: ListChecks,
    title: 'Backlog',
    description: 'Capture, prioritise, and groom stories into sprint-ready work.',
  },
  {
    icon: Repeat,
    title: 'Sprints',
    description: 'Plan iterations, run the board, and complete with one click.',
  },
  {
    icon: Layers,
    title: 'Epics',
    description: 'Group related stories into initiatives and plot them on a roadmap.',
  },
  {
    icon: Gauge,
    title: 'Velocity',
    description: 'Track throughput and predictability across completed sprints.',
  },
];

export default function SabSprintsRootPage() {
  return (
    <div className="20ui mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <PageHeader bordered={false}>
        <PageHeaderHeading>
          <PageEyebrow>SabSprints</PageEyebrow>
          <PageTitle>Scrum workspace</PageTitle>
          <PageDescription>
            A Scrum-style workspace scoped to each SabNode project — backlog, sprints, epics, and velocity in one place.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FolderOpen
              size={16}
              aria-hidden="true"
              className="text-[var(--st-accent)]"
            />
            <CardTitle>Open a project to begin</CardTitle>
          </div>
          <CardDescription>
            SabSprints data is scoped to a project. Pick one from the Projects
            switcher in the top bar to land on its backlog at
            <code className="mx-1 rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] px-1.5 py-0.5 font-mono text-xs text-[var(--st-text)]">
              /dashboard/sabsprints/&lt;projectId&gt;/backlog
            </code>
            .
          </CardDescription>
        </CardHeader>
        <CardBody>
          <ul className="grid gap-3 sm:grid-cols-2">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <li
                  key={section.title}
                  className="flex items-start gap-3 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3"
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
                  >
                    <Icon size={16} />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-[var(--st-text)]">
                      {section.title}
                    </span>
                    <span className="text-xs text-[var(--st-text-secondary)]">
                      {section.description}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

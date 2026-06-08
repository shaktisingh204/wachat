'use client';

import React from 'react';
import {
  Workflow,
  Plus,
  Play,
  MoreHorizontal,
  Settings,
  Clock,
  Zap,
  CircleDot,
} from 'lucide-react';
import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  Card,
  Button,
  IconButton,
  Badge,
  type BadgeTone,
  StatCard,
  Table,
  THead,
  Tr,
  Th,
  TBody,
  Td,
} from '@/components/sabcrm/20ui';

type WorkflowStatus = 'active' | 'draft' | 'archived';

interface WorkflowRow {
  id: string;
  name: string;
  description: string;
  app: string;
  trigger: string;
  status: WorkflowStatus;
  lastRun: string;
}

const MOCK_WORKFLOWS: WorkflowRow[] = [
  {
    id: 'wf_1',
    name: 'Lead Enrichment',
    description: 'Automatically enriches new leads with Clearbit data.',
    app: 'Sales CRM',
    trigger: 'On Record Create',
    status: 'active',
    lastRun: '10 mins ago',
  },
  {
    id: 'wf_2',
    name: 'Invoice Generator',
    description: 'Generates PDF invoice when deal is closed.',
    app: 'Billing App',
    trigger: 'On Record Update',
    status: 'active',
    lastRun: '2 hours ago',
  },
  {
    id: 'wf_3',
    name: 'Daily Summary Report',
    description: 'Emails daily summary to team leads.',
    app: 'Internal Ops',
    trigger: 'Schedule (Daily)',
    status: 'draft',
    lastRun: 'N/A',
  },
  {
    id: 'wf_4',
    name: 'Slack Notification',
    description: 'Posts to Slack when high priority ticket created.',
    app: 'Support Desk',
    trigger: 'On Record Create',
    status: 'archived',
    lastRun: '5 days ago',
  },
];

const STATUS_TONE: Record<WorkflowStatus, BadgeTone> = {
  active: 'success',
  draft: 'warning',
  archived: 'neutral',
};

export default function SabCreatorWorkflowsPage() {
  const active = MOCK_WORKFLOWS.filter((w) => w.status === 'active').length;
  const drafts = MOCK_WORKFLOWS.filter((w) => w.status === 'draft').length;

  return (
    <main className="20ui mx-auto max-w-[1200px] p-6 md:p-10 space-y-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>
            <span className="inline-flex items-center gap-1.5">
              <Workflow className="w-3.5 h-3.5" aria-hidden="true" />
              Automation
            </span>
          </PageEyebrow>
          <PageTitle>Workflows</PageTitle>
          <PageDescription>Manage and monitor cross-app automated workflows.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus}>
            New workflow
          </Button>
        </PageActions>
      </PageHeader>

      <section aria-label="Workflow summary" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total workflows"
          value={<span className="tabular-nums">{MOCK_WORKFLOWS.length}</span>}
          icon={Zap}
          accent="#6366f1"
        />
        <StatCard
          label="Active"
          value={<span className="tabular-nums">{active}</span>}
          icon={CircleDot}
          accent="#16a34a"
        />
        <StatCard
          label="Drafts"
          value={<span className="tabular-nums">{drafts}</span>}
          icon={Clock}
          accent="#d97706"
        />
      </section>

      <Card padding="none" className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>App</Th>
              <Th>Trigger</Th>
              <Th>Status</Th>
              <Th>Last run</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {MOCK_WORKFLOWS.map((wf) => (
              <Tr key={wf.id}>
                <Td>
                  <div className="flex flex-col">
                    <span className="font-medium text-[var(--st-text)]">{wf.name}</span>
                    <span className="text-xs text-[var(--st-text-secondary)]">{wf.description}</span>
                  </div>
                </Td>
                <Td>
                  <Badge tone="neutral" kind="outline">
                    {wf.app}
                  </Badge>
                </Td>
                <Td>
                  <span className="flex items-center gap-1.5 text-sm text-[var(--st-text-secondary)]">
                    <Clock className="w-4 h-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                    {wf.trigger}
                  </span>
                </Td>
                <Td>
                  <Badge tone={STATUS_TONE[wf.status]} dot>
                    {wf.status.charAt(0).toUpperCase() + wf.status.slice(1)}
                  </Badge>
                </Td>
                <Td className="text-sm tabular-nums text-[var(--st-text-secondary)]">{wf.lastRun}</Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <IconButton label={`Run ${wf.name}`} icon={Play} variant="ghost" size="sm" />
                    <IconButton
                      label={`Configure ${wf.name}`}
                      icon={Settings}
                      variant="ghost"
                      size="sm"
                    />
                    <IconButton
                      label={`More actions for ${wf.name}`}
                      icon={MoreHorizontal}
                      variant="ghost"
                      size="sm"
                    />
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </main>
  );
}

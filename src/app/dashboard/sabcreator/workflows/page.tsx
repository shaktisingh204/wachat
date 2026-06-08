'use client';

import React from 'react';
import { Workflow, Plus, Play, MoreHorizontal, Settings, Clock } from 'lucide-react';
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
  return (
    <div className="20ui p-6 md:p-10 space-y-8">
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
            New Workflow
          </Button>
        </PageActions>
      </PageHeader>

      <Card padding="none" className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>App</Th>
              <Th>Trigger</Th>
              <Th>Status</Th>
              <Th>Last Run</Th>
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
                    {wf.status}
                  </Badge>
                </Td>
                <Td className="text-sm text-[var(--st-text-secondary)]">{wf.lastRun}</Td>
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
    </div>
  );
}

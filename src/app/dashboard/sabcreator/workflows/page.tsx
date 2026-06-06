'use client';

import React from 'react';
import { Workflow, Plus, Play, MoreHorizontal, Settings, Clock } from 'lucide-react';
import { PageHeader } from '@/components/sabcrm/20ui';
import { Card } from '@/components/sabcrm/20ui';
import { Button } from '@/components/sabcrm/20ui';
import { Badge } from '@/components/sabcrm/20ui';
import { Table, THead, Tr, Th, TBody, Td } from '@/components/sabcrm/20ui';

const MOCK_WORKFLOWS = [
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

export default function SabCreatorWorkflowsPage() {
  return (
    <div className="p-6 md:p-10 space-y-8">
      <PageHeader
        title="Workflows"
        subtitle="Manage and monitor cross-app automated workflows."
        icon={Workflow}
        actions={
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Workflow
          </Button>
        }
      />

      <Card className="p-0 overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Name</Th>
              <Th>App</Th>
              <Th>Trigger</Th>
              <Th>Status</Th>
              <Th>Last Run</Th>
              <Th className="text-right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {MOCK_WORKFLOWS.map((wf) => (
              <Tr key={wf.id}>
                <Td>
                  <div className="flex flex-col">
                    <span className="font-medium text-[var(--st-text)]">{wf.name}</span>
                    <span className="text-xs text-[var(--st-text)]/60">{wf.description}</span>
                  </div>
                </Td>
                <Td>
                  <Badge variant="outline">{wf.app}</Badge>
                </Td>
                <Td>
                  <div className="flex items-center text-sm text-[var(--st-text)]/80">
                    <Clock className="w-4 h-4 mr-1.5 text-[var(--st-text)]/50" />
                    {wf.trigger}
                  </div>
                </Td>
                <Td>
                  <Badge
                    variant={
                      wf.status === 'active'
                        ? 'default'
                        : wf.status === 'draft'
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {wf.status}
                  </Badge>
                </Td>
                <Td className="text-sm text-[var(--st-text)]/70">
                  {wf.lastRun}
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon">
                      <Play className="w-4 h-4 text-[var(--st-text)]/60" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Settings className="w-4 h-4 text-[var(--st-text)]/60" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4 text-[var(--st-text)]/60" />
                    </Button>
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

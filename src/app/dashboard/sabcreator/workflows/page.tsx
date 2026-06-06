'use client';

import React from 'react';
import { Workflow, Plus, Play, MoreHorizontal, Settings, Clock } from 'lucide-react';
import { PageHeader } from '@/components/sabcrm/20ui/compat';
import { Card } from '@/components/sabcrm/20ui/compat';
import { Button } from '@/components/sabcrm/20ui/compat';
import { Badge } from '@/components/sabcrm/20ui/compat';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/sabcrm/20ui/compat';

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
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>App</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_WORKFLOWS.map((wf) => (
              <TableRow key={wf.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-zoru-ink">{wf.name}</span>
                    <span className="text-xs text-zoru-ink/60">{wf.description}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{wf.app}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center text-sm text-zoru-ink/80">
                    <Clock className="w-4 h-4 mr-1.5 text-zoru-ink/50" />
                    {wf.trigger}
                  </div>
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell className="text-sm text-zoru-ink/70">
                  {wf.lastRun}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon">
                      <Play className="w-4 h-4 text-zoru-ink/60" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Settings className="w-4 h-4 text-zoru-ink/60" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4 text-zoru-ink/60" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

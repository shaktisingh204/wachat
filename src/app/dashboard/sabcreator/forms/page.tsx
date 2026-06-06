'use client';

import * as React from 'react';
import { FileText, Plus, Database, Edit, Eye, MoreHorizontal } from 'lucide-react';
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
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';

const MOCK_FORMS = [
  {
    id: 'frm_1',
    name: 'Lead Capture Form',
    app: 'Sales CRM',
    table: 'Leads',
    submissions: 1250,
    status: 'published',
    updatedAt: '2 days ago',
  },
  {
    id: 'frm_2',
    name: 'Support Ticket Request',
    app: 'Support Desk',
    table: 'Tickets',
    submissions: 342,
    status: 'published',
    updatedAt: '1 week ago',
  },
  {
    id: 'frm_3',
    name: 'Employee Onboarding',
    app: 'HR Hub',
    table: 'Employees',
    submissions: 15,
    status: 'draft',
    updatedAt: '4 hours ago',
  },
  {
    id: 'frm_4',
    name: 'Event Registration',
    app: 'Marketing Events',
    table: 'Registrations',
    submissions: 89,
    status: 'published',
    updatedAt: '3 weeks ago',
  },
];

export default function SabCreatorFormsPage() {
  return (
    <div className="p-6 md:p-10 space-y-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>
            <span className="inline-flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              SabCreator
            </span>
          </PageEyebrow>
          <PageTitle>Forms</PageTitle>
          <PageDescription>
            Design forms and collect structured data across your apps.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus}>
            Create Form
          </Button>
        </PageActions>
      </PageHeader>

      <Card padding="none" className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Form Name</Th>
              <Th>Target App</Th>
              <Th>Database Table</Th>
              <Th>Submissions</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {MOCK_FORMS.map((form) => (
              <Tr key={form.id}>
                <Td>
                  <span className="font-medium text-[var(--st-text)]">{form.name}</span>
                </Td>
                <Td>
                  <span className="text-sm text-[var(--st-text-secondary)]">{form.app}</span>
                </Td>
                <Td>
                  <div className="flex items-center gap-1.5 text-sm text-[var(--st-text-secondary)]">
                    <Database className="w-4 h-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
                    {form.table}
                  </div>
                </Td>
                <Td>
                  <span className="text-sm text-[var(--st-text-secondary)]">
                    {form.submissions.toLocaleString()}
                  </span>
                </Td>
                <Td>
                  <Badge tone={form.status === 'published' ? 'success' : 'neutral'} dot>
                    {form.status}
                  </Badge>
                </Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <IconButton label={`Preview ${form.name}`} icon={Eye} size="sm" />
                    <IconButton label={`Edit ${form.name}`} icon={Edit} size="sm" />
                    <IconButton label={`More actions for ${form.name}`} icon={MoreHorizontal} size="sm" />
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

'use client';

import React from 'react';
import { FileText, Plus, Database, Edit, Eye, MoreHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/sabcrm/20ui/compat';
import { Card } from '@/components/sabcrm/20ui/compat';
import { Button } from '@/components/sabcrm/20ui/compat';
import { Badge } from '@/components/sabcrm/20ui/compat';
import { Table, THead, Tr, Th, TBody, Td } from '@/components/sabcrm/20ui/compat';

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
      <PageHeader
        title="Forms"
        subtitle="Design forms and collect structured data across your apps."
        icon={FileText}
        actions={
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Form
          </Button>
        }
      />

      <Card className="p-0 overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Form Name</Th>
              <Th>Target App</Th>
              <Th>Database Table</Th>
              <Th>Submissions</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {MOCK_FORMS.map((form) => (
              <Tr key={form.id}>
                <Td>
                  <span className="font-medium text-[var(--st-text)]">{form.name}</span>
                </Td>
                <Td>
                  <span className="text-sm text-[var(--st-text)]/80">{form.app}</span>
                </Td>
                <Td>
                  <div className="flex items-center text-sm text-[var(--st-text)]/80">
                    <Database className="w-4 h-4 mr-1.5 text-[var(--st-text)]/50" />
                    {form.table}
                  </div>
                </Td>
                <Td className="text-sm text-[var(--st-text)]/70">
                  {form.submissions.toLocaleString()}
                </Td>
                <Td>
                  <Badge
                    variant={
                      form.status === 'published' ? 'default' : 'secondary'
                    }
                  >
                    {form.status}
                  </Badge>
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon">
                      <Eye className="w-4 h-4 text-[var(--st-text)]/60" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Edit className="w-4 h-4 text-[var(--st-text)]/60" />
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

'use client';

import React from 'react';
import { FileText, Plus, Database, Edit, Eye, MoreHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';

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
          <TableHeader>
            <TableRow>
              <TableHead>Form Name</TableHead>
              <TableHead>Target App</TableHead>
              <TableHead>Database Table</TableHead>
              <TableHead>Submissions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_FORMS.map((form) => (
              <TableRow key={form.id}>
                <TableCell>
                  <span className="font-medium text-zoru-ink">{form.name}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-zoru-ink/80">{form.app}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center text-sm text-zoru-ink/80">
                    <Database className="w-4 h-4 mr-1.5 text-zoru-ink/50" />
                    {form.table}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-zoru-ink/70">
                  {form.submissions.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      form.status === 'published' ? 'default' : 'secondary'
                    }
                  >
                    {form.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon">
                      <Eye className="w-4 h-4 text-zoru-ink/60" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Edit className="w-4 h-4 text-zoru-ink/60" />
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

'use client';

import * as React from 'react';
import {
  FileText,
  Plus,
  Database,
  Edit,
  Eye,
  MoreHorizontal,
  Inbox,
  Send,
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
  StatCard,
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
  const totalSubmissions = MOCK_FORMS.reduce((sum, f) => sum + f.submissions, 0);
  const published = MOCK_FORMS.filter((f) => f.status === 'published').length;

  return (
    <main className="20ui mx-auto max-w-[1200px] p-6 md:p-10 space-y-8">
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
            Create form
          </Button>
        </PageActions>
      </PageHeader>

      <section aria-label="Forms summary" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total forms"
          value={<span className="tabular-nums">{MOCK_FORMS.length}</span>}
          icon={FileText}
          accent="#6366f1"
        />
        <StatCard
          label="Published"
          value={<span className="tabular-nums">{published}</span>}
          icon={Send}
          accent="#16a34a"
        />
        <StatCard
          label="Submissions"
          value={<span className="tabular-nums">{totalSubmissions.toLocaleString()}</span>}
          icon={Inbox}
          accent="#0891b2"
        />
      </section>

      <Card padding="none" className="overflow-hidden">
        <Table>
          <THead>
            <Tr>
              <Th>Form name</Th>
              <Th>Target app</Th>
              <Th>Database table</Th>
              <Th align="right">Submissions</Th>
              <Th>Status</Th>
              <Th>Updated</Th>
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
                  <span className="inline-flex items-center gap-1.5 text-sm text-[var(--st-text-secondary)]">
                    <Database className="w-4 h-4" aria-hidden="true" />
                    {form.table}
                  </span>
                </Td>
                <Td align="right">
                  <span className="text-sm tabular-nums text-[var(--st-text)]">
                    {form.submissions.toLocaleString()}
                  </span>
                </Td>
                <Td>
                  <Badge
                    tone={form.status === 'published' ? 'success' : 'neutral'}
                    kind={form.status === 'published' ? 'soft' : 'outline'}
                    dot
                  >
                    {form.status === 'published' ? 'Published' : 'Draft'}
                  </Badge>
                </Td>
                <Td>
                  <span className="text-sm text-[var(--st-text-secondary)]">{form.updatedAt}</span>
                </Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <IconButton label={`Preview ${form.name}`} icon={Eye} variant="ghost" size="sm" />
                    <IconButton label={`Edit ${form.name}`} icon={Edit} variant="ghost" size="sm" />
                    <IconButton
                      label={`More actions for ${form.name}`}
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

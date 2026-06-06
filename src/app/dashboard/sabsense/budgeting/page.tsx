'use client';

import { Target } from 'lucide-react';
import {
  Card,
  CardBody,
  PageHeader,
  PageHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  EmptyState,
} from '@/components/sabcrm/20ui';

export default function BudgetingPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Budgeting</PageTitle>
          <PageDescription>Manage budgeting.</PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="primary">Create new</Button>
        </PageActions>
      </PageHeader>

      <Card className="flex flex-col overflow-hidden">
        <CardBody className="p-0">
          <EmptyState
            icon={Target}
            title="No records found"
            description="This module is currently being scaffolded."
            action={<Button variant="outline">Refresh</Button>}
          />
        </CardBody>
      </Card>
    </div>
  );
}

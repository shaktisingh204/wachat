'use client';

import { Package } from 'lucide-react';
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

export default function ABTestingPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>A/B Testing</PageTitle>
          <PageDescription>Manage A/B testing.</PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="primary">Create New</Button>
        </PageActions>
      </PageHeader>

      <Card className="overflow-hidden">
        <CardBody className="p-0">
          <EmptyState
            icon={Package}
            title="No records found"
            description="This module is currently being scaffolded."
            action={<Button variant="outline">Refresh</Button>}
          />
        </CardBody>
      </Card>
    </div>
  );
}

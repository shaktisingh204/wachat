import { Target } from 'lucide-react';
import {
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  PageHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
} from '@/components/sabcrm/20ui';

export default function AdvertiserBillingPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Advertiser Billing</PageTitle>
          <PageDescription>Manage advertiser billing.</PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="primary">Create New</Button>
        </PageActions>
      </PageHeader>

      <Card padding="none" className="overflow-hidden">
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

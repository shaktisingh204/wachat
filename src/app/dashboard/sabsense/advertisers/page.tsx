import { Target } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';

export default function AdvertisersPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Advertisers</PageTitle>
          <PageDescription>Manage advertisers.</PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="primary">Create New</Button>
        </PageActions>
      </PageHeader>

      <Card className="overflow-hidden">
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

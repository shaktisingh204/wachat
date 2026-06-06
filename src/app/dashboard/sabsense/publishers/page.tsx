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

export default function PublishersPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Publishers</PageTitle>
          <PageDescription>Manage publishers.</PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="primary">Create New</Button>
        </PageActions>
      </PageHeader>

      <Card padding="none" className="overflow-hidden">
        <CardBody>
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

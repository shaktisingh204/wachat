import { Target } from 'lucide-react';
import {
  Card,
  CardBody,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Button,
} from '@/components/sabcrm/20ui';

export default function YieldMgmtPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Yield Management</PageTitle>
          <PageDescription>Manage yield management.</PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="primary">Create new</Button>
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

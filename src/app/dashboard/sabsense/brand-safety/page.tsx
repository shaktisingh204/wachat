import { Target, RefreshCw } from 'lucide-react';
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

export default function BrandSafetyPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Brand Safety</PageTitle>
          <PageDescription>Manage brand safety.</PageDescription>
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
            action={
              <Button variant="outline" iconLeft={RefreshCw}>
                Refresh
              </Button>
            }
          />
        </CardBody>
      </Card>
    </div>
  );
}

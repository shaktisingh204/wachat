import { RefreshCw, Target } from 'lucide-react';
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

export default function CreativesPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Creatives</PageTitle>
          <PageDescription>Manage creatives.</PageDescription>
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

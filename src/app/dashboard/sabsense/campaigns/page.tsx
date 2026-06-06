import { Target, RefreshCw, Plus } from 'lucide-react';
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

export default function CampaignsPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Campaigns</PageTitle>
          <PageDescription>Manage campaigns.</PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="primary" iconLeft={Plus}>
            Create New
          </Button>
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

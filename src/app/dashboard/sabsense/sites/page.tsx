import { Target } from 'lucide-react';
import {
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
} from '@/components/sabcrm/20ui';

export default function SitesPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Sites</PageTitle>
          <PageDescription>Manage sites.</PageDescription>
        </PageHeaderHeading>
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

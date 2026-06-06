import { Package } from 'lucide-react';
import { Card, CardBody, CardDescription, CardTitle, PageHeader, PageHeading, PageTitle, PageDescription, Button } from '@/components/sabcrm/20ui/compat';

export default function StoreCreditPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader>
          <PageHeading>
            <PageTitle>Store Credit</PageTitle>
            <PageDescription>Manage store credit.</PageDescription>
          </PageHeading>
        </PageHeader>
        <div className="flex items-center gap-2">
          <Button>Create New</Button>
        </div>
      </div>

      <Card className="flex flex-col overflow-hidden">
        <CardBody className="p-0">
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)] mb-4">
              <Package className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">No records found</CardTitle>
            <CardDescription className="max-w-sm mt-2">
              This module is currently being scaffolded.
            </CardDescription>
            <Button variant="outline" className="mt-6">Refresh</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

import { Bolt } from 'lucide-react';
import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
  Button
} from '@/components/zoruui';

export default function IntegrationsPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Integrations</ZoruPageTitle>
            <ZoruPageDescription>Connect SabCheckout with 3rd party tools.</ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>
        <div className="flex items-center gap-2">
          <Button>Create New</Button>
        </div>
      </div>

      <Card className="flex flex-col overflow-hidden">
        <ZoruCardContent className="p-0">
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted mb-4">
              <Bolt className="h-6 w-6" />
            </div>
            <ZoruCardTitle className="text-lg">No integrations found</ZoruCardTitle>
            <ZoruCardDescription className="max-w-sm mt-2">
              This module is currently being scaffolded. You can build out this feature next!
            </ZoruCardDescription>
            <Button variant="outline" className="mt-6">Refresh</Button>
          </div>
        </ZoruCardContent>
      </Card>
    </div>
  );
}

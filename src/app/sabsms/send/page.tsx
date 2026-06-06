import { Card, CardBody, CardDescription, CardHeader, CardTitle, PageDescription, PageHeader, PageHeading, PageTitle } from '@/components/sabcrm/20ui/compat';

import { SabsmsSendComposer } from "./composer";

export const dynamic = "force-dynamic";

export default function SabsmsSendPage() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Send a message</PageTitle>
          <PageDescription>
            Push a one-off message through the SabSMS engine. The engine
            handles E.164 normalisation, suppression check, segment
            counting, credit reservation, and Twilio dispatch — then polls
            DLR back to this page.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Composer</CardTitle>
          <CardDescription>
            Sender resolves from the workspace default (Phase 1: from the
            engine&rsquo;s <code>SABSMS_TWILIO_DEFAULT_FROM</code> env).
            Workspace-scoped provider accounts ship in Phase 1.5.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <SabsmsSendComposer />
        </CardBody>
      </Card>
    </div>
  );
}

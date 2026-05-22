import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from "@/components/zoruui";

import { SabsmsSendComposer } from "./composer";

export const dynamic = "force-dynamic";

export default function SabsmsSendPage() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Send a message</ZoruPageTitle>
          <ZoruPageDescription>
            Push a one-off message through the SabSMS engine. The engine
            handles E.164 normalisation, suppression check, segment
            counting, credit reservation, and Twilio dispatch — then polls
            DLR back to this page.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Composer</ZoruCardTitle>
          <ZoruCardDescription>
            Sender resolves from the workspace default (Phase 1: from the
            engine&rsquo;s <code>SABSMS_TWILIO_DEFAULT_FROM</code> env).
            Workspace-scoped provider accounts ship in Phase 1.5.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <SabsmsSendComposer />
        </ZoruCardContent>
      </Card>
    </div>
  );
}

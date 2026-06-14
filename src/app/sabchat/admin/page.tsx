import {
  listAdminInboxes,
  listMacros,
  listDispositions,
} from "@/app/actions/sabchat-config.actions";
import {
  listWebhooks,
  listAuditEvents,
  listShiftRules,
  listQaRubrics,
} from "@/app/actions/sabchat-ops.actions";

import { AdminClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabchatAdminPage() {
  const [inboxesRes, macros, dispositions, webhooks, audit, shifts, rubrics] =
    await Promise.all([
      listAdminInboxes(),
      listMacros(),
      listDispositions(),
      listWebhooks(),
      listAuditEvents(),
      listShiftRules(),
      listQaRubrics(),
    ]);

  return (
    <AdminClient
      initialInboxes={inboxesRes.items}
      initialMacros={macros}
      initialDispositions={dispositions}
      initialWebhooks={webhooks}
      initialAudit={audit}
      initialShifts={shifts}
      initialRubrics={rubrics}
    />
  );
}

import {
  listAdminInboxes,
  listMacros,
  listDispositions,
} from "@/app/actions/sabchat-config.actions";

import { AdminClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabchatAdminPage() {
  const [inboxesRes, macros, dispositions] = await Promise.all([
    listAdminInboxes(),
    listMacros(),
    listDispositions(),
  ]);

  return (
    <AdminClient
      initialInboxes={inboxesRes.items}
      initialMacros={macros}
      initialDispositions={dispositions}
    />
  );
}

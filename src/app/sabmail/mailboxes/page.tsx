import { redirect } from "next/navigation";

import { getSabmailWorkspaceId } from "@/lib/sabmail/workspace";
import { isStalwartEnabled } from "@/lib/sabmail/hosted-provider";

import { listSabmailHostedMailboxes, type SabmailHostedMailboxRow } from "../accounts/hosted-actions";
import { listSabmailDomains } from "../domains/actions";
import { SabmailMailboxesClient, type VerifiedDomainOption } from "./_client";

export const dynamic = "force-dynamic";

/**
 * Hosted-mailbox management. Provisions and manages real `individual`
 * principals on the Stalwart mail server, scoped to the verified domains the
 * workspace owns. When the mail server isn't configured (`isStalwartEnabled()`
 * is false) the client renders a friendly "not set up yet" explainer instead of
 * a broken form.
 */
export default async function SabmailMailboxesPage() {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) redirect("/sabmail/projects");

  const hostedEnabled = isStalwartEnabled();

  const [mailboxesRes, domainsRes] = await Promise.all([
    listSabmailHostedMailboxes(),
    listSabmailDomains(),
  ]);

  const initialMailboxes: SabmailHostedMailboxRow[] = mailboxesRes.ok
    ? mailboxesRes.mailboxes
    : [];
  const loadError = mailboxesRes.ok ? null : mailboxesRes.error;

  // Only verified domains can host mailboxes — surface those as the picker.
  const verifiedDomains: VerifiedDomainOption[] = domainsRes.ok
    ? domainsRes.domains
        .filter((d) => d.status === "verified")
        .map((d) => ({ domain: d.domain }))
    : [];

  return (
    <SabmailMailboxesClient
      hostedEnabled={hostedEnabled}
      initialMailboxes={initialMailboxes}
      verifiedDomains={verifiedDomains}
      loadError={loadError}
    />
  );
}

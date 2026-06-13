import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";
/**
 * SabSMS contact detail — server entry.
 *
 * Resolves the `[id]` segment (canonical Mongo ObjectId or raw E.164),
 * loads the full detail bundle (thread, consent timeline, drips,
 * campaigns, custom fields, linked records, carrier), then hands the
 * payload to `<ContactDetailClient>` for the interactive surface.
 *
 * Catalog reference: `plans/sabsms-pages-catalog.md` §B.3 Page 17.
 */

import Link from "next/link";

import { Button } from '@/components/sabcrm/20ui';
import { getCachedSession } from "@/lib/server-cache";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";

import { ContactDetailClient } from "./contact-detail-client";
import { loadContactDetail } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabsmsContactDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getCachedSession();
  const user = session?.user as
    | { _id?: unknown; role?: string }
    | undefined;
  const workspaceId = (await getSabsmsWorkspaceId()) ?? "";
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  if (!workspaceId) {
    return (
      <SabsmsPageShell
        title="Contact"
        breadcrumbs={[
          { label: "Contacts", href: "/sabsms/contacts" },
          { label: "Detail" },
        ]}
      >
        <div className="text-sm text-[var(--st-text)]">
          Please sign in to see this contact.
        </div>
      </SabsmsPageShell>
    );
  }

  const decoded = decodeURIComponent(id);
  const contact = await loadContactDetail({
    workspaceId,
    contactId: decoded,
  });

  if (!contact) {
    return (
      <SabsmsPageShell
        title="Contact not found"
        breadcrumbs={[
          { label: "Contacts", href: "/sabsms/contacts" },
          { label: decoded },
        ]}
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--st-text)]">
            We could not find a contact for &ldquo;{decoded}&rdquo;. It may
            have been deleted, or the phone has not yet exchanged any
            messages with this workspace.
          </p>
          <Button asChild>
            <Link href="/sabsms/contacts">Back to contacts</Link>
          </Button>
        </div>
      </SabsmsPageShell>
    );
  }

  return (
    <SabsmsPageShell
      eyebrow="Contact"
      title={contact.name ?? contact.phone}
      description={
        <span className="font-mono text-xs text-[var(--st-text)]">
          {contact.phone} · {contact.country} · {contact.source}
        </span>
      }
      breadcrumbs={[
        { label: "Contacts", href: "/sabsms/contacts" },
        { label: contact.phone },
      ]}
      primaryAction={
        contact.conversationId
          ? {
              label: "Open in inbox",
              href: `/sabsms/inbox?conversationId=${contact.conversationId}`,
            }
          : {
              label: "Send SMS",
              href: `/sabsms/send?to=${encodeURIComponent(contact.phone)}`,
            }
      }
      secondaryActions={[
        { label: "All contacts", onSelectHref: "/sabsms/contacts" },
        { label: "Open logs", onSelectHref: "/sabsms/logs" },
      ]}
      helpTitle="Contact detail"
      helpBody={
        <>
          Everything SabSMS knows about this phone: full thread, consent log,
          engagement KPIs, drip + campaign memberships, custom fields, linked
          CRM/SabWa/Wachat handles, and GDPR controls. All mutations write to
          their respective Mongo collections or the SabSMS engine.
        </>
      }
    >
      <ContactDetailClient contact={contact} isAdmin={isAdmin} />
    </SabsmsPageShell>
  );
}

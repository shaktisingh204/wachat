/**
 * SabSMS contacts — server entry.
 *
 * Pulls the workspace id from the cached session, parses URL search
 * params into `ContactsListFilters`, hydrates the initial row set, and
 * hands the table off to `<ContactsTable>` (client). All mutations flow
 * through `./actions.ts` server actions.
 *
 * Catalog reference: `plans/sabsms-pages-catalog.md` §B.3 Page 16.
 */

import { getCachedSession } from "@/lib/server-cache";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit";

import { ContactsTable } from "./contacts-table";
import {
  loadContacts,
  type ContactConsentState,
  type ContactSource,
  type ContactsListFilters,
} from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    source?: string | string[];
    country?: string | string[];
    consent?: string | string[];
    from?: string;
    to?: string;
    page?: string;
  }>;
}

function asArray(v: string | string[] | undefined): string[] | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v : [v];
}

export default async function SabsmsContactsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await getCachedSession();
  const user = session?.user as {
    _id?: unknown;
    name?: string;
    workspaceName?: string;
  } | undefined;
  const workspaceId = String(user?._id ?? "");

  if (!workspaceId) {
    return (
      <SabsmsPageShell
        title="Contacts"
        description="Sign in to see the contacts in your SabSMS workspace."
        breadcrumbs={[{ label: "Contacts" }]}
      >
        <div className="text-sm text-[var(--st-text)]">
          Please sign in to continue.
        </div>
      </SabsmsPageShell>
    );
  }

  const page = Math.max(0, parseInt(sp.page ?? "0", 10) || 0);
  const filters: ContactsListFilters = {
    q: sp.q,
    source: asArray(sp.source) as ContactSource[] | undefined,
    country: asArray(sp.country),
    consent: asArray(sp.consent) as ContactConsentState[] | undefined,
    from: sp.from,
    to: sp.to,
    page,
    pageSize: PAGE_SIZE,
  };

  const { rows, total } = await loadContacts(workspaceId, filters);

  // Build country options from the rows actually returned — keeps the
  // facet useful even with zero canonical contacts.
  const seenCountries = new Map<string, number>();
  for (const r of rows) {
    seenCountries.set(r.country, (seenCountries.get(r.country) ?? 0) + 1);
  }
  const countryOptions = Array.from(seenCountries.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({
      value: code,
      label: `${code} (${count})`,
    }));
  // Ensure at least a couple of common entries even on cold start so the
  // facet renders interactively.
  for (const fallback of ["US", "GB", "IN", "BR", "DE"]) {
    if (!countryOptions.find((o) => o.value === fallback)) {
      countryOptions.push({ value: fallback, label: fallback });
    }
  }

  return (
    <SabsmsPageShell
      title="Contacts"
      eyebrow="People"
      description={
        <>
          The phones you can reach via SabSMS — combined from your CRM, CSV
          imports, API ingestion, and any number that has texted you.
          {total > 0 && (
            <>
              {" "}
              <span className="text-[var(--st-text)]">
                · {total.toLocaleString()} on this view
              </span>
            </>
          )}
        </>
      }
      helpTitle="What's in here?"
      helpBody={
        <>
          Contacts surface every E.164 phone associated with your workspace.
          Source, consent state, engagement score, and best send hour are
          computed from `sabsms_messages` and `sabsms_consent_log`. Bulk
          actions write to the suppression list, segments collection (Phase
          18), or the contacts doc directly.
        </>
      }
      breadcrumbs={[{ label: "Contacts" }]}
      primaryAction={{
        label: "Send SMS",
        href: "/sabsms/send",
      }}
      secondaryActions={[
        { label: "Open inbox", onSelectHref: "/sabsms/inbox" },
        { label: "Open logs", onSelectHref: "/sabsms/logs" },
        { label: "Send templates", onSelectHref: "/sabsms/templates" },
      ]}
    >
      <ContactsTable
        initialRows={rows}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        workspaceName={user?.workspaceName ?? user?.name}
        countryOptions={countryOptions}
      />
    </SabsmsPageShell>
  );
}

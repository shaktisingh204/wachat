/**
 * CRM Tickets list — `/dashboard/sabdesk`.
 *
 * Server entry point: kicks off a Rust-backed initial fetch (so the
 * first paint is server-rendered), then hands the page off to the
 * fully-interactive `<TicketsListClient>` which owns search, filters,
 * KPI strip, view switcher (table / kanban / queue), bulk actions,
 * saved-view presets, and per-row dialogs.
 *
 * §1D.1 bar: KPI strip + 13 columns + 8 filters + 3 view modes +
 * 5 saved presets + 6 bulk operations + export.
 */

import { listTickets } from "@/app/actions/crm/tickets.actions";
import { TicketsListClient } from "./_components/tickets-list-client";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const { tickets, error } = await listTickets({ page: 1, limit: 20 });
  return (
    <div className="flex w-full flex-col gap-6 p-4 md:p-6">
      <TicketsListClient initialTickets={tickets} initialError={error} />
    </div>
  );
}

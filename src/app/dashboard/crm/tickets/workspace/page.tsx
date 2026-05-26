/**
 * Helpdesk Workspace — `/dashboard/crm/tickets/workspace`.
 *
 * Zoho-Desk-style three-pane split:
 *   - Left: ticket list (search + status filter + channel badge).
 *   - Center: conversation thread + composer + internal-notes tab,
 *     plus an inline reply-template dropdown.
 *   - Right: properties panel — status / priority / assignee quick-mutate,
 *     SLA timer + breach badge, requester + classification metadata.
 *
 * Server boundary: kicks off Rust-backed initial fetch so the first paint
 * has data, then hands off to `<HelpdeskWorkspaceClient>`.
 */

export const dynamic = 'force-dynamic';

import { listTickets } from '@/app/actions/crm/tickets.actions';
import { getReplyTemplates } from '@/app/actions/crm-reply-templates.actions';

import { HelpdeskWorkspaceClient } from './_components/helpdesk-workspace-client';

export default async function HelpdeskWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ ticketId?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const { tickets, error } = await listTickets({ page: 1, limit: 50 });
  const templates = await getReplyTemplates();

  return (
    <div className="flex h-[calc(100vh-4.5rem)] w-full flex-col">
      <HelpdeskWorkspaceClient
        initialTickets={tickets}
        initialError={error}
        initialSelectedId={sp.ticketId ?? null}
        initialStatus={sp.status ?? 'all'}
        templates={templates}
      />
    </div>
  );
}

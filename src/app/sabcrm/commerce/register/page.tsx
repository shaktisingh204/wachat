/**
 * SabCRM Commerce — POS register (`/sabcrm/commerce/register`), 20ui.
 *
 * Server entry (force-dynamic, spec WI-22 §5.3). Resolves the open
 * session (the `?sessionId` param match, else the first open session;
 * none ⇒ the {@link OpenSessionCard} CTA), the initial item catalogue,
 * and — when `?holdId` is present — the held ticket + its resolved
 * customer label, then renders the ported {@link RegisterClient}.
 *
 * Every action the client calls re-runs the full session → project →
 * RBAC → plan gate; this page only fetches view-scoped data.
 */

import * as React from 'react';

import { listSabcrmPosSessions } from '@/app/actions/sabcrm-commerce.actions';
import {
  getSabcrmPosHold,
  searchSabcrmRegisterItems,
} from '@/app/actions/sabcrm-commerce-docs.actions';
import { resolveSabcrmFinanceParties } from '@/app/actions/sabcrm-finance-invoices.actions';
import { OpenSessionCard } from './_components/open-session-card';
import { RegisterClient, type RegisterPrefillHold } from './_components/register-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Register — SabCRM Commerce',
};

interface PageProps {
  searchParams: Promise<{ sessionId?: string; holdId?: string }>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmCommerceRegisterPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const sessionIdParam = first(params.sessionId);
  const holdId = first(params.holdId);

  // Resolve open sessions; pick the param match, else the first.
  const sessionsRes = await listSabcrmPosSessions({ status: 'open', limit: 20 });
  const openSessions = sessionsRes.ok ? sessionsRes.data : [];
  const session =
    (sessionIdParam
      ? openSessions.find((s) => s._id === sessionIdParam)
      : undefined) ?? openSessions[0];

  if (!session) {
    return (
      <OpenSessionCard
        error={sessionsRes.ok ? null : sessionsRes.error}
      />
    );
  }

  // Initial catalogue + (optional) hold prefill in parallel.
  const [itemsRes, holdRes] = await Promise.all([
    searchSabcrmRegisterItems('', 50),
    holdId
      ? getSabcrmPosHold(holdId)
      : Promise.resolve({ ok: false as const, error: 'no hold' }),
  ]);

  let prefillHold: RegisterPrefillHold | null = null;
  let prefillCustomer: { id: string; label: string } | null = null;
  if (holdRes.ok && holdRes.data.status === 'held') {
    const hold = holdRes.data;
    prefillHold = {
      id: hold._id,
      lineItems: hold.lineItems.map((li) => ({
        itemId: li.itemId ?? null,
        name: li.name,
        quantity: li.quantity,
        rate: li.rate,
        taxRate: li.taxRate ?? 0,
      })),
      customerId: hold.customerId ?? null,
    };
    if (hold.customerId) {
      const partyRes = await resolveSabcrmFinanceParties([hold.customerId]);
      const ref = partyRes.ok ? partyRes.data[0] : undefined;
      if (ref) prefillCustomer = { id: ref.id, label: ref.label };
    }
  }

  return (
    <RegisterClient
      session={{
        id: session._id,
        terminalId: session.terminalId,
      }}
      initialItems={
        itemsRes.ok
          ? itemsRes.data.map((it) => ({
              id: it.id,
              name: it.name,
              sku: it.sku ?? null,
              sellingPrice: it.sellingPrice,
              taxRate: it.taxRate ?? 0,
            }))
          : []
      }
      prefillHold={prefillHold}
      prefillCustomer={prefillCustomer}
    />
  );
}

/**
 * /dashboard layout — server component.
 *
 * Fetches the session server-side so the Clay chrome can render the
 * sidebar user card without a client-side flash. The actual chrome is
 * selected by DashboardChromeDispatcher, which routes Wachat-prefixed
 * paths to Clay and leaves the rest of /dashboard/* on the legacy
 * AdminLayout (for now).
 */

import React from 'react';
import { getSession } from '@/app/actions/user.actions';
import { RBACGuard } from '@/components/wabasimplify/rbac-guard';
import { DashboardChromeDispatcher } from '@/components/clay/dashboard-chrome-dispatcher';

export default async function RootDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const user = session?.user as any;

  // session.user.credits is an object keyed by channel — collapse to a
  // single total for the sidebar promo card.
  const credits = user?.credits;
  const totalCredits =
    typeof credits === 'number'
      ? credits
      : credits && typeof credits === 'object'
        ? Object.values(credits).reduce<number>(
            (sum, v) => sum + (typeof v === 'number' ? v : 0),
            0,
          )
        : 0;

  return (
    <RBACGuard>
      <DashboardChromeDispatcher
        user={{
          name: user?.name,
          email: user?.email,
          avatar: user?.image,
        }}
        plan={{
          name: user?.plan?.name,
          credits: totalCredits,
        }}
      >
        {children}
      </DashboardChromeDispatcher>
    </RBACGuard>
  );
}

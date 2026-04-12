/**
 * /home layout — the first route migrated to the Clay design system.
 *
 * Server component: checks session, redirects unauthenticated users,
 * then wraps children in the ClayDashboardLayout (Clay topbar + sidebar).
 * Zero legacy chrome.
 */

import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/app/actions/user.actions';
import { RBACGuard } from '@/components/wabasimplify/rbac-guard';
import { ClayDashboardLayout } from '@/components/clay';

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user as any;

  // session.user.credits is an object keyed by channel
  // ({ broadcast, sms, meta, email }) — collapse to a single total
  // for the sidebar promo card. Fall back to zero if missing.
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
      <ClayDashboardLayout
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
      </ClayDashboardLayout>
    </RBACGuard>
  );
}

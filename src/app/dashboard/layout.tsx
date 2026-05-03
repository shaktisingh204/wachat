/**
 * /dashboard layout — server component.
 *
 * Mounts the production dashboard chrome (`SabNodeDashboardShell`),
 * which renders the unified two-line sidebar from
 * `@/components/ui/sidebar-component` for every /dashboard/* route.
 * The shell handles session+projects bootstrap and wraps children in
 * the ProjectProvider/AdManagerProvider/ClayProjectGate stack the
 * legacy `DashboardChromeDispatcher` used to set up.
 */

import React from 'react';
import { RBACGuard } from '@/components/wabasimplify/rbac-guard';
import { SabNodeDashboardShell } from '@/components/clay/sabnode-dashboard-shell';

export default function RootDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RBACGuard>
      <SabNodeDashboardShell>{children}</SabNodeDashboardShell>
    </RBACGuard>
  );
}

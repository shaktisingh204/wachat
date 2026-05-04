/**
 * /wachat layout — server component.
 *
 * The Wachat module was relocated from `/dashboard/*` to `/wachat/*`
 * so it has its own URL space. The chrome is unchanged: it still
 * mounts `SabNodeDashboardShell` (the existing sidebar + topbar) to
 * preserve every existing surface during the move. Migrating wachat
 * routes onto the zoruui shell is a follow-up step.
 *
 * Old URLs (`/wachat/broadcasts`, etc.) keep working via the
 * redirect map in `next.config.js`.
 */

import React from "react";
import { RBACGuard } from "@/components/wabasimplify/rbac-guard";
import { SabNodeDashboardShell } from "@/components/clay/sabnode-dashboard-shell";

export default function WachatLayout({
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

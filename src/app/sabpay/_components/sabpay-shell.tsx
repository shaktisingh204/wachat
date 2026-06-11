'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { SabHomeShell } from '@/components/sabcrm/20ui';

import { buildSabpaySidebarGroups } from './sabpay-sidebar-config';

export interface SabpayShellProps {
  user?: { name?: string | null; email?: string | null; avatar?: string | null };
  plan?: { name?: string | null; credits?: number };
  children: React.ReactNode;
}

export function SabpayShell({ user, plan, children }: SabpayShellProps) {
  const pathname = usePathname();
  const groups = React.useMemo(() => buildSabpaySidebarGroups(pathname), [pathname]);

  return (
    <SabHomeShell
      user={user}
      plan={plan}
      sidebarHeading="SabPay"
      sidebarCaption={user?.name ?? user?.email ?? 'Merchant'}
      sidebarGroups={groups}
    >
      {children}
    </SabHomeShell>
  );
}

import { type SidebarGroup } from '@/components/sabcrm/20ui';
import {
  ArrowLeftRight,
  Code2,
  LayoutDashboard,
  Settings,
  Webhook,
} from 'lucide-react';

/**
 * SabPay sidebar — grouped menu configuration. All hrefs live under
 * `/sabpay/*`. Same shape as the WaChat config so the shell passes it
 * straight to `<SabHomeShell sidebarGroups={…} />`.
 */
import * as React from 'react';

export function buildSabpaySidebarGroups(
  pathname: string | null,
): SidebarGroup[] {
  const isActive = (href: string, exact = false) => {
    if (!pathname) return false;
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return [
    {
      id: 'payments',
      label: 'Payments',
      defaultOpen: true,
      items: [
        {
          id: 'overview',
          label: 'Overview',
          icon: React.createElement(LayoutDashboard),
          href: '/sabpay',
          active: isActive('/sabpay', true),
        },
        {
          id: 'payments',
          label: 'Payments',
          icon: React.createElement(ArrowLeftRight),
          href: '/sabpay/payments',
          active: isActive('/sabpay/payments'),
        },
      ],
    },
    {
      id: 'platform',
      label: 'Platform',
      defaultOpen: true,
      items: [
        {
          id: 'developers',
          label: 'Developers',
          icon: React.createElement(Code2),
          href: '/sabpay/developers',
          active: isActive('/sabpay/developers'),
        },
        {
          id: 'webhooks',
          label: 'Webhooks',
          icon: React.createElement(Webhook),
          href: '/sabpay/webhooks',
          active: isActive('/sabpay/webhooks'),
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: React.createElement(Settings),
          href: '/sabpay/settings',
          active: isActive('/sabpay/settings'),
        },
      ],
    },
  ];
}

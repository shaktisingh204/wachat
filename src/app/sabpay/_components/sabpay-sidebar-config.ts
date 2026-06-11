import type { SabSidebarGroup } from '@/components/sabcrm/20ui/composites/shell/app-sidebar';
import {
  ArrowLeftRight,
  BookOpen,
  KeyRound,
  Landmark,
  Layers,
  LayoutDashboard,
  Link2,
  Package,
  PanelsTopLeft,
  QrCode,
  ReceiptText,
  Repeat,
  Settings,
  ShieldAlert,
  Undo2,
  Users,
  Webhook,
} from 'lucide-react';

/**
 * SabPay sidebar — grouped menu configuration (Razorpay-style grouping). All
 * hrefs live under `/sabpay/*`. Same shape as the WaChat config so the shell
 * passes it straight to `<SabHomeShell sidebarGroups={…} />`.
 */
import * as React from 'react';

export function buildSabpaySidebarGroups(
  pathname: string | null,
): SabSidebarGroup[] {
  const isActive = (href: string, exact = false) => {
    if (!pathname) return false;
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return [
    {
      id: 'home',
      items: [
        {
          id: 'overview',
          label: 'Overview',
          icon: React.createElement(LayoutDashboard),
          href: '/sabpay',
          active: isActive('/sabpay', true),
        },
      ],
    },
    {
      id: 'transactions',
      label: 'Transactions',
      defaultOpen: true,
      items: [
        {
          id: 'payments',
          label: 'Payments',
          icon: React.createElement(ArrowLeftRight),
          href: '/sabpay/payments',
          active: isActive('/sabpay/payments'),
        },
        {
          id: 'orders',
          label: 'Orders',
          icon: React.createElement(Package),
          href: '/sabpay/orders',
          active: isActive('/sabpay/orders'),
        },
        {
          id: 'refunds',
          label: 'Refunds',
          icon: React.createElement(Undo2),
          href: '/sabpay/refunds',
          active: isActive('/sabpay/refunds'),
        },
        {
          id: 'settlements',
          label: 'Settlements',
          icon: React.createElement(Landmark),
          href: '/sabpay/settlements',
          active: isActive('/sabpay/settlements'),
        },
        {
          id: 'disputes',
          label: 'Disputes',
          icon: React.createElement(ShieldAlert),
          href: '/sabpay/disputes',
          active: isActive('/sabpay/disputes'),
        },
      ],
    },
    {
      id: 'commerce',
      label: 'Commerce',
      defaultOpen: true,
      items: [
        {
          id: 'payment-links',
          label: 'Payment Links',
          icon: React.createElement(Link2),
          href: '/sabpay/payment-links',
          active: isActive('/sabpay/payment-links'),
        },
        {
          id: 'payment-pages',
          label: 'Payment Pages',
          icon: React.createElement(PanelsTopLeft),
          href: '/sabpay/payment-pages',
          active: isActive('/sabpay/payment-pages'),
        },
        {
          id: 'qr-codes',
          label: 'QR Codes',
          icon: React.createElement(QrCode),
          href: '/sabpay/qr-codes',
          active: isActive('/sabpay/qr-codes'),
        },
        {
          id: 'invoices',
          label: 'Invoices',
          icon: React.createElement(ReceiptText),
          href: '/sabpay/invoices',
          active: isActive('/sabpay/invoices'),
        },
      ],
    },
    {
      id: 'billing',
      label: 'Billing',
      items: [
        {
          id: 'plans',
          label: 'Plans',
          icon: React.createElement(Layers),
          href: '/sabpay/plans',
          active: isActive('/sabpay/plans'),
        },
        {
          id: 'subscriptions',
          label: 'Subscriptions',
          icon: React.createElement(Repeat),
          href: '/sabpay/subscriptions',
          active: isActive('/sabpay/subscriptions'),
        },
      ],
    },
    {
      id: 'customers',
      label: 'Customers',
      items: [
        {
          id: 'customers',
          label: 'Customers',
          icon: React.createElement(Users),
          href: '/sabpay/customers',
          active: isActive('/sabpay/customers'),
        },
      ],
    },
    {
      id: 'developers',
      label: 'Developers',
      items: [
        {
          id: 'api-keys',
          label: 'API Keys',
          icon: React.createElement(KeyRound),
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
          id: 'docs',
          label: 'Docs',
          icon: React.createElement(BookOpen),
          href: '/sabpay/docs',
          active: isActive('/sabpay/docs'),
        },
      ],
    },
    {
      id: 'settings',
      label: 'Settings',
      items: [
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

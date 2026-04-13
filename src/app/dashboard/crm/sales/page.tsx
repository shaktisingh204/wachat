import {
  Handshake,
  Users,
  MessageSquareQuote,
  FileText,
  Receipt,
  FileCheck,
  ShoppingCart,
  Truck,
  FileMinus,
  Columns3,
  ClipboardList,
} from 'lucide-react';

import { CrmModuleOverview } from '../_components/crm-module-overview';

export default function SalesOverviewPage() {
  return (
    <CrmModuleOverview
      title="Sales"
      subtitle="The full sales workflow — clients, quotations, orders, invoices, receipts, and pipelines."
      icon={Handshake}
      sections={[
        {
          href: '/dashboard/crm/sales/clients',
          label: 'Clients & Prospects',
          description: 'Manage the customer pipeline from prospect to signed deal.',
          icon: Users,
        },
        {
          href: '/dashboard/crm/sales/quotations',
          label: 'Quotations',
          description: 'Draft, send, and track quotations sent to prospects.',
          icon: MessageSquareQuote,
        },
        {
          href: '/dashboard/crm/sales/proforma',
          label: 'Proforma Invoices',
          description: 'Issue proforma invoices before confirming a sale.',
          icon: FileText,
        },
        {
          href: '/dashboard/crm/sales/orders',
          label: 'Sales Orders',
          description: 'Confirmed orders ready for fulfilment.',
          icon: ShoppingCart,
        },
        {
          href: '/dashboard/crm/sales/delivery',
          label: 'Delivery Challans',
          description: 'Track dispatches and delivery notes.',
          icon: Truck,
        },
        {
          href: '/dashboard/crm/sales/invoices',
          label: 'Invoices',
          description: 'GST-ready invoices linked to orders and deliveries.',
          icon: Receipt,
        },
        {
          href: '/dashboard/crm/sales/receipts',
          label: 'Payment Receipts',
          description: 'Acknowledge payments received against invoices.',
          icon: FileCheck,
        },
        {
          href: '/dashboard/crm/sales/credit-notes',
          label: 'Credit Notes',
          description: 'Issue credit notes for returns or adjustments.',
          icon: FileMinus,
        },
        {
          href: '/dashboard/crm/sales/pipelines',
          label: 'Sales Pipelines',
          description: 'Visualize deals across the sales funnel.',
          icon: Columns3,
        },
        {
          href: '/dashboard/crm/sales/forms',
          label: 'Sales Forms',
          description: 'Capture leads through embeddable forms.',
          icon: ClipboardList,
        },
      ]}
    />
  );
}

import { ZoruCard, ZoruPageDescription, ZoruPageHeader, ZoruPageHeading, ZoruPageTitle } from '@/components/zoruui';
import {
  ArrowUpRight,
  Building2,
  Contact,
  FileSignature,
  Ticket,
  FileMinus,
  Truck,
  FileQuestion,
  FileText,
  ClipboardList,
  Gift,
  FileSpreadsheet,
  Heart,
  ShoppingCart,
  Banknote,
  GitBranch,
  FileEdit,
  Megaphone,
  ScrollText,
  Quote,
  Receipt,
  Repeat,
  Calendar,
  } from 'lucide-react';

/**
 * Sales module overview — tile grid linking every sub-feature.
 *
 * Was a `redirect('/dashboard/crm/sales/clients')` shim. Now serves a
 * proper landing page so users can navigate the whole sales surface
 * from one place.
 */

import Link from 'next/link';

interface NavTile {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tiles: NavTile[] = [
  { href: '/dashboard/crm/sales/clients', title: 'Clients', description: 'Customer accounts and their billing relationships.', icon: Building2 },
  { href: '/dashboard/crm/sales/contacts', title: 'Contacts', description: 'People connected to your client accounts.', icon: Contact },
  { href: '/dashboard/crm/sales/quotations', title: 'Quotations', description: 'Price quotes you have sent to prospects.', icon: Quote },
  { href: '/dashboard/crm/sales/proposals', title: 'Proposals', description: 'Detailed proposals with deliverables and pricing.', icon: FileText },
  { href: '/dashboard/crm/sales/estimate-requests', title: 'Estimate Requests', description: 'Inbound requests for estimates from prospects.', icon: FileQuestion },
  { href: '/dashboard/crm/sales/estimates-templates', title: 'Estimate Templates', description: 'Reusable templates for estimates and proposals.', icon: FileSpreadsheet },
  { href: '/dashboard/crm/sales/orders', title: 'Sales Orders', description: 'Confirmed orders awaiting delivery.', icon: ShoppingCart },
  { href: '/dashboard/crm/sales/invoices', title: 'Invoices', description: 'Outgoing invoices and their payment status.', icon: Receipt },
  { href: '/dashboard/crm/sales/proforma', title: 'Proforma Invoices', description: 'Preliminary invoices issued before delivery.', icon: FileEdit },
  { href: '/dashboard/crm/sales/recurring-invoices', title: 'Recurring Invoices', description: 'Subscription-style invoices billed on a schedule.', icon: Repeat },
  { href: '/dashboard/crm/sales/subscriptions', title: 'Subscriptions', description: 'Recurring customer subscriptions.', icon: Calendar },
  { href: '/dashboard/crm/sales/payments', title: 'Payments', description: 'Money received against invoices.', icon: Banknote },
  { href: '/dashboard/crm/sales/receipts', title: 'Receipts', description: 'Acknowledgements of received payments.', icon: ScrollText },
  { href: '/dashboard/crm/sales/credit-notes', title: 'Credit Notes', description: 'Refunds and corrections issued to clients.', icon: FileMinus },
  { href: '/dashboard/crm/sales/delivery', title: 'Delivery', description: 'Outbound shipments and delivery challans.', icon: Truck },
  { href: '/dashboard/crm/sales/contracts', title: 'Contracts', description: 'Service or supply contracts you have signed.', icon: FileSignature },
  { href: '/dashboard/crm/sales/pipelines', title: 'Pipelines', description: 'Sales pipelines and their stages.', icon: GitBranch },
  { href: '/dashboard/crm/sales/forms', title: 'Forms', description: 'Public lead-capture forms.', icon: ClipboardList },
  { href: '/dashboard/crm/sales/coupons', title: 'Coupons', description: 'Discount codes available to customers.', icon: Ticket },
  { href: '/dashboard/crm/sales/promotions', title: 'Promotions', description: 'Active marketing promotions and offers.', icon: Megaphone },
  { href: '/dashboard/crm/sales/gift-cards', title: 'Gift Cards', description: 'Stored-value gift cards.', icon: Gift },
  { href: '/dashboard/crm/sales/loyalty', title: 'Loyalty', description: 'Loyalty program members and points.', icon: Heart },
];

export default function CrmSalesHubPage() {
  return (
    <div className="flex min-h-full flex-col gap-6 p-4 sm:p-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Sales</ZoruPageTitle>
          <ZoruPageDescription>
            Everything from lead-to-cash — quotations, orders, invoices, payments, contracts, and more.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.href} href={tile.href} className="group">
              <ZoruCard className="h-full p-5 transition-shadow group-hover:shadow-[var(--zoru-shadow-md)]">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-medium text-zoru-ink">{tile.title}</p>
                  <ArrowUpRight className="h-4 w-4 text-zoru-ink-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zoru-ink" />
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-zoru-ink-muted">
                  {tile.description}
                </p>
              </ZoruCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

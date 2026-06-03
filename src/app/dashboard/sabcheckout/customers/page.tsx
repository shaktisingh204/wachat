/**
 * SabCheckout customers index — `/dashboard/sabcheckout/customers`.
 *
 * Recurring-customer roll-up: one row per (page, external customer)
 * pair created during the subscription confirm path.
 */
import { Users, Search, Filter, Mail, Phone, ExternalLink, Download } from 'lucide-react';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
  Input,
  Badge,
} from '@/components/zoruui';

import { listSabcheckoutCustomers } from '@/app/actions/sabcheckout.actions';

export const dynamic = 'force-dynamic';

export default async function SabcheckoutCustomersPage() {
  const res = await listSabcheckoutCustomers({ limit: 100 });

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Customers</ZoruPageTitle>
            <ZoruPageDescription>
              Recurring customers indexed across all your payment pages.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {!res.ok ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Couldn't load customers</ZoruCardTitle>
            <ZoruCardDescription>{res.error}</ZoruCardDescription>
          </ZoruCardHeader>
        </Card>
      ) : (
        <Card className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-zoru-line bg-zoru-surface p-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
                <Input
                  type="search"
                  placeholder="Search customers by name or email..."
                  className="w-80 pl-9"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
            </div>
          </div>
          
          <ZoruCardContent className="p-0">
            {res.data.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted mb-4">
                  <Users className="h-6 w-6" />
                </div>
                <ZoruCardTitle className="text-lg">No recurring customers yet</ZoruCardTitle>
                <ZoruCardDescription className="max-w-sm mt-2">
                  When users subscribe via your payment pages, they will appear here.
                </ZoruCardDescription>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zoru-surface-hover/50 text-zoru-ink-subtle uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 font-medium">Customer</th>
                      <th className="px-6 py-3 font-medium">Contact</th>
                      <th className="px-6 py-3 font-medium">Subscriptions</th>
                      <th className="px-6 py-3 font-medium">Joined</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zoru-line">
                    {res.data.items.map((c) => (
                      <tr
                        key={c._id}
                        className="group hover:bg-zoru-surface-hover/30 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zoru-surface-2 font-medium text-zoru-ink">
                              {(c.name ?? c.email)[0].toUpperCase()}
                            </div>
                            <span className="font-medium text-zoru-ink">
                              {c.name ?? c.email}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1 text-xs text-zoru-ink-muted">
                            <span className="flex items-center gap-1.5">
                              <Mail className="h-3 w-3" />
                              {c.email}
                            </span>
                            {c.phone && (
                              <span className="flex items-center gap-1.5">
                                <Phone className="h-3 w-3" />
                                {c.phone}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant="secondary" className="font-mono">
                            {c.subscriptionIds?.length ?? 0} active
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-zoru-ink-muted">
                          {c.createdAt
                            ? new Date(c.createdAt).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            View Details <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ZoruCardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * SabCheckout customers index — `/dashboard/sabcheckout/customers`.
 *
 * Recurring-customer roll-up: one row per (page, external customer)
 * pair created during the subscription confirm path.
 */
import { Users, Search, Filter, Mail, Phone, ExternalLink, Download } from 'lucide-react';

import { Button, Card, CardBody, CardDescription, CardHeader, CardTitle, PageHeader, PageHeading, PageTitle, PageDescription, Input, Badge } from '@/components/sabcrm/20ui/compat';

import { listSabcheckoutCustomers } from '@/app/actions/sabcheckout.actions';

export const dynamic = 'force-dynamic';

export default async function SabcheckoutCustomersPage() {
  const res = await listSabcheckoutCustomers({ limit: 100 });

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader>
          <PageHeading>
            <PageTitle>Customers</PageTitle>
            <PageDescription>
              Recurring customers indexed across all your payment pages.
            </PageDescription>
          </PageHeading>
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
          <CardHeader>
            <CardTitle>Couldn't load customers</CardTitle>
            <CardDescription>{res.error}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
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
          
          <CardBody className="p-0">
            {res.data.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)] mb-4">
                  <Users className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg">No recurring customers yet</CardTitle>
                <CardDescription className="max-w-sm mt-2">
                  When users subscribe via your payment pages, they will appear here.
                </CardDescription>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--st-hover)]/50 text-[var(--st-text-tertiary)] uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 font-medium">Customer</th>
                      <th className="px-6 py-3 font-medium">Contact</th>
                      <th className="px-6 py-3 font-medium">Subscriptions</th>
                      <th className="px-6 py-3 font-medium">Joined</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--st-border)]">
                    {res.data.items.map((c) => (
                      <tr
                        key={c._id}
                        className="group hover:bg-[var(--st-hover)]/30 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--st-bg-muted)] font-medium text-[var(--st-text)]">
                              {(c.name ?? c.email)[0].toUpperCase()}
                            </div>
                            <span className="font-medium text-[var(--st-text)]">
                              {c.name ?? c.email}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1 text-xs text-[var(--st-text-secondary)]">
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
                        <td className="px-6 py-4 whitespace-nowrap text-[var(--st-text-secondary)]">
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
          </CardBody>
        </Card>
      )}
    </div>
  );
}

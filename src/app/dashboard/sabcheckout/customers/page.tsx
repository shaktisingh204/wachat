/**
 * SabCheckout customers index - `/dashboard/sabcheckout/customers`.
 *
 * Recurring-customer roll-up: one row per (page, external customer)
 * pair created during the subscription confirm path.
 */
import { Users, Search, Filter, Mail, Phone, ExternalLink, Download } from 'lucide-react';

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  PageHeader,
  PageHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Field,
  Input,
  Badge,
  EmptyState,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';

import { listSabcheckoutCustomers } from '@/app/actions/sabcheckout.actions';

export const dynamic = 'force-dynamic';

export default async function SabcheckoutCustomersPage() {
  const res = await listSabcheckoutCustomers({ limit: 100 });

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>Customers</PageTitle>
          <PageDescription>
            Recurring customers indexed across all your payment pages.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" iconLeft={Download}>
            Export CSV
          </Button>
        </PageActions>
      </PageHeader>

      {!res.ok ? (
        <Card>
          <CardHeader>
            <CardTitle>Couldn&apos;t load customers</CardTitle>
            <CardDescription>{res.error}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card padding="none" className="flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
            <Field label="Search customers" className="w-80 max-w-full">
              <Input
                type="search"
                iconLeft={Search}
                placeholder="Search by name or email"
              />
            </Field>
            <Button variant="outline" size="sm" iconLeft={Filter}>
              Filter
            </Button>
          </div>

          <CardBody className="p-0">
            {res.data.items.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No recurring customers yet"
                description="When users subscribe via your payment pages, they will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <Tr>
                      <Th>Customer</Th>
                      <Th>Contact</Th>
                      <Th>Subscriptions</Th>
                      <Th>Joined</Th>
                      <Th align="right">Actions</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {res.data.items.map((c) => (
                      <Tr key={c._id} className="group">
                        <Td>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] font-medium text-[var(--st-text)]">
                              {(c.name ?? c.email)[0].toUpperCase()}
                            </div>
                            <span className="font-medium text-[var(--st-text)]">
                              {c.name ?? c.email}
                            </span>
                          </div>
                        </Td>
                        <Td>
                          <div className="flex flex-col gap-1 text-xs text-[var(--st-text-secondary)]">
                            <span className="flex items-center gap-1.5">
                              <Mail className="h-3 w-3" aria-hidden="true" />
                              {c.email}
                            </span>
                            {c.phone && (
                              <span className="flex items-center gap-1.5">
                                <Phone className="h-3 w-3" aria-hidden="true" />
                                {c.phone}
                              </span>
                            )}
                          </div>
                        </Td>
                        <Td>
                          <Badge variant="secondary">
                            {c.subscriptionIds?.length ?? 0} active
                          </Badge>
                        </Td>
                        <Td className="text-[var(--st-text-secondary)]">
                          {c.createdAt
                            ? new Date(c.createdAt).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'Unknown'}
                        </Td>
                        <Td align="right">
                          <Button
                            variant="ghost"
                            size="sm"
                            iconRight={ExternalLink}
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            View Details
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

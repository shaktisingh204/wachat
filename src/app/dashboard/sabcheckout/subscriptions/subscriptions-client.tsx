'use client';

import { useRouter } from 'next/navigation';
import { Repeat, Search, Filter, MoreHorizontal, ExternalLink, CalendarClock, Ban } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  IconButton,
  Input,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useToast,
} from '@/components/sabcrm/20ui';

import { cancelSabcheckoutSubscription } from '@/app/actions/sabcheckout.actions';
import type { SabcheckoutSubscriptionDoc } from '@/lib/rust-client/sabcheckout-subscriptions';

export function SubscriptionsClient({
  initial,
}: {
  initial: SabcheckoutSubscriptionDoc[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  async function onCancel(id: string) {
    if (!confirm('Cancel this subscription?')) return;
    const res = await cancelSabcheckoutSubscription(id);
    if (!res.ok) {
      toast.error({ title: 'Cancel failed', description: res.error });
      return;
    }
    toast.success('Subscription cancelled successfully');
    router.refresh();
  }

  return (
    <Card padding="none" className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
        <div className="flex w-80 items-center gap-2">
          <Input
            type="search"
            aria-label="Search subscriptions by customer or plan ID"
            placeholder="Search by customer or plan ID..."
            iconLeft={Search}
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" iconLeft={Filter}>
            Filter by Status
          </Button>
        </div>
      </div>

      <CardBody className="p-0">
        {initial.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="No subscriptions yet"
            description="Active subscriptions from your recurring payment plans will show up here."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <Tr>
                  <Th>Customer and Plan</Th>
                  <Th>Status</Th>
                  <Th>Billing Period</Th>
                  <Th>Provider ID</Th>
                  <Th align="right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {initial.map((s) => (
                  <Tr key={s._id} className="group">
                    <Td>
                      <div className="flex flex-col">
                        <span className="flex items-center gap-2 font-medium text-[var(--st-text)]">
                          {s.customerId}
                          <ExternalLink className="h-3 w-3 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                        </span>
                        <span className="mt-0.5 text-[13px] text-[var(--st-text-secondary)]">
                          Plan: {s.planId}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          s.status === 'active'
                            ? 'success'
                            : s.status === 'cancelled'
                              ? 'danger'
                              : 'neutral'
                        }
                        className="capitalize"
                      >
                        {s.status}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {new Date(s.currentPeriodStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' - '}
                          {new Date(s.currentPeriodEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <span className="rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] px-2 py-1 font-mono text-[11px] text-[var(--st-text-secondary)]">
                        {s.providerSubscriptionId ?? 'N/A'}
                      </span>
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton label="Open menu" icon={MoreHorizontal} size="sm" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>View Customer</DropdownMenuItem>
                            {s.status !== 'cancelled' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="danger"
                                  iconLeft={Ban}
                                  onClick={() => onCancel(s._id)}
                                >
                                  Cancel Subscription
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

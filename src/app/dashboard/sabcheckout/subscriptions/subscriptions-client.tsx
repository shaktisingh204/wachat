'use client';

import { useRouter } from 'next/navigation';
import { XCircle, Repeat, Search, Filter, MoreHorizontal, ExternalLink, CalendarClock, Ban } from 'lucide-react';

import { Badge, Button, Card, CardBody, useToast, Input, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/sabcrm/20ui';

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
      toast({ title: 'Cancel failed', description: res.error });
      return;
    }
    toast({ title: 'Subscription cancelled successfully' });
    router.refresh();
  }

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
            <Input
              type="search"
              placeholder="Search by customer or plan ID..."
              className="w-80 pl-9"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filter by Status
          </Button>
        </div>
      </div>
          
      <CardBody className="p-0">
        {initial.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)] mb-4">
              <Repeat className="h-6 w-6" />
            </div>
            <p className="text-lg font-semibold text-[var(--st-text)]">No subscriptions yet</p>
            <p className="text-sm text-[var(--st-text-secondary)] mt-2 max-w-sm">
              Active subscriptions from your recurring payment plans will show up here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--st-hover)]/50 text-[var(--st-text-tertiary)] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 font-medium">Customer & Plan</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Billing Period</th>
                  <th className="px-6 py-3 font-medium">Provider ID</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--st-border)]">
                {initial.map((s) => (
                  <tr
                    key={s._id}
                    className="group hover:bg-[var(--st-hover)]/30 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-[var(--st-text)] flex items-center gap-2">
                          {s.customerId}
                          <ExternalLink className="h-3 w-3 text-[var(--st-text-tertiary)]" />
                        </span>
                        <span className="text-[13px] text-[var(--st-text-secondary)] mt-0.5">
                          Plan: {s.planId}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        variant={
                          s.status === 'active'
                            ? 'default'
                            : s.status === 'cancelled'
                              ? 'destructive'
                              : 'secondary'
                        }
                        className="capitalize h-5 text-[11px]"
                      >
                        {s.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                        <CalendarClock className="h-3.5 w-3.5" />
                        <span>
                          {new Date(s.currentPeriodStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' - '}
                          {new Date(s.currentPeriodEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-[11px] font-mono text-[var(--st-text-secondary)] bg-[var(--st-bg-muted)] px-2 py-1 rounded">
                        {s.providerSubscriptionId ?? 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>View Customer</DropdownMenuItem>
                            {s.status !== 'cancelled' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-[var(--st-danger)] focus:text-[var(--st-danger)]"
                                  onClick={() => onCancel(s._id)}
                                >
                                  <Ban className="mr-2 h-4 w-4" /> Cancel Subscription
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * Subscription detail page.
 *
 * Server component sibling of the quotation detail PoC. Renders the
 * subscription header (plan, customer, frequency, status, next billing,
 * started-at), the items table, an optional dunning ladder summary,
 * and a right-side history timeline (last 10 events).
 *
 * Subscriptions are NOT part of the §13.5 quote -> invoice -> payment
 * lineage chain, so we deliberately do not render <LineageRail>.
 *
 * Loader: imports `getSubscriptionById` from `@/app/actions/crm-subscriptions.actions`.
 * That action module does not exist yet — the integrator is expected to
 * add it. Until then this page will fail to compile, which is intentional
 * (the integrator wires the loader, the page renders).
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Repeat, Pencil, PauseCircle, XCircle } from 'lucide-react';

import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
// NOTE: integrator must add this action module. Stub signature expected:
//   export async function getSubscriptionById(id: string): Promise<Subscription | null>
// where Subscription is shaped like the type below (loosely; we render
// defensively).
import { getSubscriptionById } from '@/app/actions/crm-subscriptions.actions';
import { getCrmAccountById } from '@/app/actions/crm-accounts.actions';

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtDateTime(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function fmtMoney(n: number, currency = 'INR'): string {
    try {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(n || 0);
    } catch {
        return `${currency} ${n || 0}`;
    }
}

const STATUS_VARIANT: Record<string, 'ghost' | 'success' | 'warning' | 'danger'> = {
    active: 'success',
    paused: 'warning',
    cancelled: 'danger',
    past_due: 'danger',
    completed: 'ghost',
    Active: 'success',
    Paused: 'warning',
    Cancelled: 'danger',
    PastDue: 'danger',
    Completed: 'ghost',
};

interface SubscriptionItem {
    id?: string;
    itemId?: string;
    productId?: string;
    name?: string;
    description?: string;
    quantity?: number;
    qty?: number;
    rate?: number;
    priceCents?: number;
    currency?: string;
}

interface DunningStep {
    step?: number;
    offsetDays?: number;
    action?: string;
    template?: string;
    sentAt?: string;
}

interface SubscriptionEvent {
    kind?: string;
    type?: string;
    at?: string;
    createdAt?: string;
    note?: string;
}

interface SubscriptionLike {
    _id?: unknown;
    planName?: string;
    name?: string;
    accountId?: unknown;
    customerId?: unknown;
    frequency?: string;
    interval?: string;
    intervalCount?: number;
    status?: string;
    nextBillingAt?: string;
    startsAt?: string;
    currency?: string;
    items?: SubscriptionItem[];
    lineItems?: SubscriptionItem[];
    dunning?: { ladder?: DunningStep[]; currentStep?: number; lastAttemptAt?: string };
    history?: SubscriptionEvent[];
    events?: SubscriptionEvent[];
}

function frequencyLabel(sub: SubscriptionLike): string {
    if (sub.frequency) return sub.frequency;
    if (sub.interval) {
        const n = sub.intervalCount && sub.intervalCount > 1 ? sub.intervalCount : 1;
        return n === 1 ? `Every ${sub.interval}` : `Every ${n} ${sub.interval}s`;
    }
    return '—';
}

export default async function SubscriptionDetailPage({
    params,
}: {
    params: Promise<{ subscriptionId: string }>;
}) {
    const { subscriptionId } = await params;
    const subscription = (await getSubscriptionById(subscriptionId)) as SubscriptionLike | null;

    if (!subscription) {
        notFound();
    }

    const id = (subscription._id as any)?.toString?.() ?? String(subscription._id);
    const accountId = subscription.accountId
        ? ((subscription.accountId as any)?.toString?.() ?? String(subscription.accountId))
        : subscription.customerId
            ? ((subscription.customerId as any)?.toString?.() ?? String(subscription.customerId))
            : '';
    const account = accountId ? await getCrmAccountById(accountId) : null;
    const customerName =
        (account as any)?.displayName ?? (account as any)?.name ?? '(unknown customer)';

    const planName = subscription.planName || subscription.name || 'Subscription';
    const status = subscription.status ?? 'unknown';
    const items = subscription.items ?? subscription.lineItems ?? [];
    const dunningLadder = subscription.dunning?.ladder ?? [];
    const events = (subscription.history ?? subscription.events ?? []).slice(0, 10);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={planName}
                subtitle="Subscription detail"
                icon={Repeat}
                actions={
                    <Link href="/dashboard/crm/sales/subscriptions">
                        <ZoruButton variant="outline">
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </ZoruButton>
                    </Link>
                }
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
                <div className="flex flex-col gap-6">
                    <ZoruCard className="p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className="text-[16px] text-zoru-ink">{planName}</h2>
                                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                                    Started {fmtDate(subscription.startsAt)}
                                    {subscription.nextBillingAt
                                        ? ` • Next billing ${fmtDate(subscription.nextBillingAt)}`
                                        : ''}
                                </p>
                            </div>
                            <ZoruBadge variant={STATUS_VARIANT[status] ?? 'ghost'}>
                                {status}
                            </ZoruBadge>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
                            <div>
                                <div className="text-zoru-ink-muted">Customer</div>
                                <div className="text-zoru-ink">{customerName}</div>
                            </div>
                            <div>
                                <div className="text-zoru-ink-muted">Frequency</div>
                                <div className="text-zoru-ink">{frequencyLabel(subscription)}</div>
                            </div>
                            <div>
                                <div className="text-zoru-ink-muted">Started</div>
                                <div className="text-zoru-ink">{fmtDate(subscription.startsAt)}</div>
                            </div>
                            <div>
                                <div className="text-zoru-ink-muted">Next billing</div>
                                <div className="text-zoru-ink">{fmtDate(subscription.nextBillingAt)}</div>
                            </div>
                        </div>

                        {items.length > 0 && (
                            <div className="mt-6 overflow-x-auto rounded-lg border border-zoru-line">
                                <table className="w-full text-sm">
                                    <thead className="bg-zoru-surface-2">
                                        <tr className="border-b border-zoru-line">
                                            <th className="p-3 text-left text-zoru-ink">Item</th>
                                            <th className="p-3 text-right text-zoru-ink">Qty</th>
                                            <th className="p-3 text-right text-zoru-ink">Rate</th>
                                            <th className="p-3 text-right text-zoru-ink">Currency</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((it, idx) => {
                                            const itemKey =
                                                it.id ??
                                                it.itemId ??
                                                it.productId ??
                                                `item-${idx}`;
                                            const itemId =
                                                it.itemId ?? it.id ?? it.productId ?? '—';
                                            const qty = it.qty ?? it.quantity ?? 0;
                                            const rate =
                                                it.rate ??
                                                (typeof it.priceCents === 'number'
                                                    ? it.priceCents / 100
                                                    : 0);
                                            const itemCurrency =
                                                it.currency ?? subscription.currency ?? 'INR';
                                            return (
                                                <tr
                                                    key={itemKey}
                                                    className="border-b border-zoru-line last:border-b-0"
                                                >
                                                    <td className="p-3 text-zoru-ink">
                                                        <div className="font-mono text-[12px]">
                                                            {String(itemId)}
                                                        </div>
                                                        {it.name && (
                                                            <div className="text-[11.5px] text-zoru-ink-muted">
                                                                {it.name}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-right text-zoru-ink">{qty}</td>
                                                    <td className="p-3 text-right text-zoru-ink">
                                                        {fmtMoney(rate, itemCurrency)}
                                                    </td>
                                                    <td className="p-3 text-right text-zoru-ink">
                                                        {itemCurrency}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {dunningLadder.length > 0 && (
                            <div className="mt-4 rounded-md border border-zoru-line bg-zoru-surface-2 p-3">
                                <div className="text-[11.5px] text-zoru-ink-muted">
                                    Dunning ladder
                                    {typeof subscription.dunning?.currentStep === 'number'
                                        ? ` • current step ${subscription.dunning.currentStep}`
                                        : ''}
                                    {subscription.dunning?.lastAttemptAt
                                        ? ` • last attempt ${fmtDate(
                                              subscription.dunning.lastAttemptAt,
                                          )}`
                                        : ''}
                                </div>
                                <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-zoru-ink">
                                    {dunningLadder.map((step, i) => (
                                        <li key={i}>
                                            <span className="text-zoru-ink">
                                                {step.action ?? step.template ?? `Step ${step.step ?? i + 1}`}
                                            </span>
                                            {typeof step.offsetDays === 'number' && (
                                                <span className="text-zoru-ink-muted">
                                                    {' '}
                                                    • +{step.offsetDays}d
                                                </span>
                                            )}
                                            {step.sentAt && (
                                                <span className="text-zoru-ink-muted">
                                                    {' '}
                                                    • sent {fmtDate(step.sentAt)}
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        <div className="mt-6 flex flex-wrap items-center gap-2">
                            <Link href={`/dashboard/crm/sales/subscriptions/${id}/edit`}>
                                <ZoruButton variant="outline">
                                    <Pencil className="h-4 w-4" />
                                    Edit
                                </ZoruButton>
                            </Link>
                            <form
                                action={`/api/crm/subscriptions/${id}/pause`}
                                method="post"
                            >
                                <ZoruButton type="submit" variant="outline">
                                    <PauseCircle className="h-4 w-4" />
                                    Pause
                                </ZoruButton>
                            </form>
                            <form
                                action={`/api/crm/subscriptions/${id}/cancel`}
                                method="post"
                            >
                                <ZoruButton type="submit" variant="outline">
                                    <XCircle className="h-4 w-4" />
                                    Cancel
                                </ZoruButton>
                            </form>
                        </div>
                    </ZoruCard>
                </div>

                <div className="flex flex-col gap-6">
                    <ZoruCard className="p-4">
                        <div className="text-[12.5px] text-zoru-ink-muted">History</div>
                        <div className="mt-1 text-[11.5px] text-zoru-ink-muted">
                            Last {events.length} event{events.length === 1 ? '' : 's'}
                        </div>
                        {events.length === 0 ? (
                            <div className="mt-3 text-[13px] text-zoru-ink-muted">
                                No history yet.
                            </div>
                        ) : (
                            <ul className="mt-3 space-y-2 text-[13px] text-zoru-ink">
                                {events.map((ev, i) => {
                                    const kind = ev.kind ?? ev.type ?? 'event';
                                    const at = ev.at ?? ev.createdAt;
                                    return (
                                        <li
                                            key={i}
                                            className="rounded-md border border-zoru-line bg-zoru-surface-2 px-2.5 py-1.5"
                                        >
                                            <span className="font-medium text-zoru-ink">{kind}</span>
                                            <span className="text-zoru-ink-muted">
                                                {' '}
                                                @ {fmtDateTime(at)}
                                            </span>
                                            {ev.note && (
                                                <div className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                                                    {ev.note}
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </ZoruCard>
                </div>
            </div>
        </div>
    );
}

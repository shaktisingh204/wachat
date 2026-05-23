'use client';

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruSkeleton,
  Progress,
} from '@/components/zoruui';
import {
  Wallet,
  AlertCircle,
  RefreshCw,
  Copy } from 'lucide-react';

import * as React from 'react';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useToast } from '@/hooks/use-toast';
import { useAdManager } from '@/context/ad-manager-context';
import { getAdAccountDetails } from '@/app/actions/ad-manager.actions';
import { formatMoney } from '@/components/wabasimplify/ad-manager/constants';

export default function BillingPage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [loading, setLoading] = React.useState(true);
    const [details, setDetails] = React.useState<any>(null);
    const [refreshKey, setRefreshKey] = React.useState(0);

    React.useEffect(() => {
        if (!activeAccount) return;
        setLoading(true);
        (async () => {
            const res = await getAdAccountDetails(activeAccount.account_id);
            setDetails(res.data);
            setLoading(false);
        })();
    }, [activeAccount, refreshKey]);

    if (!activeAccount) {
        return (
            <div className="space-y-6">
                <AmBreadcrumb page="Billing" />
                <ZoruAlert className="bg-zoru-surface/50 border border-zoru-line">
                    <AlertCircle className="h-4 w-4 text-zoru-ink-muted" />
                    <ZoruAlertTitle className="text-zoru-ink">No ad account selected</ZoruAlertTitle>
                    <ZoruAlertDescription className="text-zoru-ink-muted">Pick an ad account to view billing info.</ZoruAlertDescription>
                </ZoruAlert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Billing" />
            <AmHeader
                title={
                    <div className="flex items-center gap-3">
                        Billing
                        {details?.account_status && details.account_status !== 1 && (
                            <ZoruBadge variant="destructive" className="ml-2 text-xs">Account Disabled</ZoruBadge>
                        )}
                        {details?.min_daily_budget && (
                            <ZoruBadge variant="outline" className="ml-2 text-xs">Min Budget Applies</ZoruBadge>
                        )}
                    </div>
                }
                description={`Payment methods, spend and account balance for ${activeAccount.name}.`}
                actions={
                    <div className="flex items-center gap-2">
                        <ZoruButton
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                navigator.clipboard.writeText(activeAccount.account_id);
                                toast({ title: 'Copied', description: `Account ID ${activeAccount.account_id} copied to clipboard.` });
                            }}
                            className="border-zoru-line text-zoru-ink hover:bg-zoru-surface-2"
                        >
                            <Copy className="h-3.5 w-3.5 mr-1" /> Copy Account ID
                        </ZoruButton>
                        <ZoruButton
                            variant="outline"
                            size="icon"
                            onClick={() => setRefreshKey((k) => k + 1)}
                            className="border-zoru-line text-zoru-ink hover:bg-zoru-surface-2"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </ZoruButton>
                    </div>
                }
            />

            <div className="grid md:grid-cols-3 gap-3">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => <ZoruSkeleton key={i} className="h-28" />)
                ) : (
                    <>
                        <ZoruCard className="border border-zoru-line bg-zoru-surface/50 shadow-[var(--zoru-shadow-sm)]">
                            <ZoruCardHeader className="pb-2">
                                <ZoruCardTitle className="text-sm text-zoru-ink-muted">Amount spent</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                <div className="text-2xl font-bold text-zoru-ink">
                                    {formatMoney((Number(details?.amount_spent) || 0) / 100, details?.currency)}
                                </div>
                            </ZoruCardContent>
                        </ZoruCard>
                        <ZoruCard className="border border-zoru-line bg-zoru-surface/50 shadow-[var(--zoru-shadow-sm)]">
                            <ZoruCardHeader className="pb-2">
                                <ZoruCardTitle className="text-sm text-zoru-ink-muted">Balance</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                <div className="text-2xl font-bold text-zoru-ink">
                                    {formatMoney((Number(details?.balance) || 0) / 100, details?.currency)}
                                </div>
                            </ZoruCardContent>
                        </ZoruCard>
                        <ZoruCard className="border border-zoru-line bg-zoru-surface/50 shadow-[var(--zoru-shadow-sm)]">
                            <ZoruCardHeader className="pb-2">
                                <ZoruCardTitle className="text-sm text-zoru-ink-muted">Spending limit</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                <div className="text-2xl font-bold text-zoru-ink">
                                    {details?.spend_cap
                                        ? formatMoney(Number(details.spend_cap) / 100, details?.currency)
                                        : 'No limit'}
                                </div>
                            </ZoruCardContent>
                        <ZoruCard className="md:col-span-3 border border-zoru-line bg-zoru-surface/50 shadow-[var(--zoru-shadow-sm)]">
                            <ZoruCardHeader className="pb-2">
                                <ZoruCardTitle className="text-sm text-zoru-ink-muted">Spending limit progress</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                {details?.spend_cap ? (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zoru-ink">{formatMoney((Number(details.amount_spent) || 0) / 100, details.currency)} spent</span>
                                            <span className="text-zoru-ink-muted">{formatMoney(Number(details.spend_cap) / 100, details.currency)} limit</span>
                                        </div>
                                        <Progress value={Math.min(100, ((Number(details.amount_spent) || 0) / Number(details.spend_cap)) * 100)} className="h-2" />
                                    </div>
                                ) : (
                                    <div className="text-sm text-zoru-ink-muted">No spending limit set for this account.</div>
                                )}
                            </ZoruCardContent>
                        </ZoruCard>
                    </>
                )}
            </div>

            <ZoruCard className="border border-zoru-line bg-zoru-surface/50 shadow-[var(--zoru-shadow-sm)]">
                <ZoruCardHeader>
                    <ZoruCardTitle className="text-base text-zoru-ink">Account details</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-2 text-sm">
                    {loading ? <ZoruSkeleton className="h-32" /> : (
                        <>
                            <Row label="Account ID" value={details?.account_id} />
                            <Row label="Account status" value={
                                <ZoruBadge variant="outline" className="border-zoru-line text-zoru-ink">{details?.account_status === 1 ? 'Active' : 'Disabled'}</ZoruBadge>
                            } />
                            <Row label="Currency" value={details?.currency} />
                            <Row label="Timezone" value={details?.timezone_name} />
                            <Row label="Business country" value={details?.business_country_code} />
                            <Row label="Created" value={details?.created_time && new Date(details.created_time).toLocaleDateString()} />
                        </>
                    )}
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between py-1.5 border-b border-zoru-line last:border-0">
            <span className="text-zoru-ink-muted">{label}</span>
            <span className="font-medium text-zoru-ink">{value || '—'}</span>
        </div>
    );
}

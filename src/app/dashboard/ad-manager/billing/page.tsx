'use client';

import * as React from 'react';
import { Wallet, AlertCircle, DollarSign, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAdManager } from '@/context/ad-manager-context';
import { getAdAccountDetails } from '@/app/actions/ad-manager.actions';
import { formatMoney } from '@/components/wabasimplify/ad-manager/constants';

export default function BillingPage() {
    const { activeAccount } = useAdManager();
    const [loading, setLoading] = React.useState(true);
    const [details, setDetails] = React.useState<any>(null);

    React.useEffect(() => {
        if (!activeAccount) return;
        (async () => {
            const res = await getAdAccountDetails(activeAccount.account_id);
            setDetails(res.data);
            setLoading(false);
        })();
    }, [activeAccount]);

    if (!activeAccount) {
        return (
            <div className="p-8">
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No ad account selected</AlertTitle>
                    <AlertDescription>Pick an ad account to view billing info.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Wallet className="h-6 w-6" /> Billing
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Payment methods, spend and account balance for {activeAccount.name}.
                </p>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)
                ) : (
                    <>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-muted-foreground">Amount spent</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatMoney((Number(details?.amount_spent) || 0) / 100, details?.currency)}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-muted-foreground">Balance</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {formatMoney((Number(details?.balance) || 0) / 100, details?.currency)}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-muted-foreground">Spending limit</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {details?.spend_cap
                                        ? formatMoney(Number(details.spend_cap) / 100, details?.currency)
                                        : 'No limit'}
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Account details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    {loading ? <Skeleton className="h-32" /> : (
                        <>
                            <Row label="Account ID" value={details?.account_id} />
                            <Row label="Account status" value={
                                <Badge variant="outline">{details?.account_status === 1 ? 'Active' : 'Disabled'}</Badge>
                            } />
                            <Row label="Currency" value={details?.currency} />
                            <Row label="Timezone" value={details?.timezone_name} />
                            <Row label="Business country" value={details?.business_country_code} />
                            <Row label="Created" value={details?.created_time && new Date(details.created_time).toLocaleDateString()} />
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between py-1.5 border-b last:border-0">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{value || '—'}</span>
        </div>
    );
}

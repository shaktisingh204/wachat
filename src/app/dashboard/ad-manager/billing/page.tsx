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
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  Wallet,
  AlertCircle,
  RefreshCw,
  Copy,
  Download,
  CreditCard,
  FileText,
  Lock
} from 'lucide-react';

import * as React from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useToast } from '@/hooks/use-toast';
import { useAdManager } from '@/context/ad-manager-context';
import { getAdAccountDetails, getAdAccountTransactions } from '@/app/actions/ad-manager.actions';
import { formatMoney } from '@/components/zoruui-domain/ad-manager/constants';
import Link from 'next/link';

export default function BillingPage() {
    const { activeAccount } = useAdManager();
    const { toast } = useToast();
    const [loading, setLoading] = React.useState(true);
    const [details, setDetails] = React.useState<any>(null);
    const [transactions, setTransactions] = React.useState<any[]>([]);
    const [refreshKey, setRefreshKey] = React.useState(0);
    const [permissionError, setPermissionError] = React.useState<string | null>(null);
    const [downloading, setDownloading] = React.useState(false);

    React.useEffect(() => {
        if (!activeAccount) return;
        setLoading(true);
        setPermissionError(null);
        
        (async () => {
            try {
                const [detailsRes, txRes] = await Promise.all([
                    getAdAccountDetails(activeAccount.account_id),
                    getAdAccountTransactions(activeAccount.account_id)
                ]);

                // Check for Meta permission errors (which might be an obscure string or an object)
                const checkPermError = (res: any) => {
                    if (!res.error) return null;
                    if (typeof res.error === 'string') {
                        const errLower = res.error.toLowerCase();
                        if (errLower.includes('permission') || res.error.includes('200') || res.error.includes('10') || errLower.includes('authorization')) {
                            return res.error;
                        }
                    } else if (typeof res.error === 'object') {
                        if (res.error.code === 200 || res.error.code === 10 || res.error.message?.toLowerCase().includes('permission')) {
                            return res.error.message || JSON.stringify(res.error);
                        }
                    }
                    return null;
                };
                
                const detailsPermError = checkPermError(detailsRes);
                const txPermError = checkPermError(txRes);

                if (detailsPermError || txPermError) {
                    setPermissionError(detailsPermError || txPermError || 'Missing billing permissions.');
                    setLoading(false);
                    return;
                }

                if (detailsRes.error) {
                    const errMsg = typeof detailsRes.error === 'string' ? detailsRes.error : detailsRes.error.message || 'Unknown error';
                    toast({ title: 'Error', description: errMsg, variant: 'destructive' });
                } else {
                    setDetails(detailsRes.data);
                }

                if (txRes.error) {
                     const errMsg = typeof txRes.error === 'string' ? txRes.error : txRes.error.message || 'Unknown error';
                     toast({ title: 'Notice', description: 'Could not fetch invoices: ' + errMsg });
                } else {
                    setTransactions(txRes.data || []);
                }
            } catch (error: any) {
                 toast({ title: 'Error', description: error.message || 'Something went wrong.', variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        })();
    }, [activeAccount, refreshKey]);

    const handleDownloadAllInvoices = async () => {
        if (!transactions || transactions.length === 0) {
            toast({ title: 'No invoices', description: 'There are no invoices available to download.' });
            return;
        }

        const downloadableTxs = transactions.filter(tx => tx.download_invoice_uri);
        if (downloadableTxs.length === 0) {
            toast({ title: 'No downloadable invoices', description: 'None of the transactions have a download URI.' });
            return;
        }

        setDownloading(true);
        toast({ title: 'Preparing ZIP', description: 'Fetching invoices, this may take a moment...' });

        try {
            const zip = new JSZip();
            const folder = zip.folder(`Invoices_${activeAccount?.account_id}`);

            let fetchedCount = 0;
            for (const tx of downloadableTxs) {
                try {
                    const response = await fetch(tx.download_invoice_uri);
                    if (response.ok) {
                        const blob = await response.blob();
                        const date = tx.time ? new Date(tx.time * 1000).toISOString().split('T')[0] : 'UnknownDate';
                        const filename = `Invoice_${tx.id}_${date}.pdf`;
                        folder?.file(filename, blob);
                        fetchedCount++;
                    }
                } catch (err) {
                    console.error('Failed to fetch invoice:', tx.id, err);
                }
            }

            if (fetchedCount > 0) {
                const content = await zip.generateAsync({ type: 'blob' });
                saveAs(content, `Invoices_${activeAccount?.account_id}.zip`);
                toast({ title: 'Success', description: `Downloaded ${fetchedCount} invoice(s).` });
            } else {
                toast({ title: 'Failed', description: 'Could not download any invoices. This may be due to cross-origin restrictions.', variant: 'destructive' });
            }
        } catch (error) {
            console.error('Error creating ZIP:', error);
            toast({ title: 'Error', description: 'Failed to create ZIP file.', variant: 'destructive' });
        } finally {
            setDownloading(false);
        }
    };

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

    if (permissionError) {
        return (
            <div className="space-y-6">
                <AmBreadcrumb page="Billing" />
                <AmHeader
                    title="Billing"
                    description={`Payment methods, spend and account balance for ${activeAccount.name}.`}
                />
                <ZoruCard className="border border-zoru-line/20 bg-zoru-ink/5 shadow-[var(--zoru-shadow-sm)]">
                    <ZoruCardHeader className="pb-3 text-center flex flex-col items-center">
                        <div className="h-12 w-12 rounded-full bg-zoru-surface-2 dark:bg-zoru-ink/30 flex items-center justify-center mb-3">
                            <Lock className="h-6 w-6 text-zoru-ink dark:text-zoru-ink-muted" />
                        </div>
                        <ZoruCardTitle className="text-xl text-zoru-ink">Connect Billing Permissions</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="text-center space-y-4">
                        <p className="text-zoru-ink-muted max-w-md mx-auto">
                            We cannot access billing information for this account. Please reconnect your Meta account and make sure to explicitly grant <strong>Ads Management</strong> and <strong>Billing</strong> permissions.
                        </p>
                        <div className="text-sm bg-zoru-surface-2 p-3 rounded-md text-zoru-ink-muted inline-block text-left break-words max-w-full">
                            <strong>Meta Error:</strong> {permissionError}
                        </div>
                        <div className="pt-4 flex justify-center gap-3">
                            <ZoruButton variant="outline" onClick={() => setRefreshKey(k => k + 1)}>
                                Try Again
                            </ZoruButton>
                            <Link href="/dashboard/settings/integrations">
                                <ZoruButton>
                                    Go to Integrations
                                </ZoruButton>
                            </Link>
                        </div>
                    </ZoruCardContent>
                </ZoruCard>
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
                                <ZoruCardTitle className="text-sm text-zoru-ink-muted flex items-center gap-2">
                                    <Wallet className="h-4 w-4" /> Amount spent
                                </ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                <div className="text-2xl font-bold text-zoru-ink">
                                    {formatMoney((Number(details?.amount_spent) || 0) / 100, details?.currency)}
                                </div>
                            </ZoruCardContent>
                        </ZoruCard>
                        <ZoruCard className="border border-zoru-line bg-zoru-surface/50 shadow-[var(--zoru-shadow-sm)]">
                            <ZoruCardHeader className="pb-2">
                                <ZoruCardTitle className="text-sm text-zoru-ink-muted flex items-center gap-2">
                                    <Wallet className="h-4 w-4" /> Balance
                                </ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                <div className="text-2xl font-bold text-zoru-ink">
                                    {formatMoney((Number(details?.balance) || 0) / 100, details?.currency)}
                                </div>
                            </ZoruCardContent>
                        </ZoruCard>
                        <ZoruCard className="border border-zoru-line bg-zoru-surface/50 shadow-[var(--zoru-shadow-sm)]">
                            <ZoruCardHeader className="pb-2">
                                <ZoruCardTitle className="text-sm text-zoru-ink-muted flex items-center gap-2">
                                    <Wallet className="h-4 w-4" /> Spending limit
                                </ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent>
                                <div className="text-2xl font-bold text-zoru-ink">
                                    {details?.spend_cap
                                        ? formatMoney(Number(details.spend_cap) / 100, details?.currency)
                                        : 'No limit'}
                                </div>
                            </ZoruCardContent>
                        </ZoruCard>
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

            <div className="grid md:grid-cols-2 gap-6">
                <ZoruCard className="border border-zoru-line bg-zoru-surface/50 shadow-[var(--zoru-shadow-sm)]">
                    <ZoruCardHeader>
                        <ZoruCardTitle className="text-base text-zoru-ink flex items-center gap-2">
                            <FileText className="h-5 w-5 text-zoru-ink-muted" /> Account details
                        </ZoruCardTitle>
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

                <ZoruCard className="border border-zoru-line bg-zoru-surface/50 shadow-[var(--zoru-shadow-sm)]">
                    <ZoruCardHeader>
                        <ZoruCardTitle className="text-base text-zoru-ink flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-zoru-ink-muted" /> Payment Methods
                        </ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="text-sm">
                        {loading ? <ZoruSkeleton className="h-32" /> : (
                            <div className="space-y-3">
                                {details?.funding_source_details ? (
                                    <div className="p-3 border border-zoru-line rounded-md bg-zoru-surface flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-14 bg-zoru-surface-2 rounded flex items-center justify-center border border-zoru-line">
                                                <CreditCard className="h-5 w-5 text-zoru-ink-muted" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-zoru-ink">{details.funding_source_details.display_string || 'Primary Payment Method'}</div>
                                                <div className="text-xs text-zoru-ink-muted capitalize">
                                                    {details.funding_source_details.type === '1' ? 'Credit Card' : details.funding_source_details.type === '2' ? 'PayPal' : 'Payment Method'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-zoru-ink-muted border border-dashed border-zoru-line rounded-md">
                                        No payment methods found.
                                    </div>
                                )}
                            </div>
                        )}
                    </ZoruCardContent>
                </ZoruCard>
            </div>

            <ZoruCard className="border border-zoru-line bg-zoru-surface/50 shadow-[var(--zoru-shadow-sm)]">
                <ZoruCardHeader className="flex flex-row items-center justify-between pb-2">
                    <ZoruCardTitle className="text-base text-zoru-ink flex items-center gap-2">
                        <FileText className="h-5 w-5 text-zoru-ink-muted" /> Invoice History
                    </ZoruCardTitle>
                    <ZoruButton 
                        size="sm" 
                        onClick={handleDownloadAllInvoices} 
                        disabled={loading || downloading || transactions.length === 0}
                    >
                        <Download className="h-4 w-4 mr-2" /> 
                        {downloading ? 'Zipping...' : 'Download All (.zip)'}
                    </ZoruButton>
                </ZoruCardHeader>
                <ZoruCardContent>
                    {loading ? <ZoruSkeleton className="h-48" /> : (
                        transactions.length > 0 ? (
                            <div className="rounded-md border border-zoru-line overflow-hidden">
                                <ZoruTable>
                                    <ZoruTableHeader className="bg-zoru-surface-2">
                                        <ZoruTableRow>
                                            <ZoruTableHead>Date</ZoruTableHead>
                                            <ZoruTableHead>Transaction ID</ZoruTableHead>
                                            <ZoruTableHead>Status</ZoruTableHead>
                                            <ZoruTableHead className="text-right">Amount</ZoruTableHead>
                                            <ZoruTableHead className="w-[100px]"></ZoruTableHead>
                                        </ZoruTableRow>
                                    </ZoruTableHeader>
                                    <ZoruTableBody>
                                        {transactions.map((tx: any) => (
                                            <ZoruTableRow key={tx.id}>
                                                <ZoruTableCell>
                                                    {tx.time ? new Date(tx.time * 1000).toLocaleDateString() : 'N/A'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-xs text-zoru-ink-muted">
                                                    {tx.id}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <ZoruBadge variant={tx.status === 'completed' ? 'default' : 'outline'} className="capitalize">
                                                        {tx.status || 'Unknown'}
                                                    </ZoruBadge>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right font-medium">
                                                    {tx.app_amount && tx.currency 
                                                        ? formatMoney(Number(tx.app_amount.amount || tx.app_amount) / 100, tx.currency)
                                                        : '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    {tx.download_invoice_uri ? (
                                                        <a href={tx.download_invoice_uri} target="_blank" rel="noreferrer" title="Download PDF">
                                                            <ZoruButton variant="ghost" size="icon" className="h-8 w-8">
                                                                <Download className="h-4 w-4" />
                                                            </ZoruButton>
                                                        </a>
                                                    ) : null}
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        ))}
                                    </ZoruTableBody>
                                </ZoruTable>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-zoru-ink-muted border border-dashed border-zoru-line rounded-md">
                                <FileText className="h-8 w-8 mx-auto mb-3 text-zoru-line" />
                                <p>No invoice history available.</p>
                            </div>
                        )
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

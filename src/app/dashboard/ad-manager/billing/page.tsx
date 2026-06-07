'use client';

import {
    Alert,
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    EmptyState,
    IconButton,
    PageActions,
    PageDescription,
    PageHeader,
    PageHeading,
    PageTitle,
    Progress,
    Skeleton,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
} from '@/components/sabcrm/20ui';
import {
    Wallet,
    RefreshCw,
    Copy,
    Download,
    CreditCard,
    FileText,
    Lock,
} from 'lucide-react';

import * as React from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import { AmBreadcrumb, AmHeader } from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useToast } from '@/hooks/use-toast';
import { useAdManager } from '@/context/ad-manager-context';
import { getAdAccountDetails, getAdAccountTransactions } from '@/app/actions/ad-manager.actions';
import { formatMoney } from '@/components/20ui-domain/ad-manager/constants';
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
        toast({ title: 'Preparing ZIP', description: 'Fetching invoices, this may take a moment.' });

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
                <Alert tone="neutral" title="No ad account selected" className="mt-6">
                    Pick an ad account to view billing info.
                </Alert>
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
                <Card>
                    <CardHeader className="flex flex-col items-center pb-3 text-center">
                        <span
                            className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]"
                            aria-hidden="true"
                        >
                            <Lock className="h-6 w-6" />
                        </span>
                        <CardTitle className="text-xl">Connect Billing Permissions</CardTitle>
                    </CardHeader>
                    <CardBody className="space-y-4 text-center">
                        <p className="mx-auto max-w-md text-[var(--st-text-secondary)]">
                            We cannot access billing information for this account. Please reconnect your Meta account and make sure to explicitly grant <strong>Ads Management</strong> and <strong>Billing</strong> permissions.
                        </p>
                        <div className="mx-auto inline-block max-w-full break-words rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] p-3 text-left text-sm text-[var(--st-text-secondary)]">
                            <strong>Meta Error:</strong> {permissionError}
                        </div>
                        <div className="flex justify-center gap-3 pt-4">
                            <Button variant="outline" onClick={() => setRefreshKey(k => k + 1)}>
                                Try Again
                            </Button>
                            <Link href="/dashboard/settings/integrations">
                                <Button variant="primary">Go to Integrations</Button>
                            </Link>
                        </div>
                    </CardBody>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <AmBreadcrumb page="Billing" />
            <PageHeader className="mt-5">
                <PageHeading>
                    <PageTitle>
                        <span className="flex items-center gap-3">
                            Billing
                            {details?.account_status && details.account_status !== 1 && (
                                <Badge tone="danger" className="ml-2 text-xs">Account Disabled</Badge>
                            )}
                            {details?.min_daily_budget && (
                                <Badge variant="outline" className="ml-2 text-xs">Min Budget Applies</Badge>
                            )}
                        </span>
                    </PageTitle>
                    <PageDescription>{`Payment methods, spend and account balance for ${activeAccount.name}.`}</PageDescription>
                </PageHeading>
                <PageActions>
                    <Button
                        variant="outline"
                        size="sm"
                        iconLeft={Copy}
                        onClick={() => {
                            navigator.clipboard.writeText(activeAccount.account_id);
                            toast({ title: 'Copied', description: `Account ID ${activeAccount.account_id} copied to clipboard.` });
                        }}
                    >
                        Copy Account ID
                    </Button>
                    <IconButton
                        variant="outline"
                        label="Refresh billing data"
                        icon={RefreshCw}
                        onClick={() => setRefreshKey((k) => k + 1)}
                        className={loading ? '[&_svg]:animate-spin' : undefined}
                    />
                </PageActions>
            </PageHeader>

            <div className="grid gap-3 md:grid-cols-3">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={112} />)
                ) : (
                    <>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                                    <Wallet className="h-4 w-4" aria-hidden="true" /> Amount spent
                                </CardTitle>
                            </CardHeader>
                            <CardBody>
                                <div className="text-2xl font-bold text-[var(--st-text)]">
                                    {formatMoney((Number(details?.amount_spent) || 0) / 100, details?.currency)}
                                </div>
                            </CardBody>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                                    <Wallet className="h-4 w-4" aria-hidden="true" /> Balance
                                </CardTitle>
                            </CardHeader>
                            <CardBody>
                                <div className="text-2xl font-bold text-[var(--st-text)]">
                                    {formatMoney((Number(details?.balance) || 0) / 100, details?.currency)}
                                </div>
                            </CardBody>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                                    <Wallet className="h-4 w-4" aria-hidden="true" /> Spending limit
                                </CardTitle>
                            </CardHeader>
                            <CardBody>
                                <div className="text-2xl font-bold text-[var(--st-text)]">
                                    {details?.spend_cap
                                        ? formatMoney(Number(details.spend_cap) / 100, details?.currency)
                                        : 'No limit'}
                                </div>
                            </CardBody>
                        </Card>
                        <Card className="md:col-span-3">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm text-[var(--st-text-secondary)]">Spending limit progress</CardTitle>
                            </CardHeader>
                            <CardBody>
                                {details?.spend_cap ? (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-[var(--st-text)]">{formatMoney((Number(details.amount_spent) || 0) / 100, details.currency)} spent</span>
                                            <span className="text-[var(--st-text-secondary)]">{formatMoney(Number(details.spend_cap) / 100, details.currency)} limit</span>
                                        </div>
                                        <Progress
                                            value={Math.min(100, ((Number(details.amount_spent) || 0) / Number(details.spend_cap)) * 100)}
                                            aria-label="Spending limit progress"
                                            size="sm"
                                        />
                                    </div>
                                ) : (
                                    <div className="text-sm text-[var(--st-text-secondary)]">No spending limit set for this account.</div>
                                )}
                            </CardBody>
                        </Card>
                    </>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <FileText className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" /> Account details
                        </CardTitle>
                    </CardHeader>
                    <CardBody className="space-y-2 text-sm">
                        {loading ? <Skeleton height={128} /> : (
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
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <CreditCard className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" /> Payment Methods
                        </CardTitle>
                    </CardHeader>
                    <CardBody className="text-sm">
                        {loading ? <Skeleton height={128} /> : (
                            <div className="space-y-3">
                                {details?.funding_source_details ? (
                                    <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-10 w-14 items-center justify-center rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)]" aria-hidden="true">
                                                <CreditCard className="h-5 w-5 text-[var(--st-text-secondary)]" />
                                            </span>
                                            <div>
                                                <div className="font-medium text-[var(--st-text)]">{details.funding_source_details.display_string || 'Primary Payment Method'}</div>
                                                <div className="text-xs capitalize text-[var(--st-text-secondary)]">
                                                    {details.funding_source_details.type === '1' ? 'Credit Card' : details.funding_source_details.type === '2' ? 'PayPal' : 'Payment Method'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <EmptyState
                                        icon={CreditCard}
                                        size="sm"
                                        title="No payment methods found"
                                    />
                                )}
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-5 w-5 text-[var(--st-text-secondary)]" aria-hidden="true" /> Invoice History
                    </CardTitle>
                    <Button
                        variant="primary"
                        size="sm"
                        iconLeft={Download}
                        onClick={handleDownloadAllInvoices}
                        disabled={loading || downloading || transactions.length === 0}
                    >
                        {downloading ? 'Zipping...' : 'Download All (.zip)'}
                    </Button>
                </CardHeader>
                <CardBody>
                    {loading ? <Skeleton height={192} /> : (
                        transactions.length > 0 ? (
                            <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
                                <Table>
                                    <THead>
                                        <Tr>
                                            <Th>Date</Th>
                                            <Th>Transaction ID</Th>
                                            <Th>Status</Th>
                                            <Th align="right">Amount</Th>
                                            <Th width={100}><span className="sr-only">Invoice</span></Th>
                                        </Tr>
                                    </THead>
                                    <TBody>
                                        {transactions.map((tx: any) => (
                                            <Tr key={tx.id}>
                                                <Td>
                                                    {tx.time ? new Date(tx.time * 1000).toLocaleDateString() : 'N/A'}
                                                </Td>
                                                <Td className="font-mono text-xs text-[var(--st-text-secondary)]">
                                                    {tx.id}
                                                </Td>
                                                <Td>
                                                    <Badge tone={tx.status === 'completed' ? 'success' : 'neutral'} variant={tx.status === 'completed' ? undefined : 'outline'} className="capitalize">
                                                        {tx.status || 'Unknown'}
                                                    </Badge>
                                                </Td>
                                                <Td align="right" className="font-medium">
                                                    {tx.app_amount && tx.currency
                                                        ? formatMoney(Number(tx.app_amount.amount || tx.app_amount) / 100, tx.currency)
                                                        : '-'}
                                                </Td>
                                                <Td align="right">
                                                    {tx.download_invoice_uri ? (
                                                        <a
                                                            href={tx.download_invoice_uri}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            aria-label="Download invoice PDF"
                                                            title="Download invoice PDF"
                                                            className="u-btn u-icon-btn u-btn--ghost u-icon-btn--sm"
                                                        >
                                                            <Download className="h-4 w-4" aria-hidden="true" />
                                                        </a>
                                                    ) : null}
                                                </Td>
                                            </Tr>
                                        ))}
                                    </TBody>
                                </Table>
                            </div>
                        ) : (
                            <EmptyState
                                icon={FileText}
                                title="No invoice history available"
                            />
                        )
                    )}
                </CardBody>
            </Card>
        </div>
    );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between border-b border-[var(--st-border)] py-1.5 last:border-0">
            <span className="text-[var(--st-text-secondary)]">{label}</span>
            <span className="font-medium text-[var(--st-text)]">{value || '-'}</span>
        </div>
    );
}

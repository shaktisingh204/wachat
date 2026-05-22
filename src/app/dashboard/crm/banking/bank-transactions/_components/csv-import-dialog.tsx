'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
  cn,
} from '@/components/zoruui';
import {
  FileUp,
  LoaderCircle,
  Upload } from 'lucide-react';

/**
 * <CsvImportDialog> — pick a bank statement from SabFiles and import
 * its rows into `crm_bank_transactions` for a chosen account.
 *
 * SabFiles policy: the statement file is sourced from
 * `<SabFilePickerButton accept="csv">` only — there is no free-text URL
 * paste. The picker emits a `SabFilePick` whose URL we hand off to
 * `fetchSabFilePickAsFile` and parse client-side with Papa Parse.
 */

import * as React from 'react';
import Papa from 'papaparse';

import {
    SabFilePickerButton,
    fetchSabFilePickAsFile,
    type SabFilePick,
} from '@/components/sabfiles';

import { importBankTransactionsCsv } from '@/app/actions/crm-bank-transactions.actions';
import type { WithId } from 'mongodb';
import type { CrmPaymentAccount } from '@/lib/definitions';

interface CsvImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    accounts: WithId<CrmPaymentAccount>[];
    onImported: () => void;
}

interface PreviewRow {
    transaction_date?: string;
    amount?: string;
    type?: string;
    description?: string;
    reference_number?: string;
    balance_after?: string;
    category?: string;
}

const HEADER_ALIASES: Record<string, keyof PreviewRow> = {
    date: 'transaction_date',
    'transaction date': 'transaction_date',
    'transaction_date': 'transaction_date',
    'value date': 'transaction_date',
    amount: 'amount',
    debit: 'amount', // resolved by sign at server side
    credit: 'amount',
    type: 'type',
    'cr/dr': 'type',
    description: 'description',
    narration: 'description',
    particulars: 'description',
    reference: 'reference_number',
    'reference number': 'reference_number',
    'reference_number': 'reference_number',
    ref: 'reference_number',
    'cheque no': 'reference_number',
    'utr': 'reference_number',
    'balance': 'balance_after',
    'balance after': 'balance_after',
    'balance_after': 'balance_after',
    'running balance': 'balance_after',
    category: 'category',
};

function normaliseHeader(raw: string): keyof PreviewRow | undefined {
    return HEADER_ALIASES[raw.trim().toLowerCase()];
}

function inferType(row: Record<string, string>): 'debit' | 'credit' | undefined {
    const dbg = Object.entries(row).find(([k]) => k.trim().toLowerCase() === 'debit');
    const crd = Object.entries(row).find(([k]) => k.trim().toLowerCase() === 'credit');
    if (dbg && dbg[1] && Number(dbg[1]) > 0) return 'debit';
    if (crd && crd[1] && Number(crd[1]) > 0) return 'credit';
    const t = row['type']?.trim().toLowerCase();
    if (t === 'debit' || t === 'dr') return 'debit';
    if (t === 'credit' || t === 'cr') return 'credit';
    return undefined;
}

export function CsvImportDialog({
    open,
    onOpenChange,
    accounts,
    onImported,
}: CsvImportDialogProps): React.JSX.Element {
    const { toast } = useZoruToast();
    const [accountId, setAccountId] = React.useState<string>('');
    const [pick, setPick] = React.useState<SabFilePick | null>(null);
    const [preview, setPreview] = React.useState<PreviewRow[]>([]);
    const [isParsing, setIsParsing] = React.useState(false);
    const [isImporting, startImport] = React.useTransition();

    // Reset on close
    React.useEffect(() => {
        if (!open) {
            setPick(null);
            setPreview([]);
            setIsParsing(false);
        }
    }, [open]);

    const handlePick = React.useCallback(
        async (p: SabFilePick) => {
            setPick(p);
            setIsParsing(true);
            try {
                const file = await fetchSabFilePickAsFile(p);
                const text = await file.text();
                const parsed = Papa.parse<Record<string, string>>(text, {
                    header: true,
                    skipEmptyLines: 'greedy',
                    transformHeader: (h) => h.trim(),
                });
                if (parsed.errors.length > 0) {
                    console.warn('[CsvImportDialog] parse errors:', parsed.errors.slice(0, 3));
                }
                const rows: PreviewRow[] = (parsed.data ?? []).map((raw) => {
                    const out: PreviewRow = {};
                    for (const [k, v] of Object.entries(raw)) {
                        const key = normaliseHeader(k);
                        if (!key) continue;
                        if (out[key]) continue;
                        out[key] = String(v ?? '').trim();
                    }
                    if (!out.type) {
                        out.type = inferType(raw);
                    }
                    // If only Debit/Credit columns were given, fold them into amount
                    if (!out.amount) {
                        const d = raw['Debit'] ?? raw['debit'] ?? '';
                        const c = raw['Credit'] ?? raw['credit'] ?? '';
                        const dn = Number(d);
                        const cn = Number(c);
                        if (Number.isFinite(dn) && dn > 0) out.amount = String(dn);
                        else if (Number.isFinite(cn) && cn > 0) out.amount = String(cn);
                    }
                    return out;
                });
                setPreview(rows.filter((r) => r.transaction_date && r.amount));
            } catch (e) {
                toast({
                    title: 'Could not read file',
                    description: e instanceof Error ? e.message : 'Unknown error.',
                    variant: 'destructive',
                });
            } finally {
                setIsParsing(false);
            }
        },
        [toast],
    );

    const handleImport = React.useCallback(() => {
        if (!accountId) {
            toast({ title: 'Pick an account first.', variant: 'destructive' });
            return;
        }
        if (preview.length === 0) {
            toast({ title: 'No valid rows in CSV.', variant: 'destructive' });
            return;
        }
        startImport(async () => {
            const r = await importBankTransactionsCsv(
                accountId,
                preview.map((p) => ({
                    accountId,
                    transactionDate: p.transaction_date ?? '',
                    amount: p.amount ?? '0',
                    type: (p.type ?? '').toLowerCase(),
                    description: p.description,
                    referenceNumber: p.reference_number,
                    balanceAfter: p.balance_after,
                    category: p.category,
                    sourceFileUrl: pick?.url,
                })),
                pick?.url,
            );
            if (r.success) {
                toast({
                    title: 'Import complete',
                    description: `${r.inserted ?? 0} inserted${r.skipped ? `, ${r.skipped} skipped` : ''}.`,
                });
                onOpenChange(false);
                onImported();
            } else {
                toast({
                    title: 'Import failed',
                    description: r.error,
                    variant: 'destructive',
                });
            }
        });
    }, [accountId, preview, pick, onImported, onOpenChange, toast]);

    return (
        <ZoruDialog open={open} onOpenChange={onOpenChange}>
            <ZoruDialogContent>
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Import bank statement CSV</ZoruDialogTitle>
                    <ZoruDialogDescription>
                        Recognised columns: <code>date</code>, <code>amount</code> (or{' '}
                        <code>debit</code> / <code>credit</code>), <code>type</code>,{' '}
                        <code>description</code>, <code>reference</code>,{' '}
                        <code>balance</code>, <code>category</code>.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="csv-account">Target account</ZoruLabel>
                        <ZoruSelect value={accountId} onValueChange={setAccountId}>
                            <ZoruSelectTrigger id="csv-account">
                                <ZoruSelectValue placeholder="Pick a payment account…" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {accounts.map((a) => (
                                    <ZoruSelectItem key={a._id.toString()} value={a._id.toString()}>
                                        {a.accountName} ({a.accountType})
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>

                    <div className="space-y-1.5">
                        <ZoruLabel>Statement file (CSV)</ZoruLabel>
                        <div className="flex flex-wrap items-center gap-2">
                            <SabFilePickerButton
                                accept="document"
                                onPick={handlePick}
                                title="Pick a bank statement CSV"
                            >
                                <FileUp className="mr-1.5 h-4 w-4" />
                                {pick ? 'Replace file' : 'Choose from SabFiles'}
                            </SabFilePickerButton>
                            {pick ? (
                                <span className="max-w-[260px] truncate text-[12.5px] text-muted-foreground">
                                    {pick.name}
                                </span>
                            ) : (
                                <span className="text-[12px] text-muted-foreground">
                                    No file picked.
                                </span>
                            )}
                        </div>
                    </div>

                    {isParsing ? (
                        <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                            <LoaderCircle className="h-4 w-4 animate-spin" /> Parsing CSV…
                        </div>
                    ) : preview.length > 0 ? (
                        <div className="rounded-lg border border-border bg-secondary/40 p-3">
                            <p className="mb-2 text-[12.5px] font-medium text-foreground">
                                Preview · {preview.length} rows
                            </p>
                            <div className="max-h-[200px] overflow-y-auto text-[11.5px]">
                                <table className="w-full font-mono">
                                    <thead className="text-muted-foreground">
                                        <tr className="text-left">
                                            <th className="px-2 py-1">Date</th>
                                            <th className="px-2 py-1">Amount</th>
                                            <th className="px-2 py-1">Type</th>
                                            <th className="px-2 py-1">Description</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.slice(0, 50).map((p, i) => (
                                            <tr key={i} className="border-t border-border">
                                                <td className="px-2 py-1">{p.transaction_date}</td>
                                                <td className="px-2 py-1">{p.amount}</td>
                                                <td className="px-2 py-1">{p.type ?? '—'}</td>
                                                <td className="px-2 py-1 truncate">{p.description ?? '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {preview.length > 50 ? (
                                    <p className="mt-2 text-center text-muted-foreground">
                                        …and {preview.length - 50} more rows
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                </div>

                <ZoruDialogFooter>
                    <ZoruButton variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </ZoruButton>
                    <ZoruButton
                        onClick={handleImport}
                        disabled={isImporting || preview.length === 0 || !accountId}
                    >
                        {isImporting ? (
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Upload className="mr-2 h-4 w-4" />
                        )}
                        Import {preview.length || ''}{' '}
                        {preview.length === 1 ? 'row' : preview.length > 1 ? 'rows' : ''}
                    </ZoruButton>
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}

'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  useZoruToast,
} from '@/components/zoruui';
import {
  Target } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';
import Papa from 'papaparse';

import { SabFileToFileButton } from '@/components/sabfiles';

import { CrmPageHeader } from '../../_components/crm-page-header';
import { addCrmLead } from '@/app/actions/crm-leads.actions';

type RowResult = { row: number; ok: boolean; error?: string };

export default function VendorLeadsPage() {
    const { toast } = useZoruToast();
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [results, setResults] = React.useState<RowResult[]>([]);

    const importCsv = React.useCallback(async (file: File) => {
        setBusy(true);
        setResults([]);
        const text = await file.text();
        const parsed = Papa.parse<Record<string, string>>(text, {
            header: true,
            skipEmptyLines: true,
        });
        if (parsed.errors.length) {
            toast({
                title: 'CSV parse failed',
                description: parsed.errors[0]?.message ?? 'Could not parse file.',
            });
            setBusy(false);
            return;
        }
        const rows = parsed.data;
        const out: RowResult[] = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const fd = new FormData();
            for (const [k, v] of Object.entries(row)) {
                if (v != null) fd.set(k, String(v));
            }
            try {
                const res = await addCrmLead(null, fd);
                out.push({ row: i + 2, ok: !res.error, error: res.error });
            } catch (e: any) {
                out.push({ row: i + 2, ok: false, error: e?.message ?? 'Unknown error' });
            }
            setResults([...out]);
        }
        setBusy(false);
        const okCount = out.filter((r) => r.ok).length;
        toast({
            title: 'Import complete',
            description: `${okCount} of ${rows.length} leads imported.`,
        });
    }, [toast]);

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Vendor Leads"
                subtitle="Manage potential vendors and suppliers. Track leads, assign to team members, and convert them to vendors."
                icon={Target}
            />

            <ZoruCard variant="outline" className="border-dashed">
                <div className="flex flex-col items-center gap-4 py-12 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent">
                        <Target className="h-7 w-7 text-accent-foreground" strokeWidth={1.75} />
                    </div>
                    <div>
                        <h3 className="text-[17px] font-semibold text-foreground">Vendor Leads</h3>
                        <p className="mt-1 max-w-md text-[12.5px] text-muted-foreground">
                            Manage potential vendors and suppliers. Track leads, assign to team members, and convert them to vendors.
                        </p>
                    </div>
                    <ZoruButton variant="ghost">Watch Demo Video</ZoruButton>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                        <Link href="/dashboard/crm/purchases/vendors/new">
                            <ZoruButton>Add New Vendor Lead</ZoruButton>
                        </Link>
                        <ZoruButton variant="outline" onClick={() => setOpen(true)}>
                            Import Leads
                        </ZoruButton>
                    </div>
                </div>
            </ZoruCard>

            <ZoruDialog open={open} onOpenChange={setOpen}>
                <ZoruDialogContent className="sm:max-w-md">
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Import leads from CSV</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Pick a CSV from your SabFiles library or upload a new one. Each row
                            becomes one lead. Recognized columns: title, contactName, email,
                            phone, company, website, country, status, source, value, currency,
                            stage, description, nextFollowUp.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>

                    <div className="flex flex-col gap-3">
                        <SabFileToFileButton
                            accept="document"
                            variant="outline"
                            onPickFile={(file) => importCsv(file)}
                        >
                            {busy ? 'Importing…' : 'Pick CSV from SabFiles'}
                        </SabFileToFileButton>

                        {results.length > 0 && (
                            <div className="max-h-64 overflow-y-auto rounded border border-zoru-line text-xs">
                                {results.map((r) => (
                                    <div
                                        key={r.row}
                                        className={
                                            'flex justify-between px-3 py-1.5 ' +
                                            (r.ok ? 'text-zoru-fg' : 'text-zoru-danger')
                                        }
                                    >
                                        <span>Row {r.row}</span>
                                        <span>{r.ok ? 'OK' : r.error || 'Failed'}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <ZoruDialogFooter>
                        <ZoruButton variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                            {busy ? 'Working…' : 'Close'}
                        </ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>
        </div>
    );
}

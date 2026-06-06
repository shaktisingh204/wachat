'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Input, Label, useToast } from '@/components/sabcrm/20ui';
import { bulkImportPfEsiFromPayrollRun } from '@/app/actions/crm-pf-esi.actions';
import { LoaderCircle, FileDown } from 'lucide-react';

function currentMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function PfEsiBulkImport() {
    const router = useRouter();
    const { toast } = useToast();
    const [isPending, setIsPending] = useState(false);
    const [month, setMonth] = useState(currentMonth());

    async function handleImport() {
        if (!month) return;
        setIsPending(true);
        try {
            const res = await bulkImportPfEsiFromPayrollRun(month);
            if (res.error) {
                toast({
                    title: 'Error',
                    description: res.error,
                    variant: 'destructive',
                });
            } else {
                toast({
                    title: 'Import Complete',
                    description: `Created ${res.created} records. Skipped ${res.skipped} existing.`,
                });
                router.push('/dashboard/hrm/payroll/pf-esi');
            }
        } catch (e) {
            toast({
                title: 'Error',
                description: 'Failed to import records.',
                variant: 'destructive',
            });
        } finally {
            setIsPending(false);
        }
    }

    return (
        <Card className="p-6 mb-6">
            <h2 className="text-lg font-medium text-[var(--st-text)] mb-2">Bulk Generate from Payroll</h2>
            <p className="text-sm text-[var(--st-text)]/70 mb-4">
                Automatically generate PF/ESI draft records for all employees based on this month's payslips.
            </p>
            <div className="flex flex-col sm:flex-row items-end gap-4 max-w-md">
                <div className="space-y-1.5 flex-1 w-full">
                    <Label htmlFor="bulkMonth">Target Month (YYYY-MM)</Label>
                    <Input
                        id="bulkMonth"
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        required
                    />
                </div>
                <Button onClick={handleImport} disabled={isPending || !month} className="w-full sm:w-auto">
                    {isPending ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <FileDown className="mr-2 h-4 w-4" />
                    )}
                    Generate Drafts
                </Button>
            </div>
        </Card>
    );
}

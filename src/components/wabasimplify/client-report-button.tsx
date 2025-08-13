
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, LoaderCircle } from 'lucide-react';
import { generateClientReportData } from '@/app/actions/crm-reports.actions';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';

export function ClientReportButton() {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleClick = () => {
        startTransition(async () => {
            const result = await generateClientReportData();

            if (result.error || !result.data) {
                toast({ title: 'Error', description: result.error || 'Could not generate report.', variant: 'destructive'});
                return;
            }
            
            if (result.data.length === 0) {
                toast({ title: 'No Data', description: 'There is no client data to export.'});
                return;
            }

            try {
                const csv = Papa.unparse(result.data);
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', 'client_report.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast({ title: 'Success', description: 'Your client report is downloading.'});
            } catch (csvError: any) {
                toast({ title: 'Export Error', description: `Failed to create CSV file: ${csvError.message}`, variant: 'destructive'});
            }
        });
    }

    return (
        <Button onClick={handleClick} variant="outline" disabled={isPending}>
            {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4" />}
            Generate Report
        </Button>
    )
}

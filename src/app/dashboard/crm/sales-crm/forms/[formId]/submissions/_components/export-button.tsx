'use client';

import * as React from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';

import {
    Button,
    DropdownMenu,
    ZoruDropdownMenuContent,
    ZoruDropdownMenuItem,
    ZoruDropdownMenuTrigger,
    useZoruToast,
} from '@/components/zoruui';
import { exportSubmissions } from '@/app/actions/crm-forms.actions';

export interface ExportButtonProps {
    formId: string;
    filters: {
        q?: string;
        status?: 'all' | 'new' | 'processed' | 'spam' | 'archived';
        from?: string;
        to?: string;
    };
}

function triggerDownload(base64: string, filename: string, mime: string) {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export function ExportButton({ formId, filters }: ExportButtonProps) {
    const { toast } = useZoruToast();
    const [pending, startTransition] = React.useTransition();

    const run = (format: 'csv' | 'xlsx') => {
        startTransition(async () => {
            const res = await exportSubmissions(formId, format, filters);
            if (!res.success || !res.data) {
                toast({
                    title: 'Export failed',
                    description: res.error,
                    variant: 'destructive',
                });
                return;
            }
            triggerDownload(res.data, res.filename, res.mimeType);
            toast({ title: 'Export ready', description: res.filename });
        });
    };

    return (
        <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
                <Button variant="outline" disabled={pending}>
                    <Download className="h-4 w-4" />
                    {pending ? 'Exporting…' : 'Export'}
                </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end">
                <ZoruDropdownMenuItem onClick={() => run('csv')}>
                    <FileText className="h-4 w-4" /> CSV
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuItem onClick={() => run('xlsx')}>
                    <FileSpreadsheet className="h-4 w-4" /> XLSX
                </ZoruDropdownMenuItem>
            </ZoruDropdownMenuContent>
        </DropdownMenu>
    );
}

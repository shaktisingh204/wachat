'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/zoruui';

export interface ExportCsvButtonProps {
    data: any[];
    filename: string;
}

export function ExportCsvButton({ data, filename }: ExportCsvButtonProps) {
    const [isExporting, setIsExporting] = React.useState(false);

    const handleExport = () => {
        setIsExporting(true);
        try {
            if (!data || data.length === 0) return;

            const headers = ['Date', 'Voucher #', 'Note', 'Total Debit', 'Total Credit'];
            const rows = data.map(entry => [
                new Date(entry.date).toLocaleDateString(),
                entry.voucherNumber || '',
                (entry.note || '').replace(/"/g, '""'), // escape quotes
                entry.totalDebit || 0,
                entry.totalCredit || 0
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${filename}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export CSV', error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting || data.length === 0}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {isExporting ? 'Exporting...' : 'Export CSV'}
        </Button>
    );
}

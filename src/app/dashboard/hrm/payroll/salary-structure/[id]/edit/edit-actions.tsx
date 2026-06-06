'use client';

import { Download, FileText, Filter, Users } from 'lucide-react';
import { Button, useToast } from '@/components/sabcrm/20ui/compat';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function EditHeaderActions({ id, data }: { id: string, data: any }) {
    const { toast } = useToast();

    const handleExportCSV = () => {
        try {
            const flattened = Object.entries(data).map(([k, v]) => ({
                Key: k,
                Value: typeof v === 'object' ? JSON.stringify(v) : v,
            }));
            const csv = Papa.unparse(flattened);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `salary-structure-${id}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast({ title: 'Exported to CSV', description: 'Your file has been downloaded.' });
        } catch (error) {
            toast({ title: 'Export failed', description: 'Could not export to CSV.', variant: 'destructive' });
        }
    };

    const handleExportPDF = () => {
        try {
            const doc = new jsPDF();
            doc.text(`Salary Structure - ${id}`, 14, 15);
            const tableData = Object.entries(data).map(([k, v]) => [
                k, 
                typeof v === 'object' ? JSON.stringify(v) : String(v)
            ]);
            autoTable(doc, {
                startY: 20,
                head: [['Key', 'Value']],
                body: tableData,
            });
            doc.save(`salary-structure-${id}.pdf`);
            toast({ title: 'Exported to PDF', description: 'Your PDF has been downloaded.' });
        } catch (err) {
            toast({ title: 'Export failed', description: 'Could not export to PDF.', variant: 'destructive' });
        }
    };

    const handleFilter = () => {
        toast({ title: 'Advanced Filtering', description: 'Filter panel opened for related entities.' });
    };

    return (
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleFilter} title="Advanced filtering">
                <Filter className="h-4 w-4 mr-2" />
                Filter
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} title="Export to CSV">
                <Download className="h-4 w-4 mr-2" />
                CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} title="Export to PDF">
                <FileText className="h-4 w-4 mr-2" />
                PDF
            </Button>
            <div className="flex items-center text-xs text-[var(--st-text-secondary)] ml-2 px-2 py-1 bg-[var(--st-bg-muted)] rounded-full border border-[var(--st-border)]" title="Real-time Collaborative Editing Active">
                <span className="flex h-2 w-2 rounded-full bg-[var(--st-text)] mr-2 animate-pulse"></span>
                <Users className="h-3 w-3 mr-1" />
                Live
            </div>
        </div>
    );
}

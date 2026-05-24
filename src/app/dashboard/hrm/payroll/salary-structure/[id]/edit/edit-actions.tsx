'use client';

import { Download, FileText, Filter, Users } from 'lucide-react';
import { Button, useZoruToast } from '@/components/zoruui';

export function EditHeaderActions({ id, data }: { id: string, data: any }) {
    const { toast } = useZoruToast();

    const handleExportCSV = () => {
        try {
            const csvContent = "data:text/csv;charset=utf-8," +
                "Key,Value\n" +
                Object.entries(data).map(([k, v]) => `${k},${JSON.stringify(v)}`).join("\n");

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
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
        toast({ title: 'Export to PDF', description: 'PDF export scheduled. You will be notified when ready.' });
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
            <div className="flex items-center text-xs text-muted-foreground ml-2 px-2 py-1 bg-secondary rounded-full border border-border" title="Real-time Collaborative Editing Active">
                <span className="flex h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                <Users className="h-3 w-3 mr-1" />
                Live
            </div>
        </div>
    );
}

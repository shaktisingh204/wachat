'use client';

import { Button, useToast, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/sabcrm/20ui';
import { Download, FileText, Table } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CrmShiftRotationDoc } from '@/lib/rust-client/crm-shift-rotations';
import type { CrmShiftDoc } from '@/lib/rust-client/crm-shifts';

interface ExportRotationButtonProps {
    rotation: CrmShiftRotationDoc;
    shifts: CrmShiftDoc[];
}

export function ExportRotationButton({ rotation, shifts }: ExportRotationButtonProps) {
    const { toast } = useToast();

    const handleExportCSV = () => {
        try {
            // Create CSV mapping of the pattern
            const header = ['Day Offset', 'Shift Name', 'Shift Time', 'Is Off'];
            const rows = (rotation.pattern || []).map(day => {
                const shift = shifts.find(s => s._id === day.shiftId);
                const shiftName = shift?.name || 'N/A';
                const shiftTime = shift ? `${shift.startTime} - ${shift.endTime}` : 'N/A';
                return [
                    day.dayOffset,
                    `"${shiftName}"`,
                    `"${shiftTime}"`,
                    day.isOff ? 'Yes' : 'No'
                ];
            });

            const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${rotation.name.replace(/\s+/g, '_')}_pattern.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast({
                title: 'Export Successful',
                description: 'The shift rotation pattern has been exported to CSV.',
            });
        } catch (error) {
            console.error('Export failed:', error);
            toast({
                title: 'Export Failed',
                description: 'There was an error exporting the pattern data.',
                variant: 'destructive',
            });
        }
    };

    const handleExportPDF = () => {
        try {
            const doc = new jsPDF();
            
            doc.setFontSize(16);
            doc.text(`Shift Rotation: ${rotation.name}`, 14, 22);
            doc.setFontSize(11);
            doc.text(`Cycle Length: ${rotation.cycleDays} days`, 14, 30);
            
            const header = [['Day Offset', 'Shift Name', 'Shift Time', 'Is Off']];
            const rows = (rotation.pattern || []).map(day => {
                const shift = shifts.find(s => s._id === day.shiftId);
                const shiftName = shift?.name || 'N/A';
                const shiftTime = shift ? `${shift.startTime} - ${shift.endTime}` : 'N/A';
                return [
                    day.dayOffset.toString(),
                    shiftName,
                    shiftTime,
                    day.isOff ? 'Yes' : 'No'
                ];
            });

            autoTable(doc, {
                startY: 36,
                head: header,
                body: rows,
            });

            doc.save(`${rotation.name.replace(/\s+/g, '_')}_pattern.pdf`);
            
            toast({
                title: 'Export Successful',
                description: 'The shift rotation pattern has been exported to PDF.',
            });
        } catch (error) {
            console.error('Export failed:', error);
            toast({
                title: 'Export Failed',
                description: 'There was an error exporting the PDF data.',
                variant: 'destructive',
            });
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
                    <Table className="h-4 w-4" />
                    Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} className="gap-2 cursor-pointer">
                    <FileText className="h-4 w-4" />
                    Export as PDF
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

'use client';

import { Button, useZoruToast } from '@/components/zoruui';
import { Download } from 'lucide-react';
import type { CrmShiftRotationDoc } from '@/lib/rust-client/crm-shift-rotations';
import type { CrmShiftDoc } from '@/lib/rust-client/crm-shifts';

interface ExportRotationButtonProps {
    rotation: CrmShiftRotationDoc;
    shifts: CrmShiftDoc[];
}

export function ExportRotationButton({ rotation, shifts }: ExportRotationButtonProps) {
    const { toast } = useZoruToast();

    const handleExport = () => {
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

    return (
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export to CSV
        </Button>
    );
}

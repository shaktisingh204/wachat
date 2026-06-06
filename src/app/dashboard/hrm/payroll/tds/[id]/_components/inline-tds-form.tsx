'use client';

import React, { useState } from 'react';
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';
import { Save, X } from 'lucide-react';
import { toast } from 'sonner';

export function InlineTdsForm({
    record,
    onSave,
    onCancel,
}: {
    record: any;
    onSave: (updatedRecord: any) => void;
    onCancel: () => void;
}) {
    const [status, setStatus] = useState(record.status || 'pending');
    const [gross, setGross] = useState(record.grossAmount?.toString() || '0');
    const [tds, setTds] = useState(record.tdsAmount?.toString() || '0');

    const handleSave = () => {
        if (!status || !gross || !tds) {
            toast.error('Please fill all required fields');
            return;
        }

        const updated = {
            ...record,
            status,
            grossAmount: parseFloat(gross),
            tdsAmount: parseFloat(tds),
        };

        onSave(updated);
    };

    return (
        <tr className="bg-zoru-surface-2/30">
            <td className="px-4 py-2">
            </td>
            <td className="px-4 py-2 text-[13px] font-mono text-zoru-ink">
                {record.quarter || '—'}
            </td>
            <td className="px-4 py-2">
                <Input
                    type="number"
                    value={gross}
                    onChange={(e) => setGross(e.target.value)}
                    className="h-8 w-24 text-right"
                />
            </td>
            <td className="px-4 py-2">
                <Input
                    type="number"
                    value={tds}
                    onChange={(e) => setTds(e.target.value)}
                    className="h-8 w-24 text-right"
                />
            </td>
            <td className="px-4 py-2">
                <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-8 w-[120px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="deposited">Deposited</SelectItem>
                        <SelectItem value="filed">Filed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                </Select>
            </td>
            <td className="px-4 py-2 flex items-center justify-end gap-2">
                <Button variant="default" size="icon" className="h-8 w-8" onClick={handleSave}>
                    <Save className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="icon" className="h-8 w-8" onClick={onCancel}>
                    <X className="h-4 w-4" />
                </Button>
            </td>
        </tr>
    );
}

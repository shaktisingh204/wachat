import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/zoruui/dialog';
import { Label } from '@/components/zoruui/label';
import { Input, ZoruButton } from '@/components/sabcrm/20ui/compat';

export function TdsAdjustForm({
    editingRow,
    onClose,
    onSave
}: {
    editingRow: any;
    onClose: () => void;
    onSave: (val: number) => void;
}) {
    const [newTdsValue, setNewTdsValue] = useState("");

    useEffect(() => {
        if (editingRow) {
            setNewTdsValue(String(editingRow.tds));
        }
    }, [editingRow]);

    const handleUpdateTds = () => {
        if (!editingRow) return;
        const val = Number(newTdsValue);
        onSave(val);
    };

    return (
        <Dialog open={!!editingRow} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-lg">Adjust TDS Amount</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label className="text-[13px] text-zoru-ink-muted">Employee</Label>
                        <div className="font-medium text-zoru-ink">
                            {editingRow?.employee?.firstName} {editingRow?.employee?.lastName}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[13px] text-zoru-ink-muted">New TDS Amount (₹)</Label>
                        <Input 
                            type="number" 
                            value={newTdsValue} 
                            onChange={e => setNewTdsValue(e.target.value)} 
                            autoFocus
                        />
                    </div>
                </div>
                <DialogFooter>
                    <ZoruButton variant="outline" onClick={onClose}>Cancel</ZoruButton>
                    <ZoruButton onClick={handleUpdateTds} variant="primary">Save Changes</ZoruButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

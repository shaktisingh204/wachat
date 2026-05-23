'use server';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { getCrmStockAdjustmentById } from '@/app/actions/crm-inventory.actions';
import { saveCrmStockAdjustment } from '@/app/actions/crm-inventory-writes.actions';
import { revalidatePath } from 'next/cache';

export async function revertStockAdjustment(adjustmentId: string) {
    const session = await getSession();
    if (!session?.user?._id) return { success: false, error: 'Unauthorized' };

    const adj = await getCrmStockAdjustmentById(adjustmentId);
    if (!adj) return { success: false, error: 'Adjustment not found' };
    
    // Create a form data for the compensating adjustment
    const fd = new FormData();
    fd.append('warehouseId', String(adj.warehouseId));
    fd.append('reason', 'Correction');
    fd.append('date', new Date().toISOString().slice(0, 10));
    fd.append('referenceNumber', `Revert of ${adj.adjustmentNumber || adjustmentId.slice(-6)}`);
    fd.append('notes', `Automatically generated to revert adjustment ${adj.adjustmentNumber || adjustmentId.slice(-6)}`);
    
    const lines = (adj as any).lines || [];
    
    if (lines.length > 0) {
        lines.forEach((l: any, i: number) => {
            const before = l.qtyAfter || 0;
            const delta = (l.qtyAfter || 0) - (l.qtyBefore || 0);
            const after = before - delta; // reverse the delta
            
            fd.append(`lines[${i}][productId]`, String(l.productId));
            fd.append(`lines[${i}][qtyBefore]`, String(before));
            fd.append(`lines[${i}][qtyAfter]`, String(after));
            if (l.batch) fd.append(`lines[${i}][batch]`, l.batch);
            if (l.serial) fd.append(`lines[${i}][serial]`, l.serial);
            if (l.costPerUnit) fd.append(`lines[${i}][costPerUnit]`, String(l.costPerUnit));
        });
    } else {
        const qty = Number(adj.quantity || 0);
        const before = 0;
        const after = -qty;
        fd.append(`lines[0][productId]`, String(adj.productId));
        fd.append(`lines[0][qtyBefore]`, String(before));
        fd.append(`lines[0][qtyAfter]`, String(after));
    }
    
    const res = await saveCrmStockAdjustment(null, fd);
    if (res.error) return { success: false, error: res.error };
    
    revalidatePath('/dashboard/crm/inventory/adjustments');
    return { success: true, newAdjustmentId: res.adjustmentId };
}

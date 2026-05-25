import type { CrmStockAdjustment, CrmStockAdjustmentLine as CoreLine } from '@/lib/definitions';

export interface StockAdjustmentLine {
    productId: string;
    qtyBefore?: number;
    qtyAfter?: number;
    delta?: number;
    batch?: string;
    serial?: string;
    costPerUnit?: number;
}

export interface StockAdjustment {
    _id: string;
    date: string | Date;
    reason: string;
    warehouseId?: string;
    warehouseName?: string;
    referenceNumber?: string;
    quantity?: number;
    notes?: string;
    productId?: string;
    productName?: string;
    status: 'pending' | 'approved' | 'rejected' | string;
    costPerUnit?: number;
    adjustmentNumber?: string;
    lines?: StockAdjustmentLine[];
    approvedBy?: string;
    approvedByName?: string;
    approvedAt?: string | Date;
    approvalNotes?: string;
    attachments?: string[];
}

export function mapToStockAdjustmentDto(adj: Partial<CrmStockAdjustment> & Record<string, any>): StockAdjustment {
    if (!adj) return adj as any;
    return {
        _id: String(adj._id),
        date: adj.date ? new Date(adj.date).toISOString() : new Date().toISOString(),
        reason: adj.reason || '',
        warehouseId: adj.warehouseId ? String(adj.warehouseId) : undefined,
        warehouseName: adj.warehouseName,
        referenceNumber: adj.referenceNumber,
        quantity: typeof adj.quantity === 'number' ? adj.quantity : undefined,
        notes: adj.notes,
        productId: adj.productId ? String(adj.productId) : undefined,
        productName: adj.productName,
        status: adj.status || 'pending',
        costPerUnit: Number(adj.costPerUnit || 0),
        adjustmentNumber: adj.adjustmentNumber,
        lines: Array.isArray(adj.lines) ? adj.lines.map((l: CoreLine & Record<string, any>) => ({
            productId: String(l.productId),
            qtyBefore: typeof l.qtyBefore === 'number' ? l.qtyBefore : undefined,
            qtyAfter: typeof l.qtyAfter === 'number' ? l.qtyAfter : undefined,
            delta: typeof l.delta === 'number' ? l.delta : undefined,
            batch: l.batch,
            serial: l.serial,
            costPerUnit: typeof l.costPerUnit === 'number' ? l.costPerUnit : undefined,
        })) : [],
        approvedBy: adj.approvedBy ? String(adj.approvedBy) : undefined,
        approvedByName: adj.approvedByName,
        approvedAt: adj.approvedAt ? new Date(adj.approvedAt).toISOString() : undefined,
        approvalNotes: adj.approvalNotes,
        attachments: Array.isArray(adj.attachments) ? adj.attachments : [],
    };
}

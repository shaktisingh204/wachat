'use server';

import { revalidatePath } from 'next/cache';
import { crmDeliveryChallansApi } from '@/lib/rust-client/crm-delivery-challans';
import { itemApi } from '@/lib/rust-client/crm-items';
import { getSalesOrder } from './sales-orders.actions';

export async function splitSalesOrderBackorderAction(salesOrderId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    if (!salesOrderId) return { success: false, error: 'Sales order id required.' };
    
    const { order } = await getSalesOrder(salesOrderId);
    if (!order) return { success: false, error: 'Sales order not found' };

    const items = order.items ?? [];
    if (items.length === 0) return { success: false, error: 'No items in order' };

    const stockMap: Record<string, number> = {};
    const uniqueItemIds = Array.from(new Set(items.map(li => li.itemId).filter(Boolean))) as string[];
    
    if (uniqueItemIds.length > 0) {
      const promises = uniqueItemIds.map(id => itemApi.getById(id).catch(() => null));
      const fetchedItems = await Promise.all(promises);
      fetchedItems.forEach(item => {
        if (item && item._id) stockMap[item._id] = item.totalStock || 0;
      });
    }

    const availableItems: any[] = [];
    const backorderedItems: any[] = [];

    items.forEach(li => {
      const qty = Number(li.qty) || 0;
      const qtyDelivered = Number(li.qtyDelivered) || 0;
      const qtyPending = li.qtyPending != null ? Number(li.qtyPending) : Math.max(0, qty - qtyDelivered);
      if (qtyPending <= 0) return;

      const itemId = li.itemId ? String(li.itemId) : '';
      const stock = stockMap[itemId] || 0;

      if (stock >= qtyPending) {
        availableItems.push({
          itemId: li.itemId,
          description: li.description || '',
          quantity: qtyPending,
          unit: li.unit,
          hsnCode: li.hsnSac,
        });
      } else if (stock > 0) {
        availableItems.push({
          itemId: li.itemId,
          description: li.description || '',
          quantity: stock,
          unit: li.unit,
          hsnCode: li.hsnSac,
        });
        backorderedItems.push({
          itemId: li.itemId,
          description: li.description || '',
          quantity: qtyPending - stock,
          unit: li.unit,
          hsnCode: li.hsnSac,
        });
      } else {
        backorderedItems.push({
          itemId: li.itemId,
          description: li.description || '',
          quantity: qtyPending,
          unit: li.unit,
          hsnCode: li.hsnSac,
        });
      }
    });

    if (availableItems.length === 0 && backorderedItems.length === 0) {
      return { success: false, error: 'No pending items to split' };
    }

    if (availableItems.length === 0 || backorderedItems.length === 0) {
      return { success: false, error: 'Cannot split: pending items are either entirely available or entirely backordered.' };
    }

    const dateIso = new Date().toISOString().split('T')[0] + 'T00:00:00Z';
    const soNo = order.soNo || salesOrderId.slice(-6);

    await crmDeliveryChallansApi.create({
      challanNumber: `DC-${soNo}-A`,
      accountId: order.clientId,
      challanDate: dateIso,
      lineItems: availableItems,
      reason: 'Auto-split: Available',
      fromKind: 'salesOrder',
      fromId: salesOrderId,
    });

    await crmDeliveryChallansApi.create({
      challanNumber: `DC-${soNo}-B`,
      accountId: order.clientId,
      challanDate: dateIso,
      lineItems: backorderedItems,
      reason: 'Auto-split: Backordered',
      fromKind: 'salesOrder',
      fromId: salesOrderId,
    });

    revalidatePath(`/dashboard/crm/sales/orders/${salesOrderId}`);
    revalidatePath('/dashboard/crm/sales/delivery-challans');
    return { success: true, message: 'Successfully split into two Delivery Challans.' };

  } catch (e) {
    return { success: false, error: String(e) };
  }
}


'use server';

async function zohoInventoryFetch(accessToken: string, organizationId: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[ZohoInventory] ${method} ${path}`);
    const sep = path.includes('?') ? '&' : '?';
    const url = `https://inventory.zoho.com/api/v1${path}${sep}organization_id=${organizationId}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.code || `Zoho Inventory API error: ${res.status}`);
    }
    return data;
}

export async function executeZohoInventoryAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const organizationId = String(inputs.organizationId ?? '').trim();
        if (!accessToken || !organizationId) throw new Error('accessToken and organizationId are required.');
        const zi = (method: string, path: string, body?: any) => zohoInventoryFetch(accessToken, organizationId, method, path, body, logger);

        switch (actionName) {
            case 'listItems': {
                const page = Number(inputs.page ?? 1);
                const data = await zi('GET', `/items?page=${page}`);
                return { output: { items: data.items ?? [], count: String(data.items?.length ?? 0) } };
            }

            case 'getItem': {
                const itemId = String(inputs.itemId ?? '').trim();
                if (!itemId) throw new Error('itemId is required.');
                const data = await zi('GET', `/items/${itemId}`);
                return { output: { item: data.item ?? data } };
            }

            case 'createItem': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.rate !== undefined) body.rate = Number(inputs.rate);
                if (inputs.unit) body.unit = String(inputs.unit);
                if (inputs.sku) body.sku = String(inputs.sku);
                if (inputs.description) body.description = String(inputs.description);
                const data = await zi('POST', '/items', body);
                return { output: { item: data.item ?? data, itemId: String(data.item?.item_id ?? '') } };
            }

            case 'updateItem': {
                const itemId = String(inputs.itemId ?? '').trim();
                if (!itemId) throw new Error('itemId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.rate !== undefined) body.rate = Number(inputs.rate);
                if (inputs.unit) body.unit = String(inputs.unit);
                if (inputs.description) body.description = String(inputs.description);
                const data = await zi('PUT', `/items/${itemId}`, body);
                return { output: { item: data.item ?? data } };
            }

            case 'deleteItem': {
                const itemId = String(inputs.itemId ?? '').trim();
                if (!itemId) throw new Error('itemId is required.');
                await zi('DELETE', `/items/${itemId}`);
                return { output: { deleted: 'true' } };
            }

            case 'listSalesOrders': {
                const page = Number(inputs.page ?? 1);
                const data = await zi('GET', `/salesorders?page=${page}`);
                return { output: { salesorders: data.salesorders ?? [], count: String(data.salesorders?.length ?? 0) } };
            }

            case 'getSalesOrder': {
                const salesorderId = String(inputs.salesorderId ?? '').trim();
                if (!salesorderId) throw new Error('salesorderId is required.');
                const data = await zi('GET', `/salesorders/${salesorderId}`);
                return { output: { salesorder: data.salesorder ?? data } };
            }

            case 'createSalesOrder': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const body: any = { customer_id: customerId };
                if (inputs.lineItems) body.line_items = inputs.lineItems;
                if (inputs.date) body.date = String(inputs.date);
                if (inputs.shipmentDate) body.shipment_date = String(inputs.shipmentDate);
                const data = await zi('POST', '/salesorders', body);
                return { output: { salesorder: data.salesorder ?? data, salesorderId: String(data.salesorder?.salesorder_id ?? '') } };
            }

            case 'confirmSalesOrder': {
                const salesorderId = String(inputs.salesorderId ?? '').trim();
                if (!salesorderId) throw new Error('salesorderId is required.');
                const data = await zi('POST', `/salesorders/${salesorderId}/confirm`);
                return { output: { status: data.message ?? 'confirmed', salesorderId } };
            }

            case 'listPurchaseOrders': {
                const page = Number(inputs.page ?? 1);
                const data = await zi('GET', `/purchaseorders?page=${page}`);
                return { output: { purchaseorders: data.purchaseorders ?? [], count: String(data.purchaseorders?.length ?? 0) } };
            }

            case 'getPurchaseOrder': {
                const purchaseorderId = String(inputs.purchaseorderId ?? '').trim();
                if (!purchaseorderId) throw new Error('purchaseorderId is required.');
                const data = await zi('GET', `/purchaseorders/${purchaseorderId}`);
                return { output: { purchaseorder: data.purchaseorder ?? data } };
            }

            case 'createPurchaseOrder': {
                const vendorId = String(inputs.vendorId ?? '').trim();
                if (!vendorId) throw new Error('vendorId is required.');
                const body: any = { vendor_id: vendorId };
                if (inputs.lineItems) body.line_items = inputs.lineItems;
                if (inputs.date) body.date = String(inputs.date);
                const data = await zi('POST', '/purchaseorders', body);
                return { output: { purchaseorder: data.purchaseorder ?? data, purchaseorderId: String(data.purchaseorder?.purchaseorder_id ?? '') } };
            }

            case 'listContacts': {
                const page = Number(inputs.page ?? 1);
                const data = await zi('GET', `/contacts?page=${page}`);
                return { output: { contacts: data.contacts ?? [], count: String(data.contacts?.length ?? 0) } };
            }

            case 'createContact': {
                const contactName = String(inputs.contactName ?? '').trim();
                if (!contactName) throw new Error('contactName is required.');
                const body: any = { contact_name: contactName };
                if (inputs.email) body.email = String(inputs.email);
                if (inputs.phone) body.phone = String(inputs.phone);
                if (inputs.contactType) body.contact_type = String(inputs.contactType);
                const data = await zi('POST', '/contacts', body);
                return { output: { contact: data.contact ?? data, contactId: String(data.contact?.contact_id ?? '') } };
            }

            case 'listWarehouses': {
                const data = await zi('GET', '/warehouses');
                return { output: { warehouses: data.warehouses ?? [], count: String(data.warehouses?.length ?? 0) } };
            }

            case 'adjustInventory': {
                const itemId = String(inputs.itemId ?? '').trim();
                const adjustmentType = String(inputs.adjustmentType ?? 'quantity').trim();
                if (!itemId) throw new Error('itemId is required.');
                const body: any = {
                    date: inputs.date ?? new Date().toISOString().split('T')[0],
                    reason: inputs.reason ?? 'Adjustment',
                    line_items: [{
                        item_id: itemId,
                        quantity_adjusted: Number(inputs.quantityAdjusted ?? 0),
                    }],
                };
                if (inputs.warehouseId) body.warehouse_id = String(inputs.warehouseId);
                const data = await zi('POST', '/inventoryadjustments', body);
                return { output: { adjustment: data.inventory_adjustment ?? data } };
            }

            default:
                return { error: `Zoho Inventory action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Zoho Inventory action failed.' };
    }
}

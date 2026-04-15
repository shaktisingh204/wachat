'use server';

export async function executeLightspeedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const accountId = String(inputs.accountId ?? '').trim();
        if (!accessToken || !accountId) {
            throw new Error('accessToken and accountId are required.');
        }

        const baseUrl = `https://api.lightspeedapp.com/API/V3/Account/${accountId}`;

        async function request(method: string, path: string, body?: any, params?: Record<string, string>) {
            logger?.log(`[Lightspeed] ${method} ${path}`);
            let url = `${baseUrl}${path}`;
            if (params) {
                const qs = new URLSearchParams(params).toString();
                if (qs) url += `?${qs}`;
            }
            const options: RequestInit = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(url, options);
            if (res.status === 204) return {};
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json?.message || json?.error || `Lightspeed API error: ${res.status}`);
            }
            return json;
        }

        switch (actionName) {
            case 'listProducts': {
                const limit = Math.max(1, Math.min(100, Number(inputs.limit) || 20));
                const offset = Math.max(0, Number(inputs.offset) || 0);
                const params: Record<string, string> = { limit: String(limit), offset: String(offset) };
                if (inputs.categoryID) params.categoryID = String(inputs.categoryID);
                if (inputs.archived) params.archived = inputs.archived;
                const data = await request('GET', '/Item.json', undefined, params);
                return { output: { products: data.Item ?? [], count: data['@attributes']?.count } };
            }

            case 'getProduct': {
                const itemId = String(inputs.itemId ?? '').trim();
                if (!itemId) throw new Error('itemId is required.');
                const data = await request('GET', `/Item/${itemId}.json`);
                return { output: { product: data.Item ?? data } };
            }

            case 'createProduct': {
                const description = String(inputs.description ?? '').trim();
                if (!description) throw new Error('description is required.');
                const item: any = { description };
                if (inputs.ean) item.ean = inputs.ean;
                if (inputs.upc) item.upc = inputs.upc;
                if (inputs.manufacturerSku) item.manufacturerSku = inputs.manufacturerSku;
                if (inputs.defaultCost !== undefined) item.defaultCost = String(inputs.defaultCost);
                if (inputs.avgCost !== undefined) item.avgCost = String(inputs.avgCost);
                if (inputs.tax !== undefined) item.tax = inputs.tax;
                if (inputs.categoryID) item.categoryID = inputs.categoryID;
                if (inputs.taxClassID) item.taxClassID = inputs.taxClassID;
                const data = await request('POST', '/Item.json', { Item: item });
                logger?.log(`[Lightspeed] Created item ${data.Item?.itemID}`);
                return { output: { product: data.Item ?? data } };
            }

            case 'updateProduct': {
                const itemId = String(inputs.itemId ?? '').trim();
                if (!itemId) throw new Error('itemId is required.');
                const item: any = {};
                if (inputs.description) item.description = inputs.description;
                if (inputs.ean) item.ean = inputs.ean;
                if (inputs.upc) item.upc = inputs.upc;
                if (inputs.defaultCost !== undefined) item.defaultCost = String(inputs.defaultCost);
                if (inputs.archived !== undefined) item.archived = inputs.archived;
                if (inputs.categoryID) item.categoryID = inputs.categoryID;
                const data = await request('PUT', `/Item/${itemId}.json`, { Item: item });
                return { output: { product: data.Item ?? data, updated: true } };
            }

            case 'deleteProduct': {
                const itemId = String(inputs.itemId ?? '').trim();
                if (!itemId) throw new Error('itemId is required.');
                await request('DELETE', `/Item/${itemId}.json`);
                logger?.log(`[Lightspeed] Deleted item ${itemId}`);
                return { output: { deleted: true, itemId } };
            }

            case 'listOrders': {
                const limit = Math.max(1, Math.min(100, Number(inputs.limit) || 20));
                const offset = Math.max(0, Number(inputs.offset) || 0);
                const params: Record<string, string> = { limit: String(limit), offset: String(offset) };
                if (inputs.vendorID) params.vendorID = String(inputs.vendorID);
                if (inputs.complete) params.complete = inputs.complete;
                const data = await request('GET', '/Order.json', undefined, params);
                return { output: { orders: data.Order ?? [], count: data['@attributes']?.count } };
            }

            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await request('GET', `/Order/${orderId}.json`);
                return { output: { order: data.Order ?? data } };
            }

            case 'createOrder': {
                const vendorID = String(inputs.vendorID ?? '').trim();
                if (!vendorID) throw new Error('vendorID is required.');
                const order: any = { vendorID };
                if (inputs.orderLines) order.orderLines = inputs.orderLines;
                if (inputs.orderDate) order.orderDate = inputs.orderDate;
                if (inputs.expectedDate) order.expectedDate = inputs.expectedDate;
                if (inputs.memo) order.memo = inputs.memo;
                const data = await request('POST', '/Order.json', { Order: order });
                logger?.log(`[Lightspeed] Created order ${data.Order?.orderID}`);
                return { output: { order: data.Order ?? data } };
            }

            case 'listCustomers': {
                const limit = Math.max(1, Math.min(100, Number(inputs.limit) || 20));
                const offset = Math.max(0, Number(inputs.offset) || 0);
                const params: Record<string, string> = { limit: String(limit), offset: String(offset) };
                if (inputs.firstName) params['Customer.firstName'] = inputs.firstName;
                if (inputs.lastName) params['Customer.lastName'] = inputs.lastName;
                if (inputs.email) params['Contact.email'] = inputs.email;
                const data = await request('GET', '/Customer.json', undefined, params);
                return { output: { customers: data.Customer ?? [], count: data['@attributes']?.count } };
            }

            case 'getCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const data = await request('GET', `/Customer/${customerId}.json`);
                return { output: { customer: data.Customer ?? data } };
            }

            case 'createCustomer': {
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                if (!firstName || !lastName) throw new Error('firstName and lastName are required.');
                const customer: any = { firstName, lastName };
                if (inputs.Contact) customer.Contact = inputs.Contact;
                if (inputs.creditAccountID) customer.creditAccountID = inputs.creditAccountID;
                const data = await request('POST', '/Customer.json', { Customer: customer });
                logger?.log(`[Lightspeed] Created customer ${data.Customer?.customerID}`);
                return { output: { customer: data.Customer ?? data } };
            }

            case 'listInventory': {
                const limit = Math.max(1, Math.min(100, Number(inputs.limit) || 20));
                const offset = Math.max(0, Number(inputs.offset) || 0);
                const params: Record<string, string> = { limit: String(limit), offset: String(offset) };
                if (inputs.shopID) params.shopID = String(inputs.shopID);
                if (inputs.itemID) params.itemID = String(inputs.itemID);
                const data = await request('GET', '/ItemShop.json', undefined, params);
                return { output: { inventory: data.ItemShop ?? [], count: data['@attributes']?.count } };
            }

            case 'getInventory': {
                const itemShopId = String(inputs.itemShopId ?? '').trim();
                if (!itemShopId) throw new Error('itemShopId is required.');
                const data = await request('GET', `/ItemShop/${itemShopId}.json`);
                return { output: { inventory: data.ItemShop ?? data } };
            }

            case 'listVendors': {
                const limit = Math.max(1, Math.min(100, Number(inputs.limit) || 20));
                const offset = Math.max(0, Number(inputs.offset) || 0);
                const params: Record<string, string> = { limit: String(limit), offset: String(offset) };
                const data = await request('GET', '/Vendor.json', undefined, params);
                return { output: { vendors: data.Vendor ?? [], count: data['@attributes']?.count } };
            }

            case 'createVendor': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const vendor: any = { name };
                if (inputs.accountNumber) vendor.accountNumber = inputs.accountNumber;
                if (inputs.Contact) vendor.Contact = inputs.Contact;
                if (inputs.note) vendor.note = inputs.note;
                const data = await request('POST', '/Vendor.json', { Vendor: vendor });
                logger?.log(`[Lightspeed] Created vendor ${data.Vendor?.vendorID}`);
                return { output: { vendor: data.Vendor ?? data } };
            }

            default:
                return { error: `Lightspeed action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e?.message || 'Lightspeed action failed.';
        return { error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
    }
}

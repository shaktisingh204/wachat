'use server';

export async function executeMedusaV2Action(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = String(inputs.baseUrl ?? '').replace(/\/$/, '');
        const accessToken = String(inputs.accessToken ?? '').trim();
        const adminBase = `${baseUrl}/admin`;

        const req = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${adminBase}${path}`, {
                method,
                headers: {
                    'x-medusa-access-token': accessToken,
                    'Content-Type': 'application/json',
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || `Medusa API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listProducts': {
                const limit = inputs.limit ?? 20;
                const offset = inputs.offset ?? 0;
                const data = await req('GET', `/products?limit=${limit}&offset=${offset}`);
                return { output: { products: data.products, count: data.count, offset: data.offset, limit: data.limit } };
            }

            case 'getProduct': {
                const data = await req('GET', `/products/${inputs.id}`);
                return { output: { product: data.product } };
            }

            case 'createProduct': {
                const data = await req('POST', '/products', inputs.product);
                return { output: { product: data.product } };
            }

            case 'updateProduct': {
                const data = await req('POST', `/products/${inputs.id}`, inputs.product);
                return { output: { product: data.product } };
            }

            case 'deleteProduct': {
                const data = await req('DELETE', `/products/${inputs.id}`);
                return { output: { deleted: data.deleted, id: data.id } };
            }

            case 'listOrders': {
                const limit = inputs.limit ?? 20;
                const offset = inputs.offset ?? 0;
                const data = await req('GET', `/orders?limit=${limit}&offset=${offset}`);
                return { output: { orders: data.orders, count: data.count, offset: data.offset, limit: data.limit } };
            }

            case 'getOrder': {
                const data = await req('GET', `/orders/${inputs.id}`);
                return { output: { order: data.order } };
            }

            case 'updateOrder': {
                const data = await req('POST', `/orders/${inputs.id}`, inputs.order);
                return { output: { order: data.order } };
            }

            case 'fulfillOrder': {
                const data = await req('POST', `/orders/${inputs.id}/fulfillment`, inputs.fulfillment ?? {});
                return { output: { order: data.order } };
            }

            case 'listCustomers': {
                const limit = inputs.limit ?? 20;
                const offset = inputs.offset ?? 0;
                const data = await req('GET', `/customers?limit=${limit}&offset=${offset}`);
                return { output: { customers: data.customers, count: data.count, offset: data.offset, limit: data.limit } };
            }

            case 'getCustomer': {
                const data = await req('GET', `/customers/${inputs.id}`);
                return { output: { customer: data.customer } };
            }

            case 'createCustomer': {
                const data = await req('POST', '/customers', inputs.customer);
                return { output: { customer: data.customer } };
            }

            case 'listInventoryItems': {
                const limit = inputs.limit ?? 20;
                const offset = inputs.offset ?? 0;
                const data = await req('GET', `/inventory-items?limit=${limit}&offset=${offset}`);
                return { output: { inventory_items: data.inventory_items, count: data.count } };
            }

            case 'updateInventoryLevel': {
                const data = await req('POST', `/inventory-items/${inputs.inventoryItemId}/location-levels/${inputs.locationId}`, {
                    stocked_quantity: inputs.stockedQuantity,
                });
                return { output: { inventory_level: data.inventory_level } };
            }

            case 'listSalesChannels': {
                const limit = inputs.limit ?? 20;
                const offset = inputs.offset ?? 0;
                const data = await req('GET', `/sales-channels?limit=${limit}&offset=${offset}`);
                return { output: { sales_channels: data.sales_channels, count: data.count } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}

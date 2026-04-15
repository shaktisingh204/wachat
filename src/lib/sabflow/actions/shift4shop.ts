'use server';

export async function executeShift4ShopAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const storeUrl = String(inputs.storeUrl ?? '').trim().replace(/\/$/, '');
        const privateKey = String(inputs.privateKey ?? '').trim();
        const token = String(inputs.token ?? '').trim();
        if (!storeUrl || !privateKey || !token) {
            throw new Error('storeUrl, privateKey, and token are required.');
        }

        const apiUrl = `${storeUrl}/api.asp`;

        async function request(action: string, params?: Record<string, any>, method: string = 'POST') {
            logger?.log(`[Shift4Shop] ${action}`);
            const payload: Record<string, any> = {
                Action: action,
                ...(params || {}),
            };
            const res = await fetch(apiUrl, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    SecureUrl: storeUrl,
                    PrivateKey: privateKey,
                    Token: token,
                },
                body: JSON.stringify(payload),
            });
            const text = await res.text();
            let json: any;
            try { json = JSON.parse(text); } catch { json = { raw: text }; }
            if (!res.ok) {
                throw new Error(json?.Errors?.[0]?.Description || json?.Error || `Shift4Shop API error: ${res.status}`);
            }
            if (json?.Errors?.length) {
                throw new Error(json.Errors[0].Description || 'Shift4Shop returned errors.');
            }
            return json;
        }

        switch (actionName) {
            case 'listProducts': {
                const limit = Math.max(1, Math.min(100, Number(inputs.limit) || 20));
                const offset = Math.max(0, Number(inputs.offset) || 0);
                const data = await request('getproducts', {
                    params: [{ limit, offset, ...(inputs.categoryId ? { categoryid: inputs.categoryId } : {}) }],
                });
                return { output: { products: data.Products ?? data } };
            }

            case 'getProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const data = await request('getproduct', { params: [{ productid: productId }] });
                return { output: { product: data.Product ?? data } };
            }

            case 'createProduct': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const product: any = { Name: name };
                if (inputs.sku) product.SKUInfo = { SKU: inputs.sku };
                if (inputs.price !== undefined) product.Price = String(inputs.price);
                if (inputs.description) product.Description = inputs.description;
                if (inputs.stock !== undefined) product.Stock = inputs.stock;
                if (inputs.weight !== undefined) product.ShipWeight = inputs.weight;
                if (inputs.categoryId) product.CategoryID = inputs.categoryId;
                const data = await request('addproduct', { params: [product] });
                logger?.log(`[Shift4Shop] Created product ${data.Key}`);
                return { output: { productId: data.Key, created: true } };
            }

            case 'updateProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const product: any = { ProductID: productId };
                if (inputs.name) product.Name = inputs.name;
                if (inputs.price !== undefined) product.Price = String(inputs.price);
                if (inputs.description) product.Description = inputs.description;
                if (inputs.stock !== undefined) product.Stock = inputs.stock;
                if (inputs.hide !== undefined) product.Hide = inputs.hide;
                const data = await request('updateproduct', { params: [product] });
                return { output: { updated: true, productId, result: data } };
            }

            case 'deleteProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const data = await request('deleteproduct', { params: [{ ProductID: productId }] });
                logger?.log(`[Shift4Shop] Deleted product ${productId}`);
                return { output: { deleted: true, productId, result: data } };
            }

            case 'listOrders': {
                const limit = Math.max(1, Math.min(100, Number(inputs.limit) || 20));
                const offset = Math.max(0, Number(inputs.offset) || 0);
                const params: any = { limit, offset };
                if (inputs.status) params.statusid = inputs.status;
                if (inputs.dateFrom) params.startdate = inputs.dateFrom;
                if (inputs.dateTo) params.enddate = inputs.dateTo;
                const data = await request('getorders', { params: [params] });
                return { output: { orders: data.Orders ?? data } };
            }

            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await request('getorder', { params: [{ orderid: orderId }] });
                return { output: { order: data.Order ?? data } };
            }

            case 'updateOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const order: any = { OrderID: orderId };
                if (inputs.statusId) order.StatusID = inputs.statusId;
                if (inputs.trackingNumber) order.TrackingNumber = inputs.trackingNumber;
                if (inputs.shipmentCompany) order.ShipmentLastUpdate = new Date().toISOString();
                const data = await request('updateorder', { params: [order] });
                return { output: { updated: true, orderId, result: data } };
            }

            case 'createOrder': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const order: any = { CustomerID: customerId };
                if (inputs.items) order.Items = inputs.items;
                if (inputs.billingAddress) order.BillingAddress = inputs.billingAddress;
                if (inputs.shippingAddress) order.ShippingAddress = inputs.shippingAddress;
                if (inputs.shippingMethod) order.ShipmentLastUpdate = inputs.shippingMethod;
                const data = await request('addorder', { params: [order] });
                logger?.log(`[Shift4Shop] Created order ${data.Key}`);
                return { output: { orderId: data.Key, created: true } };
            }

            case 'listCustomers': {
                const limit = Math.max(1, Math.min(100, Number(inputs.limit) || 20));
                const offset = Math.max(0, Number(inputs.offset) || 0);
                const params: any = { limit, offset };
                if (inputs.email) params.email = inputs.email;
                const data = await request('getcustomers', { params: [params] });
                return { output: { customers: data.Customers ?? data } };
            }

            case 'getCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const data = await request('getcustomer', { params: [{ customerid: customerId }] });
                return { output: { customer: data.Customer ?? data } };
            }

            case 'createCustomer': {
                const email = String(inputs.email ?? '').trim();
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                if (!email || !firstName || !lastName) throw new Error('email, firstName, and lastName are required.');
                const customer: any = { EMail: email, FirstName: firstName, LastName: lastName };
                if (inputs.phone) customer.Phone = inputs.phone;
                if (inputs.billingAddress) customer.BillingAddress = inputs.billingAddress;
                const data = await request('addcustomer', { params: [customer] });
                logger?.log(`[Shift4Shop] Created customer ${data.Key}`);
                return { output: { customerId: data.Key, created: true } };
            }

            case 'listCategories': {
                const limit = Math.max(1, Math.min(100, Number(inputs.limit) || 20));
                const offset = Math.max(0, Number(inputs.offset) || 0);
                const data = await request('getcategories', { params: [{ limit, offset }] });
                return { output: { categories: data.Categories ?? data } };
            }

            case 'getCategory': {
                const categoryId = String(inputs.categoryId ?? '').trim();
                if (!categoryId) throw new Error('categoryId is required.');
                const data = await request('getcategory', { params: [{ categoryid: categoryId }] });
                return { output: { category: data.Category ?? data } };
            }

            case 'listInventory': {
                const limit = Math.max(1, Math.min(100, Number(inputs.limit) || 20));
                const offset = Math.max(0, Number(inputs.offset) || 0);
                const params: any = { limit, offset };
                if (inputs.productId) params.productid = inputs.productId;
                const data = await request('getproductinventory', { params: [params] });
                return { output: { inventory: data.Inventory ?? data } };
            }

            default:
                return { error: `Shift4Shop action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e?.message || 'Shift4Shop action failed.';
        return { error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
    }
}

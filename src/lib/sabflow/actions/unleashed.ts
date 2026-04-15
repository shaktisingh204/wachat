'use server';

import { createHmac } from 'crypto';

export async function executeUnleashedAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiId = String(inputs.apiId ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiId || !apiKey) throw new Error('apiId and apiKey are required.');

        const BASE_URL = 'https://api.unleashedsoftware.com';

        const ulFetch = async (method: string, path: string, body?: any) => {
            logger?.log(`[Unleashed] ${method} ${path}`);
            const queryString = path.includes('?') ? path.split('?')[1] : '';
            const signature = createHmac('sha256', apiKey).update(queryString).digest('base64');
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: `${apiId}:${signature}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'api-auth-id': apiId,
                    'api-auth-signature': signature,
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${BASE_URL}${path}`, options);
            if (res.status === 204) return {};
            const data = await res.json();
            if (!res.ok) throw new Error(data?.Description || data?.message || `Unleashed API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listProducts': {
                const page = Number(inputs.page ?? 1);
                const pageSize = Number(inputs.pageSize ?? 200);
                const data = await ulFetch('GET', `/Products/${page}?pageSize=${pageSize}`);
                return { output: { products: data.Items ?? [], pagination: data.Pagination ?? {} } };
            }

            case 'getProduct': {
                const productCode = String(inputs.productCode ?? '').trim();
                if (!productCode) throw new Error('productCode is required.');
                const data = await ulFetch('GET', `/Products/${encodeURIComponent(productCode)}`);
                const product = (data.Items ?? [])[0] ?? {};
                return { output: { guid: product.Guid ?? '', productCode: product.ProductCode ?? '', description: product.ProductDescription ?? '', price: String(product.DefaultSellPrice ?? '') } };
            }

            case 'createProduct': {
                const productCode = String(inputs.productCode ?? '').trim();
                const description = String(inputs.description ?? '').trim();
                if (!productCode || !description) throw new Error('productCode and description are required.');
                const body: any = { ProductCode: productCode, ProductDescription: description };
                if (inputs.sellPrice) body.DefaultSellPrice = Number(inputs.sellPrice);
                if (inputs.unitOfMeasure) body.UnitOfMeasure = { Name: String(inputs.unitOfMeasure) };
                const data = await ulFetch('POST', '/Products', body);
                return { output: { guid: data.Guid ?? '', productCode: data.ProductCode ?? '' } };
            }

            case 'updateProduct': {
                const productGuid = String(inputs.productGuid ?? '').trim();
                if (!productGuid) throw new Error('productGuid is required.');
                const body: any = { Guid: productGuid };
                if (inputs.description) body.ProductDescription = String(inputs.description);
                if (inputs.sellPrice) body.DefaultSellPrice = Number(inputs.sellPrice);
                const data = await ulFetch('POST', `/Products/${productGuid}`, body);
                return { output: { guid: data.Guid ?? '', updated: 'true' } };
            }

            case 'listStockOnHand': {
                const page = Number(inputs.page ?? 1);
                const pageSize = Number(inputs.pageSize ?? 200);
                const data = await ulFetch('GET', `/StockOnHand/${page}?pageSize=${pageSize}`);
                return { output: { stock: data.Items ?? [], pagination: data.Pagination ?? {} } };
            }

            case 'listPurchaseOrders': {
                const page = Number(inputs.page ?? 1);
                const pageSize = Number(inputs.pageSize ?? 200);
                const data = await ulFetch('GET', `/PurchaseOrders/${page}?pageSize=${pageSize}`);
                return { output: { orders: data.Items ?? [], pagination: data.Pagination ?? {} } };
            }

            case 'getPurchaseOrder': {
                const orderGuid = String(inputs.orderGuid ?? '').trim();
                if (!orderGuid) throw new Error('orderGuid is required.');
                const data = await ulFetch('GET', `/PurchaseOrders/${orderGuid}`);
                const order = (data.Items ?? [])[0] ?? {};
                return { output: { guid: order.Guid ?? '', orderNumber: order.OrderNumber ?? '', status: order.OrderStatus ?? '' } };
            }

            case 'createPurchaseOrder': {
                const supplierCode = String(inputs.supplierCode ?? '').trim();
                if (!supplierCode) throw new Error('supplierCode is required.');
                const body: any = { Supplier: { SupplierCode: supplierCode } };
                if (inputs.orderLines) body.PurchaseOrderLines = inputs.orderLines;
                if (inputs.orderDate) body.OrderDate = String(inputs.orderDate);
                const data = await ulFetch('POST', '/PurchaseOrders', body);
                return { output: { guid: data.Guid ?? '', orderNumber: data.OrderNumber ?? '' } };
            }

            case 'listSalesOrders': {
                const page = Number(inputs.page ?? 1);
                const pageSize = Number(inputs.pageSize ?? 200);
                const data = await ulFetch('GET', `/SalesOrders/${page}?pageSize=${pageSize}`);
                return { output: { orders: data.Items ?? [], pagination: data.Pagination ?? {} } };
            }

            case 'getSalesOrder': {
                const orderGuid = String(inputs.orderGuid ?? '').trim();
                if (!orderGuid) throw new Error('orderGuid is required.');
                const data = await ulFetch('GET', `/SalesOrders/${orderGuid}`);
                const order = (data.Items ?? [])[0] ?? {};
                return { output: { guid: order.Guid ?? '', orderNumber: order.OrderNumber ?? '', status: order.OrderStatus ?? '' } };
            }

            case 'createSalesOrder': {
                const customerCode = String(inputs.customerCode ?? '').trim();
                if (!customerCode) throw new Error('customerCode is required.');
                const body: any = { Customer: { CustomerCode: customerCode } };
                if (inputs.orderLines) body.SalesOrderLines = inputs.orderLines;
                if (inputs.orderDate) body.OrderDate = String(inputs.orderDate);
                const data = await ulFetch('POST', '/SalesOrders', body);
                return { output: { guid: data.Guid ?? '', orderNumber: data.OrderNumber ?? '' } };
            }

            case 'listSuppliers': {
                const page = Number(inputs.page ?? 1);
                const pageSize = Number(inputs.pageSize ?? 200);
                const data = await ulFetch('GET', `/Suppliers/${page}?pageSize=${pageSize}`);
                return { output: { suppliers: data.Items ?? [], pagination: data.Pagination ?? {} } };
            }

            case 'getSupplier': {
                const supplierCode = String(inputs.supplierCode ?? '').trim();
                if (!supplierCode) throw new Error('supplierCode is required.');
                const data = await ulFetch('GET', `/Suppliers/${encodeURIComponent(supplierCode)}`);
                const supplier = (data.Items ?? [])[0] ?? {};
                return { output: { guid: supplier.Guid ?? '', supplierCode: supplier.SupplierCode ?? '', name: supplier.SupplierName ?? '' } };
            }

            case 'listCustomers': {
                const page = Number(inputs.page ?? 1);
                const pageSize = Number(inputs.pageSize ?? 200);
                const data = await ulFetch('GET', `/Customers/${page}?pageSize=${pageSize}`);
                return { output: { customers: data.Items ?? [], pagination: data.Pagination ?? {} } };
            }

            case 'getCustomer': {
                const customerCode = String(inputs.customerCode ?? '').trim();
                if (!customerCode) throw new Error('customerCode is required.');
                const data = await ulFetch('GET', `/Customers/${encodeURIComponent(customerCode)}`);
                const customer = (data.Items ?? [])[0] ?? {};
                return { output: { guid: customer.Guid ?? '', customerCode: customer.CustomerCode ?? '', name: customer.CustomerName ?? '' } };
            }

            case 'createCustomer': {
                const customerCode = String(inputs.customerCode ?? '').trim();
                const customerName = String(inputs.customerName ?? '').trim();
                if (!customerCode || !customerName) throw new Error('customerCode and customerName are required.');
                const body: any = { CustomerCode: customerCode, CustomerName: customerName };
                if (inputs.email) body.Email = String(inputs.email);
                if (inputs.phone) body.Phone = String(inputs.phone);
                const data = await ulFetch('POST', '/Customers', body);
                return { output: { guid: data.Guid ?? '', customerCode: data.CustomerCode ?? '' } };
            }

            case 'listWarehouses': {
                const data = await ulFetch('GET', '/Warehouses');
                return { output: { warehouses: data.Items ?? [] } };
            }

            case 'getWarehouse': {
                const warehouseCode = String(inputs.warehouseCode ?? '').trim();
                if (!warehouseCode) throw new Error('warehouseCode is required.');
                const data = await ulFetch('GET', `/Warehouses/${encodeURIComponent(warehouseCode)}`);
                const warehouse = (data.Items ?? [])[0] ?? {};
                return { output: { guid: warehouse.Guid ?? '', warehouseCode: warehouse.WarehouseCode ?? '', name: warehouse.WarehouseName ?? '' } };
            }

            default:
                return { error: `Unleashed action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Unleashed action failed.' };
    }
}

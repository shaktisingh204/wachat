'use server';

export async function executeSapAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = (inputs.baseUrl || '').replace(/\/$/, '');
        if (!baseUrl) throw new Error('Missing baseUrl');

        let authHeader: string;
        if (inputs.accessToken) {
            authHeader = `Bearer ${inputs.accessToken}`;
        } else {
            const creds = `${inputs.username}:${inputs.password}`;
            authHeader = `Basic ${Buffer.from(creds).toString('base64')}`;
        }

        const headers: Record<string, string> = {
            Authorization: authHeader,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        };

        // Helper: GET with OData params
        async function odataGet(path: string, params?: Record<string, string>) {
            const qs = params ? '?' + new URLSearchParams(params).toString() : '';
            const res = await fetch(`${baseUrl}${path}${qs}`, { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message?.value || JSON.stringify(data));
            return data;
        }

        switch (actionName) {
            case 'getEntitySet': {
                const { entitySet, filter, select, top, skip, orderby } = inputs;
                const params: Record<string, string> = { $format: 'json' };
                if (filter) params.$filter = filter;
                if (select) params.$select = select;
                if (top) params.$top = String(top);
                if (skip) params.$skip = String(skip);
                if (orderby) params.$orderby = orderby;
                const data = await odataGet(`/${entitySet}`, params);
                return { output: data };
            }
            case 'getEntity': {
                const { entitySet, key } = inputs;
                const data = await odataGet(`/${entitySet}(${key})`, { $format: 'json' });
                return { output: data };
            }
            case 'createEntity': {
                const { entitySet, entity } = inputs;
                const res = await fetch(`${baseUrl}/${entitySet}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(entity),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message?.value || JSON.stringify(data));
                return { output: data };
            }
            case 'updateEntity': {
                const { entitySet, key, entity, method } = inputs;
                const httpMethod = method || 'PATCH';
                const res = await fetch(`${baseUrl}/${entitySet}(${key})`, {
                    method: httpMethod,
                    headers,
                    body: JSON.stringify(entity),
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message?.value || JSON.stringify(data));
                return { output: data };
            }
            case 'deleteEntity': {
                const { entitySet, key } = inputs;
                const res = await fetch(`${baseUrl}/${entitySet}(${key})`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message?.value || JSON.stringify(data));
                return { output: data };
            }
            case 'callFunction': {
                const { functionName, parameters } = inputs;
                const paramStr = parameters
                    ? Object.entries(parameters).map(([k, v]) => `${k}='${v}'`).join(',')
                    : '';
                const path = paramStr ? `/${functionName}(${paramStr})` : `/${functionName}`;
                const data = await odataGet(path, { $format: 'json' });
                return { output: data };
            }
            case 'listBusinessPartners': {
                const { filter, select, top, skip } = inputs;
                const params: Record<string, string> = { $format: 'json' };
                if (filter) params.$filter = filter;
                if (select) params.$select = select;
                if (top) params.$top = String(top);
                if (skip) params.$skip = String(skip);
                const data = await odataGet('/A_BusinessPartner', params);
                return { output: data };
            }
            case 'getBusinessPartner': {
                const { businessPartner } = inputs;
                const data = await odataGet(`/A_BusinessPartner('${businessPartner}')`, { $format: 'json' });
                return { output: data };
            }
            case 'createBusinessPartner': {
                const { businessPartner } = inputs;
                const res = await fetch(`${baseUrl}/A_BusinessPartner`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(businessPartner),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message?.value || JSON.stringify(data));
                return { output: data };
            }
            case 'listSalesOrders': {
                const { filter, select, top, skip } = inputs;
                const params: Record<string, string> = { $format: 'json' };
                if (filter) params.$filter = filter;
                if (select) params.$select = select;
                if (top) params.$top = String(top);
                if (skip) params.$skip = String(skip);
                const data = await odataGet('/A_SalesOrder', params);
                return { output: data };
            }
            case 'getSalesOrder': {
                const { salesOrder } = inputs;
                const data = await odataGet(`/A_SalesOrder('${salesOrder}')`, { $format: 'json' });
                return { output: data };
            }
            case 'createSalesOrder': {
                const { salesOrder } = inputs;
                const res = await fetch(`${baseUrl}/A_SalesOrder`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(salesOrder),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message?.value || JSON.stringify(data));
                return { output: data };
            }
            case 'listPurchaseOrders': {
                const { filter, select, top, skip } = inputs;
                const params: Record<string, string> = { $format: 'json' };
                if (filter) params.$filter = filter;
                if (select) params.$select = select;
                if (top) params.$top = String(top);
                if (skip) params.$skip = String(skip);
                const data = await odataGet('/A_PurchaseOrder', params);
                return { output: data };
            }
            case 'getPurchaseOrder': {
                const { purchaseOrder } = inputs;
                const data = await odataGet(`/A_PurchaseOrder('${purchaseOrder}')`, { $format: 'json' });
                return { output: data };
            }
            case 'getInventory': {
                const { material, plant } = inputs;
                const params: Record<string, string> = { $format: 'json' };
                if (material) params.$filter = `Material eq '${material}'${plant ? ` and Plant eq '${plant}'` : ''}`;
                const data = await odataGet('/A_MaterialStock', params);
                return { output: data };
            }
            default:
                throw new Error(`Unknown SAP action: ${actionName}`);
        }
    } catch (err: any) {
        logger.log(`SAP error [${actionName}]: ${err.message}`);
        return { error: err.message };
    }
}

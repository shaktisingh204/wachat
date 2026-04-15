'use server';

export async function executeBexioAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!apiToken) throw new Error('apiToken is required.');

        const BASE_URL = 'https://api.bexio.com/2.0';

        const bxFetch = async (method: string, path: string, body?: any) => {
            logger?.log(`[Bexio] ${method} ${path}`);
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${BASE_URL}${path}`, options);
            if (res.status === 204) return {};
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || data?.error_description || `Bexio API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listContacts': {
                const limit = Number(inputs.limit ?? 25);
                const offset = Number(inputs.offset ?? 0);
                const data = await bxFetch('GET', `/contact?limit=${limit}&offset=${offset}`);
                return { output: { contacts: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await bxFetch('GET', `/contact/${contactId}`);
                return { output: { id: String(data.id ?? ''), name: data.name_1 ?? '', email: data.mail ?? '', phone: data.phone_fixed ?? '' } };
            }

            case 'createContact': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name_1: name, contact_type_id: Number(inputs.contactTypeId ?? 1) };
                if (inputs.email) body.mail = String(inputs.email);
                if (inputs.phone) body.phone_fixed = String(inputs.phone);
                if (inputs.address) body.address = String(inputs.address);
                const data = await bxFetch('POST', '/contact', body);
                return { output: { id: String(data.id ?? ''), name: data.name_1 ?? '' } };
            }

            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const body: any = {};
                if (inputs.name) body.name_1 = String(inputs.name);
                if (inputs.email) body.mail = String(inputs.email);
                if (inputs.phone) body.phone_fixed = String(inputs.phone);
                const data = await bxFetch('PUT', `/contact/${contactId}`, body);
                return { output: { id: String(data.id ?? ''), updated: 'true' } };
            }

            case 'deleteContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                await bxFetch('DELETE', `/contact/${contactId}`);
                return { output: { contactId, deleted: 'true' } };
            }

            case 'listInvoices': {
                const limit = Number(inputs.limit ?? 25);
                const offset = Number(inputs.offset ?? 0);
                const data = await bxFetch('GET', `/kb_invoice?limit=${limit}&offset=${offset}`);
                return { output: { invoices: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'getInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const data = await bxFetch('GET', `/kb_invoice/${invoiceId}`);
                return { output: { id: String(data.id ?? ''), title: data.title ?? '', total: String(data.total_gross ?? ''), status: data.kb_item_status_id ?? '' } };
            }

            case 'createInvoice': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const body: any = { contact_id: Number(contactId) };
                if (inputs.title) body.title = String(inputs.title);
                if (inputs.positions) body.positions = inputs.positions;
                const data = await bxFetch('POST', '/kb_invoice', body);
                return { output: { id: String(data.id ?? ''), title: data.title ?? '' } };
            }

            case 'updateInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const body: any = {};
                if (inputs.title) body.title = String(inputs.title);
                if (inputs.positions) body.positions = inputs.positions;
                const data = await bxFetch('PUT', `/kb_invoice/${invoiceId}`, body);
                return { output: { id: String(data.id ?? ''), updated: 'true' } };
            }

            case 'issueinvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const data = await bxFetch('POST', `/kb_invoice/${invoiceId}/issue`);
                return { output: { invoiceId, issued: 'true', status: data.kb_item_status_id ?? '' } };
            }

            case 'listOffers': {
                const limit = Number(inputs.limit ?? 25);
                const offset = Number(inputs.offset ?? 0);
                const data = await bxFetch('GET', `/kb_offer?limit=${limit}&offset=${offset}`);
                return { output: { offers: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'getOffer': {
                const offerId = String(inputs.offerId ?? '').trim();
                if (!offerId) throw new Error('offerId is required.');
                const data = await bxFetch('GET', `/kb_offer/${offerId}`);
                return { output: { id: String(data.id ?? ''), title: data.title ?? '', total: String(data.total_gross ?? '') } };
            }

            case 'createOffer': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const body: any = { contact_id: Number(contactId) };
                if (inputs.title) body.title = String(inputs.title);
                if (inputs.positions) body.positions = inputs.positions;
                const data = await bxFetch('POST', '/kb_offer', body);
                return { output: { id: String(data.id ?? ''), title: data.title ?? '' } };
            }

            case 'listOrders': {
                const limit = Number(inputs.limit ?? 25);
                const offset = Number(inputs.offset ?? 0);
                const data = await bxFetch('GET', `/kb_order?limit=${limit}&offset=${offset}`);
                return { output: { orders: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await bxFetch('GET', `/kb_order/${orderId}`);
                return { output: { id: String(data.id ?? ''), title: data.title ?? '', total: String(data.total_gross ?? '') } };
            }

            case 'createOrder': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const body: any = { contact_id: Number(contactId) };
                if (inputs.title) body.title = String(inputs.title);
                if (inputs.positions) body.positions = inputs.positions;
                const data = await bxFetch('POST', '/kb_order', body);
                return { output: { id: String(data.id ?? ''), title: data.title ?? '' } };
            }

            case 'listProducts': {
                const limit = Number(inputs.limit ?? 25);
                const offset = Number(inputs.offset ?? 0);
                const data = await bxFetch('GET', `/article?limit=${limit}&offset=${offset}`);
                return { output: { products: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'getProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('productId is required.');
                const data = await bxFetch('GET', `/article/${productId}`);
                return { output: { id: String(data.id ?? ''), name: data.intern_name ?? '', price: String(data.sale_price ?? '') } };
            }

            case 'listProjects': {
                const limit = Number(inputs.limit ?? 25);
                const offset = Number(inputs.offset ?? 0);
                const data = await bxFetch('GET', `/pr_project?limit=${limit}&offset=${offset}`);
                return { output: { projects: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'createProject': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.contactId) body.contact_id = Number(inputs.contactId);
                if (inputs.startDate) body.start_date = String(inputs.startDate);
                if (inputs.endDate) body.end_date = String(inputs.endDate);
                const data = await bxFetch('POST', '/pr_project', body);
                return { output: { id: String(data.id ?? ''), name: data.name ?? '' } };
            }

            default:
                return { error: `Bexio action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Bexio action failed.' };
    }
}

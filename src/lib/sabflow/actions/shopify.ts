
'use server';

import type { WithId, User } from '@/lib/definitions';
import axios from 'axios';

const SHOPIFY_API_VERSION = '2024-07';

function getShopifyCreds(user: WithId<User>) {
    const settings = (user as any).sabFlowConnections?.find((c: any) => c.appName === 'Shopify');
    const shopName = settings?.credentials?.shopName;
    const accessToken = settings?.credentials?.accessToken;
    if (!shopName || !accessToken) {
        throw new Error('Shopify is not connected.');
    }
    return { shopName: String(shopName).trim(), accessToken: String(accessToken) };
}

async function shopifyRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    creds: { shopName: string; accessToken: string },
    body?: any,
    query?: Record<string, any>
) {
    const base = `https://${creds.shopName}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}`;
    const res = await axios({
        method,
        url: `${base}${path}`,
        data: body,
        params: query,
        headers: {
            'X-Shopify-Access-Token': creds.accessToken,
            'Content-Type': 'application/json',
        },
    });
    return res.data;
}

export async function executeShopifyAction(
    actionName: string,
    inputs: any,
    user: WithId<User>,
    logger: any
) {
    try {
        const creds = getShopifyCreds(user);

        switch (actionName) {
            case 'createProduct': {
                const title = String(inputs.title ?? '').trim();
                const price = Number(inputs.price);
                if (!title) throw new Error('title is required.');
                if (!Number.isFinite(price) || price < 0) throw new Error('price must be a non-negative number.');
                const product: any = {
                    title,
                    body_html: inputs.bodyHtml ? String(inputs.bodyHtml) : undefined,
                    vendor: inputs.vendor ? String(inputs.vendor) : undefined,
                    variants: [{
                        price: price.toFixed(2),
                        sku: inputs.sku ? String(inputs.sku) : undefined,
                    }],
                };
                const data = await shopifyRequest('POST', '/products.json', creds, { product });
                logger.log(`[Shopify] Created product ${data.product?.id}`);
                return { output: { productId: String(data.product?.id), handle: data.product?.handle } };
            }

            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await shopifyRequest('GET', `/orders/${orderId}.json`, creds);
                return { output: { order: data.order } };
            }

            case 'listProducts': {
                const limit = Math.max(1, Math.min(50, Number(inputs.limit) || 10));
                const data = await shopifyRequest('GET', '/products.json', creds, undefined, { limit });
                const products = data.products || [];
                return { output: { products, count: products.length } };
            }

            case 'createCustomer': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const customer: any = { email };
                if (inputs.firstName) customer.first_name = String(inputs.firstName);
                if (inputs.lastName) customer.last_name = String(inputs.lastName);
                if (inputs.phone) customer.phone = String(inputs.phone);
                const data = await shopifyRequest('POST', '/customers.json', creds, { customer });
                return { output: { customerId: String(data.customer?.id) } };
            }

            case 'updateOrderStatus': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                // Create a fulfillment for the order
                const fulfillment: any = {
                    message: 'Fulfilled via SabFlow',
                    notify_customer: true,
                };
                if (inputs.locationId) fulfillment.location_id = Number(inputs.locationId);
                const data = await shopifyRequest(
                    'POST',
                    `/orders/${orderId}/fulfillments.json`,
                    creds,
                    { fulfillment }
                );
                return { output: { fulfillmentId: String(data.fulfillment?.id) } };
            }

            default:
                return { error: `Shopify action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e?.response?.data?.errors || e.message || 'Shopify action failed.';
        return { error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
    }
}

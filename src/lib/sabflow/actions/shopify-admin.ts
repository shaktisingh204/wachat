
'use server';

async function shopifyGraphQL(shopName: string, accessToken: string, query: string, variables?: Record<string, any>): Promise<any> {
    const url = `https://${shopName}.myshopify.com/admin/api/2024-01/graphql.json`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query, variables: variables || {} }),
    });
    const json = await res.json();
    if (!res.ok) {
        throw new Error(json?.errors?.[0]?.message || `Shopify error ${res.status}`);
    }
    if (json?.errors?.length) {
        throw new Error(json.errors[0]?.message || 'GraphQL error');
    }
    return json?.data;
}

export async function executeShopifyAdminAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const shopName: string = inputs.shopName || inputs.shop_name;
        const accessToken: string = inputs.accessToken || inputs.access_token;
        if (!shopName) throw new Error('Missing shopName in inputs');
        if (!accessToken) throw new Error('Missing accessToken in inputs');

        switch (actionName) {
            case 'query': {
                const result = await shopifyGraphQL(shopName, accessToken, inputs.query, inputs.variables);
                return { output: result };
            }
            case 'getShop': {
                const result = await shopifyGraphQL(shopName, accessToken, `{
                    shop {
                        name
                        email
                        currency
                        primaryDomain { url }
                    }
                }`);
                return { output: result };
            }
            case 'listProducts': {
                const first = inputs.first || 20;
                const result = await shopifyGraphQL(shopName, accessToken, `
                    query listProducts($first: Int!, $after: String) {
                        products(first: $first, after: $after) {
                            edges {
                                cursor
                                node {
                                    id
                                    title
                                    handle
                                    status
                                    variants(first: 5) {
                                        edges { node { id title price } }
                                    }
                                }
                            }
                            pageInfo { hasNextPage endCursor }
                        }
                    }
                `, { first, after: inputs.after || null });
                return { output: result };
            }
            case 'createProduct': {
                const result = await shopifyGraphQL(shopName, accessToken, `
                    mutation productCreate($input: ProductInput!) {
                        productCreate(input: $input) {
                            product { id title handle status }
                            userErrors { field message }
                        }
                    }
                `, { input: inputs.input || inputs });
                return { output: result };
            }
            case 'updateProduct': {
                const result = await shopifyGraphQL(shopName, accessToken, `
                    mutation productUpdate($input: ProductInput!) {
                        productUpdate(input: $input) {
                            product { id title handle status }
                            userErrors { field message }
                        }
                    }
                `, { input: { id: inputs.id, ...(inputs.input || {}) } });
                return { output: result };
            }
            case 'deleteProduct': {
                const result = await shopifyGraphQL(shopName, accessToken, `
                    mutation productDelete($input: ProductDeleteInput!) {
                        productDelete(input: $input) {
                            deletedProductId
                            userErrors { field message }
                        }
                    }
                `, { input: { id: inputs.id } });
                return { output: result };
            }
            case 'listOrders': {
                const first = inputs.first || 20;
                const result = await shopifyGraphQL(shopName, accessToken, `
                    query listOrders($first: Int!, $query: String) {
                        orders(first: $first, query: $query) {
                            edges {
                                node {
                                    id
                                    name
                                    email
                                    totalPriceSet { shopMoney { amount currencyCode } }
                                    displayFinancialStatus
                                    displayFulfillmentStatus
                                    createdAt
                                }
                            }
                            pageInfo { hasNextPage endCursor }
                        }
                    }
                `, { first, query: inputs.filter || null });
                return { output: result };
            }
            case 'updateOrder': {
                const result = await shopifyGraphQL(shopName, accessToken, `
                    mutation orderUpdate($input: OrderInput!) {
                        orderUpdate(input: $input) {
                            order { id name }
                            userErrors { field message }
                        }
                    }
                `, { input: { id: inputs.id, ...(inputs.input || {}) } });
                return { output: result };
            }
            case 'fulfillOrder': {
                const result = await shopifyGraphQL(shopName, accessToken, `
                    mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
                        fulfillmentCreateV2(fulfillment: $fulfillment) {
                            fulfillment { id status }
                            userErrors { field message }
                        }
                    }
                `, { fulfillment: inputs.fulfillment || { lineItemsByFulfillmentOrder: inputs.lineItemsByFulfillmentOrder } });
                return { output: result };
            }
            case 'listCustomers': {
                const first = inputs.first || 20;
                const result = await shopifyGraphQL(shopName, accessToken, `
                    query listCustomers($first: Int!, $query: String) {
                        customers(first: $first, query: $query) {
                            edges {
                                node { id displayName email phone numberOfOrders }
                            }
                            pageInfo { hasNextPage endCursor }
                        }
                    }
                `, { first, query: inputs.filter || null });
                return { output: result };
            }
            case 'createCustomer': {
                const result = await shopifyGraphQL(shopName, accessToken, `
                    mutation customerCreate($input: CustomerInput!) {
                        customerCreate(input: $input) {
                            customer { id displayName email }
                            userErrors { field message }
                        }
                    }
                `, { input: inputs.input || inputs });
                return { output: result };
            }
            case 'updateCustomer': {
                const result = await shopifyGraphQL(shopName, accessToken, `
                    mutation customerUpdate($input: CustomerInput!) {
                        customerUpdate(input: $input) {
                            customer { id displayName email }
                            userErrors { field message }
                        }
                    }
                `, { input: { id: inputs.id, ...(inputs.input || {}) } });
                return { output: result };
            }
            case 'listCollections': {
                const first = inputs.first || 20;
                const result = await shopifyGraphQL(shopName, accessToken, `
                    query listCollections($first: Int!) {
                        collections(first: $first) {
                            edges {
                                node { id title handle productsCount }
                            }
                        }
                    }
                `, { first });
                return { output: result };
            }
            case 'createCollection': {
                const result = await shopifyGraphQL(shopName, accessToken, `
                    mutation collectionCreate($input: CollectionInput!) {
                        collectionCreate(input: $input) {
                            collection { id title handle }
                            userErrors { field message }
                        }
                    }
                `, { input: inputs.input || { title: inputs.title } });
                return { output: result };
            }
            case 'getInventoryLevel': {
                const result = await shopifyGraphQL(shopName, accessToken, `
                    query getInventoryLevels($locationId: ID!) {
                        location(id: $locationId) {
                            inventoryLevels(first: 50) {
                                edges { node { available quantities(names: ["available"]) { name quantity } } }
                            }
                        }
                    }
                `, { locationId: inputs.locationId });
                return { output: result };
            }
            case 'adjustInventory': {
                const result = await shopifyGraphQL(shopName, accessToken, `
                    mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
                        inventoryAdjustQuantities(input: $input) {
                            inventoryAdjustmentGroup { id }
                            userErrors { field message }
                        }
                    }
                `, { input: inputs.input || { reason: inputs.reason || 'correction', changes: inputs.changes } });
                return { output: result };
            }
            case 'createDiscount': {
                const result = await shopifyGraphQL(shopName, accessToken, `
                    mutation discountAutomaticAppCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
                        discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
                            automaticAppDiscount { discountId }
                            userErrors { field message }
                        }
                    }
                `, { automaticAppDiscount: inputs.input || inputs.automaticAppDiscount });
                return { output: result };
            }
            case 'webhookSubscription': {
                const mutation = inputs.type === 'pubsub'
                    ? `mutation pubSubWebhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: PubSubWebhookSubscriptionInput!) {
                        pubSubWebhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
                            webhookSubscription { id topic }
                            userErrors { field message }
                        }
                    }`
                    : `mutation eventBridgeWebhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: EventBridgeWebhookSubscriptionInput!) {
                        eventBridgeWebhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
                            webhookSubscription { id topic }
                            userErrors { field message }
                        }
                    }`;
                const result = await shopifyGraphQL(shopName, accessToken, mutation, {
                    topic: inputs.topic,
                    webhookSubscription: inputs.webhookSubscription,
                });
                return { output: result };
            }
            default:
                throw new Error(`Unknown Shopify Admin action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.error?.('ShopifyAdminAction error', err);
        return { error: err?.message || String(err) };
    }
}

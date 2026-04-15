'use server';

export async function executeShopifyGraphQLAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const shopDomain = String(inputs.shopDomain ?? '').trim();
        const accessToken = String(inputs.accessToken ?? '').trim();
        const url = `https://${shopDomain}/admin/api/2024-01/graphql.json`;

        const gql = async (query: string, variables: Record<string, any> = {}) => {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'X-Shopify-Access-Token': accessToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query, variables }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.errors?.[0]?.message || `Shopify API error: ${res.status}`);
            if (data?.errors?.length) throw new Error(data.errors[0].message);
            return data;
        };

        switch (actionName) {
            case 'getShop': {
                const data = await gql(`{ shop { id name email myshopifyDomain primaryDomain { url } plan { displayName } currencyCode } }`);
                return { output: { shop: data.data?.shop } };
            }

            case 'listProducts': {
                const first = inputs.first ?? 20;
                const after = inputs.after ?? null;
                const data = await gql(
                    `query listProducts($first: Int!, $after: String) {
                        products(first: $first, after: $after) {
                            edges { cursor node { id title handle status descriptionHtml vendor productType tags createdAt updatedAt } }
                            pageInfo { hasNextPage endCursor }
                        }
                    }`,
                    { first, after }
                );
                return { output: data.data?.products };
            }

            case 'getProduct': {
                const data = await gql(
                    `query getProduct($id: ID!) {
                        product(id: $id) {
                            id title handle status descriptionHtml vendor productType tags
                            variants(first: 100) { edges { node { id title sku price inventoryQuantity } } }
                            images(first: 20) { edges { node { id url altText } } }
                        }
                    }`,
                    { id: inputs.id }
                );
                return { output: { product: data.data?.product } };
            }

            case 'createProduct': {
                const data = await gql(
                    `mutation createProduct($input: ProductInput!) {
                        productCreate(input: $input) {
                            product { id title handle status }
                            userErrors { field message }
                        }
                    }`,
                    { input: inputs.product }
                );
                const result = data.data?.productCreate;
                if (result?.userErrors?.length) throw new Error(result.userErrors[0].message);
                return { output: { product: result?.product } };
            }

            case 'updateProduct': {
                const data = await gql(
                    `mutation updateProduct($input: ProductInput!) {
                        productUpdate(input: $input) {
                            product { id title handle status }
                            userErrors { field message }
                        }
                    }`,
                    { input: { id: inputs.id, ...inputs.product } }
                );
                const result = data.data?.productUpdate;
                if (result?.userErrors?.length) throw new Error(result.userErrors[0].message);
                return { output: { product: result?.product } };
            }

            case 'listOrders': {
                const first = inputs.first ?? 20;
                const after = inputs.after ?? null;
                const data = await gql(
                    `query listOrders($first: Int!, $after: String) {
                        orders(first: $first, after: $after) {
                            edges { cursor node { id name email totalPriceSet { shopMoney { amount currencyCode } } displayFinancialStatus displayFulfillmentStatus createdAt } }
                            pageInfo { hasNextPage endCursor }
                        }
                    }`,
                    { first, after }
                );
                return { output: data.data?.orders };
            }

            case 'getOrder': {
                const data = await gql(
                    `query getOrder($id: ID!) {
                        order(id: $id) {
                            id name email phone totalPriceSet { shopMoney { amount currencyCode } }
                            displayFinancialStatus displayFulfillmentStatus
                            lineItems(first: 50) { edges { node { id title quantity originalUnitPriceSet { shopMoney { amount } } } } }
                            shippingAddress { firstName lastName address1 city province country zip }
                        }
                    }`,
                    { id: inputs.id }
                );
                return { output: { order: data.data?.order } };
            }

            case 'createOrder': {
                const data = await gql(
                    `mutation createOrder($input: OrderInput!) {
                        orderCreate(input: $input) {
                            order { id name email totalPriceSet { shopMoney { amount currencyCode } } }
                            userErrors { field message }
                        }
                    }`,
                    { input: inputs.order }
                );
                const result = data.data?.orderCreate;
                if (result?.userErrors?.length) throw new Error(result.userErrors[0].message);
                return { output: { order: result?.order } };
            }

            case 'updateOrder': {
                const data = await gql(
                    `mutation updateOrder($input: OrderInput!) {
                        orderUpdate(input: $input) {
                            order { id name email displayFinancialStatus displayFulfillmentStatus }
                            userErrors { field message }
                        }
                    }`,
                    { input: { id: inputs.id, ...inputs.order } }
                );
                const result = data.data?.orderUpdate;
                if (result?.userErrors?.length) throw new Error(result.userErrors[0].message);
                return { output: { order: result?.order } };
            }

            case 'listCustomers': {
                const first = inputs.first ?? 20;
                const after = inputs.after ?? null;
                const data = await gql(
                    `query listCustomers($first: Int!, $after: String) {
                        customers(first: $first, after: $after) {
                            edges { cursor node { id email firstName lastName phone ordersCount totalSpentV2 { amount currencyCode } createdAt } }
                            pageInfo { hasNextPage endCursor }
                        }
                    }`,
                    { first, after }
                );
                return { output: data.data?.customers };
            }

            case 'getCustomer': {
                const data = await gql(
                    `query getCustomer($id: ID!) {
                        customer(id: $id) {
                            id email firstName lastName phone note taxExempt ordersCount totalSpentV2 { amount currencyCode }
                            addresses { address1 address2 city province country zip }
                        }
                    }`,
                    { id: inputs.id }
                );
                return { output: { customer: data.data?.customer } };
            }

            case 'createCustomer': {
                const data = await gql(
                    `mutation createCustomer($input: CustomerInput!) {
                        customerCreate(input: $input) {
                            customer { id email firstName lastName phone }
                            userErrors { field message }
                        }
                    }`,
                    { input: inputs.customer }
                );
                const result = data.data?.customerCreate;
                if (result?.userErrors?.length) throw new Error(result.userErrors[0].message);
                return { output: { customer: result?.customer } };
            }

            case 'listCollections': {
                const first = inputs.first ?? 20;
                const after = inputs.after ?? null;
                const data = await gql(
                    `query listCollections($first: Int!, $after: String) {
                        collections(first: $first, after: $after) {
                            edges { cursor node { id title handle updatedAt } }
                            pageInfo { hasNextPage endCursor }
                        }
                    }`,
                    { first, after }
                );
                return { output: data.data?.collections };
            }

            case 'getCollection': {
                const data = await gql(
                    `query getCollection($id: ID!) {
                        collection(id: $id) {
                            id title handle descriptionHtml updatedAt
                            products(first: 50) { edges { node { id title handle status } } }
                        }
                    }`,
                    { id: inputs.id }
                );
                return { output: { collection: data.data?.collection } };
            }

            case 'listVariants': {
                const first = inputs.first ?? 50;
                const after = inputs.after ?? null;
                const data = await gql(
                    `query listVariants($first: Int!, $after: String) {
                        productVariants(first: $first, after: $after) {
                            edges { cursor node { id title sku price barcode inventoryQuantity product { id title } } }
                            pageInfo { hasNextPage endCursor }
                        }
                    }`,
                    { first, after }
                );
                return { output: data.data?.productVariants };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}

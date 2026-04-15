'use server';

export async function executeShopifyStorefrontAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const shopDomain = String(inputs.shopDomain ?? '').trim();
        const storefrontAccessToken = String(inputs.storefrontAccessToken ?? '').trim();
        if (!shopDomain || !storefrontAccessToken) {
            throw new Error('shopDomain and storefrontAccessToken are required.');
        }

        const endpoint = `https://${shopDomain}/api/2024-01/graphql.json`;

        async function gql(query: string, variables: Record<string, any> = {}) {
            logger?.log(`[ShopifyStorefront] ${actionName}`);
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Storefront-Access-Token': storefrontAccessToken,
                },
                body: JSON.stringify({ query, variables }),
            });
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json?.errors?.[0]?.message || `Shopify Storefront API error: ${res.status}`);
            }
            if (json.errors?.length) {
                throw new Error(json.errors[0].message);
            }
            return json.data;
        }

        switch (actionName) {
            case 'listProducts': {
                const first = Math.max(1, Math.min(250, Number(inputs.first) || 20));
                const after = inputs.after ? `"${inputs.after}"` : 'null';
                const data = await gql(`
                    query ListProducts($first: Int!, $after: String) {
                        products(first: $first, after: $after) {
                            edges {
                                cursor
                                node {
                                    id title description handle priceRange {
                                        minVariantPrice { amount currencyCode }
                                    }
                                    images(first: 1) { edges { node { url altText } } }
                                    availableForSale
                                }
                            }
                            pageInfo { hasNextPage endCursor }
                        }
                    }
                `, { first, after: inputs.after || null });
                return { output: { products: data.products.edges.map((e: any) => e.node), pageInfo: data.products.pageInfo } };
            }

            case 'getProduct': {
                const id = String(inputs.id ?? '').trim();
                const handle = String(inputs.handle ?? '').trim();
                if (!id && !handle) throw new Error('id or handle is required.');
                let data: any;
                if (id) {
                    data = await gql(`
                        query GetProductById($id: ID!) {
                            product(id: $id) {
                                id title description handle vendor productType tags
                                priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
                                variants(first: 50) { edges { node { id title price { amount currencyCode } availableForSale sku } } }
                                images(first: 10) { edges { node { url altText } } }
                            }
                        }
                    `, { id });
                    return { output: { product: data.product } };
                } else {
                    data = await gql(`
                        query GetProductByHandle($handle: String!) {
                            productByHandle(handle: $handle) {
                                id title description handle vendor productType tags
                                priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
                                variants(first: 50) { edges { node { id title price { amount currencyCode } availableForSale sku } } }
                                images(first: 10) { edges { node { url altText } } }
                            }
                        }
                    `, { handle });
                    return { output: { product: data.productByHandle } };
                }
            }

            case 'searchProducts': {
                const query = String(inputs.query ?? '').trim();
                const first = Math.max(1, Math.min(250, Number(inputs.first) || 20));
                if (!query) throw new Error('query is required.');
                const data = await gql(`
                    query SearchProducts($query: String!, $first: Int!) {
                        products(query: $query, first: $first) {
                            edges {
                                node {
                                    id title handle priceRange { minVariantPrice { amount currencyCode } }
                                    availableForSale
                                }
                            }
                        }
                    }
                `, { query, first });
                return { output: { products: data.products.edges.map((e: any) => e.node) } };
            }

            case 'listCollections': {
                const first = Math.max(1, Math.min(250, Number(inputs.first) || 20));
                const data = await gql(`
                    query ListCollections($first: Int!, $after: String) {
                        collections(first: $first, after: $after) {
                            edges {
                                cursor
                                node { id title handle description image { url altText } }
                            }
                            pageInfo { hasNextPage endCursor }
                        }
                    }
                `, { first, after: inputs.after || null });
                return { output: { collections: data.collections.edges.map((e: any) => e.node), pageInfo: data.collections.pageInfo } };
            }

            case 'getCollection': {
                const id = String(inputs.id ?? '').trim();
                const handle = String(inputs.handle ?? '').trim();
                if (!id && !handle) throw new Error('id or handle is required.');
                let data: any;
                if (id) {
                    data = await gql(`
                        query GetCollectionById($id: ID!, $first: Int) {
                            collection(id: $id) {
                                id title handle description
                                products(first: $first) {
                                    edges { node { id title handle priceRange { minVariantPrice { amount currencyCode } } } }
                                }
                            }
                        }
                    `, { id, first: Number(inputs.first) || 20 });
                    return { output: { collection: data.collection } };
                } else {
                    data = await gql(`
                        query GetCollectionByHandle($handle: String!, $first: Int) {
                            collectionByHandle(handle: $handle) {
                                id title handle description
                                products(first: $first) {
                                    edges { node { id title handle priceRange { minVariantPrice { amount currencyCode } } } }
                                }
                            }
                        }
                    `, { handle, first: Number(inputs.first) || 20 });
                    return { output: { collection: data.collectionByHandle } };
                }
            }

            case 'createCart': {
                const lines = inputs.lines || [];
                const data = await gql(`
                    mutation CartCreate($input: CartInput!) {
                        cartCreate(input: $input) {
                            cart {
                                id checkoutUrl
                                lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title price { amount currencyCode } } } } } }
                                cost { totalAmount { amount currencyCode } subtotalAmount { amount currencyCode } }
                            }
                            userErrors { field message }
                        }
                    }
                `, { input: { lines } });
                if (data.cartCreate.userErrors?.length) throw new Error(data.cartCreate.userErrors[0].message);
                return { output: { cart: data.cartCreate.cart } };
            }

            case 'getCart': {
                const cartId = String(inputs.cartId ?? '').trim();
                if (!cartId) throw new Error('cartId is required.');
                const data = await gql(`
                    query GetCart($cartId: ID!) {
                        cart(id: $cartId) {
                            id checkoutUrl
                            lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title price { amount currencyCode } } } } } }
                            cost { totalAmount { amount currencyCode } subtotalAmount { amount currencyCode } }
                        }
                    }
                `, { cartId });
                return { output: { cart: data.cart } };
            }

            case 'addCartLines': {
                const cartId = String(inputs.cartId ?? '').trim();
                const lines = inputs.lines;
                if (!cartId || !lines) throw new Error('cartId and lines are required.');
                const data = await gql(`
                    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
                        cartLinesAdd(cartId: $cartId, lines: $lines) {
                            cart {
                                id
                                lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title } } } } }
                                cost { totalAmount { amount currencyCode } }
                            }
                            userErrors { field message }
                        }
                    }
                `, { cartId, lines });
                if (data.cartLinesAdd.userErrors?.length) throw new Error(data.cartLinesAdd.userErrors[0].message);
                return { output: { cart: data.cartLinesAdd.cart } };
            }

            case 'updateCartLines': {
                const cartId = String(inputs.cartId ?? '').trim();
                const lines = inputs.lines;
                if (!cartId || !lines) throw new Error('cartId and lines are required.');
                const data = await gql(`
                    mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
                        cartLinesUpdate(cartId: $cartId, lines: $lines) {
                            cart {
                                id
                                lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title } } } } }
                                cost { totalAmount { amount currencyCode } }
                            }
                            userErrors { field message }
                        }
                    }
                `, { cartId, lines });
                if (data.cartLinesUpdate.userErrors?.length) throw new Error(data.cartLinesUpdate.userErrors[0].message);
                return { output: { cart: data.cartLinesUpdate.cart } };
            }

            case 'removeCartLines': {
                const cartId = String(inputs.cartId ?? '').trim();
                const lineIds = inputs.lineIds;
                if (!cartId || !lineIds) throw new Error('cartId and lineIds are required.');
                const data = await gql(`
                    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
                        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
                            cart {
                                id
                                lines(first: 50) { edges { node { id quantity } } }
                                cost { totalAmount { amount currencyCode } }
                            }
                            userErrors { field message }
                        }
                    }
                `, { cartId, lineIds });
                if (data.cartLinesRemove.userErrors?.length) throw new Error(data.cartLinesRemove.userErrors[0].message);
                return { output: { cart: data.cartLinesRemove.cart } };
            }

            case 'createCheckout': {
                const lineItems = inputs.lineItems || [];
                const email = inputs.email ? String(inputs.email) : undefined;
                const data = await gql(`
                    mutation CheckoutCreate($input: CheckoutCreateInput!) {
                        checkoutCreate(input: $input) {
                            checkout {
                                id webUrl
                                lineItems(first: 50) { edges { node { id title quantity variant { id price { amount currencyCode } } } } }
                                totalPriceV2 { amount currencyCode }
                            }
                            checkoutUserErrors { field message }
                        }
                    }
                `, { input: { lineItems, email } });
                if (data.checkoutCreate.checkoutUserErrors?.length) throw new Error(data.checkoutCreate.checkoutUserErrors[0].message);
                return { output: { checkout: data.checkoutCreate.checkout } };
            }

            case 'updateCheckout': {
                const checkoutId = String(inputs.checkoutId ?? '').trim();
                if (!checkoutId) throw new Error('checkoutId is required.');
                const updateData: any = {};
                if (inputs.email) updateData.email = inputs.email;
                if (inputs.shippingAddress) updateData.shippingAddress = inputs.shippingAddress;
                const data = await gql(`
                    mutation CheckoutEmailUpdate($checkoutId: ID!, $email: String!) {
                        checkoutEmailUpdateV2(checkoutId: $checkoutId, email: $email) {
                            checkout { id webUrl email }
                            checkoutUserErrors { field message }
                        }
                    }
                `, { checkoutId, email: inputs.email || '' });
                if (data.checkoutEmailUpdateV2.checkoutUserErrors?.length) throw new Error(data.checkoutEmailUpdateV2.checkoutUserErrors[0].message);
                return { output: { checkout: data.checkoutEmailUpdateV2.checkout } };
            }

            case 'completeCheckout': {
                const checkoutId = String(inputs.checkoutId ?? '').trim();
                const payment = inputs.payment;
                if (!checkoutId || !payment) throw new Error('checkoutId and payment are required.');
                const data = await gql(`
                    mutation CheckoutCompleteWithTokenizedPayment($checkoutId: ID!, $payment: TokenizedPaymentInputV3!) {
                        checkoutCompleteWithTokenizedPaymentV3(checkoutId: $checkoutId, payment: $payment) {
                            checkout { id completedAt }
                            checkoutUserErrors { field message }
                        }
                    }
                `, { checkoutId, payment });
                if (data.checkoutCompleteWithTokenizedPaymentV3.checkoutUserErrors?.length) throw new Error(data.checkoutCompleteWithTokenizedPaymentV3.checkoutUserErrors[0].message);
                return { output: { checkout: data.checkoutCompleteWithTokenizedPaymentV3.checkout } };
            }

            case 'listOrders': {
                const first = Math.max(1, Math.min(250, Number(inputs.first) || 20));
                const customerAccessToken = String(inputs.customerAccessToken ?? '').trim();
                if (!customerAccessToken) throw new Error('customerAccessToken is required.');
                const data = await gql(`
                    query ListOrders($customerAccessToken: String!, $first: Int!) {
                        customer(customerAccessToken: $customerAccessToken) {
                            orders(first: $first) {
                                edges {
                                    node {
                                        id orderNumber name processedAt
                                        currentTotalPrice { amount currencyCode }
                                        fulfillmentStatus financialStatus
                                        lineItems(first: 50) { edges { node { title quantity } } }
                                    }
                                }
                            }
                        }
                    }
                `, { customerAccessToken, first });
                return { output: { orders: data.customer?.orders?.edges?.map((e: any) => e.node) ?? [] } };
            }

            case 'getOrder': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await gql(`
                    query GetOrder($id: ID!) {
                        node(id: $id) {
                            ... on Order {
                                id orderNumber name processedAt
                                currentTotalPrice { amount currencyCode }
                                fulfillmentStatus financialStatus
                                shippingAddress { firstName lastName address1 city country zip }
                                lineItems(first: 50) { edges { node { title quantity variant { id price { amount currencyCode } } } } }
                            }
                        }
                    }
                `, { id });
                return { output: { order: data.node } };
            }

            default:
                return { error: `Shopify Storefront action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e?.message || 'Shopify Storefront action failed.';
        return { error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
    }
}

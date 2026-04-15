'use server';

async function saleorQuery(saleorUrl: string, accessToken: string, query: string, variables: Record<string, any> = {}, logger?: any) {
    logger?.log(`[Saleor] GraphQL query`);
    const endpoint = `${saleorUrl.replace(/\/$/, '')}/graphql/`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ query, variables }),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.errors?.[0]?.message || `Saleor API error: ${res.status}`);
    }
    if (data.errors && data.errors.length > 0) {
        throw new Error(data.errors[0].message);
    }
    return data.data;
}

export async function executeSaleorAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const saleorUrl = String(inputs.saleorUrl ?? '').trim();
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!saleorUrl || !accessToken) throw new Error('saleorUrl and accessToken are required.');
        const gql = (query: string, variables?: Record<string, any>) => saleorQuery(saleorUrl, accessToken, query, variables, logger);

        switch (actionName) {
            case 'listProducts': {
                const first = Number(inputs.first ?? 20);
                const after = String(inputs.after ?? '').trim() || undefined;
                const data = await gql(`
                    query ListProducts($first: Int!, $after: String) {
                        products(first: $first, after: $after) {
                            totalCount
                            edges {
                                node { id name slug isAvailable rating }
                            }
                            pageInfo { endCursor hasNextPage }
                        }
                    }`, { first, after });
                return { output: { products: data.products.edges.map((e: any) => e.node), totalCount: data.products.totalCount, pageInfo: data.products.pageInfo } };
            }

            case 'getProduct': {
                const id = String(inputs.productId ?? '').trim();
                if (!id) throw new Error('productId is required.');
                const data = await gql(`
                    query GetProduct($id: ID!) {
                        product(id: $id) {
                            id name slug description isAvailable rating
                            variants { id name sku quantityAvailable pricing { price { gross { amount currency } } } }
                            category { id name }
                        }
                    }`, { id });
                return { output: { product: data.product } };
            }

            case 'createProduct': {
                const name = String(inputs.name ?? '').trim();
                const productTypeId = String(inputs.productTypeId ?? '').trim();
                if (!name || !productTypeId) throw new Error('name and productTypeId are required.');
                const input: Record<string, any> = { name, productType: productTypeId };
                if (inputs.slug) input.slug = String(inputs.slug);
                if (inputs.description) input.description = inputs.description;
                if (inputs.categoryId) input.category = String(inputs.categoryId);
                const data = await gql(`
                    mutation CreateProduct($input: ProductCreateInput!) {
                        productCreate(input: $input) {
                            product { id name slug }
                            errors { field message code }
                        }
                    }`, { input });
                if (data.productCreate.errors?.length > 0) throw new Error(data.productCreate.errors[0].message);
                return { output: { product: data.productCreate.product } };
            }

            case 'updateProduct': {
                const id = String(inputs.productId ?? '').trim();
                if (!id) throw new Error('productId is required.');
                const input: Record<string, any> = {};
                if (inputs.name) input.name = String(inputs.name);
                if (inputs.slug) input.slug = String(inputs.slug);
                if (inputs.description) input.description = inputs.description;
                const data = await gql(`
                    mutation UpdateProduct($id: ID!, $input: ProductInput!) {
                        productUpdate(id: $id, input: $input) {
                            product { id name slug }
                            errors { field message code }
                        }
                    }`, { id, input });
                if (data.productUpdate.errors?.length > 0) throw new Error(data.productUpdate.errors[0].message);
                return { output: { product: data.productUpdate.product } };
            }

            case 'deleteProduct': {
                const id = String(inputs.productId ?? '').trim();
                if (!id) throw new Error('productId is required.');
                const data = await gql(`
                    mutation DeleteProduct($id: ID!) {
                        productDelete(id: $id) {
                            product { id }
                            errors { field message code }
                        }
                    }`, { id });
                if (data.productDelete.errors?.length > 0) throw new Error(data.productDelete.errors[0].message);
                return { output: { deleted: true, id } };
            }

            case 'listOrders': {
                const first = Number(inputs.first ?? 20);
                const after = String(inputs.after ?? '').trim() || undefined;
                const data = await gql(`
                    query ListOrders($first: Int!, $after: String) {
                        orders(first: $first, after: $after) {
                            totalCount
                            edges {
                                node { id number status total { gross { amount currency } } created }
                            }
                            pageInfo { endCursor hasNextPage }
                        }
                    }`, { first, after });
                return { output: { orders: data.orders.edges.map((e: any) => e.node), totalCount: data.orders.totalCount, pageInfo: data.orders.pageInfo } };
            }

            case 'getOrder': {
                const id = String(inputs.orderId ?? '').trim();
                if (!id) throw new Error('orderId is required.');
                const data = await gql(`
                    query GetOrder($id: ID!) {
                        order(id: $id) {
                            id number status created
                            total { gross { amount currency } }
                            lines { id productName quantity totalPrice { gross { amount currency } } }
                            userEmail
                        }
                    }`, { id });
                return { output: { order: data.order } };
            }

            case 'updateOrderStatus': {
                const id = String(inputs.orderId ?? '').trim();
                const status = String(inputs.status ?? '').trim();
                if (!id || !status) throw new Error('orderId and status are required.');
                // Use orderMarkAsPaid or orderCancel based on status
                let mutationResult: any;
                if (status === 'CANCELED') {
                    const data = await gql(`
                        mutation CancelOrder($id: ID!) {
                            orderCancel(id: $id) {
                                order { id status }
                                errors { field message code }
                            }
                        }`, { id });
                    if (data.orderCancel.errors?.length > 0) throw new Error(data.orderCancel.errors[0].message);
                    mutationResult = data.orderCancel.order;
                } else {
                    const data = await gql(`
                        mutation FulfillOrder($id: ID!) {
                            orderMarkAsPaid(id: $id) {
                                order { id status }
                                errors { field message code }
                            }
                        }`, { id });
                    if (data.orderMarkAsPaid.errors?.length > 0) throw new Error(data.orderMarkAsPaid.errors[0].message);
                    mutationResult = data.orderMarkAsPaid.order;
                }
                return { output: { order: mutationResult } };
            }

            case 'listCustomers': {
                const first = Number(inputs.first ?? 20);
                const after = String(inputs.after ?? '').trim() || undefined;
                const data = await gql(`
                    query ListCustomers($first: Int!, $after: String) {
                        customers(first: $first, after: $after) {
                            totalCount
                            edges {
                                node { id email firstName lastName isActive dateJoined }
                            }
                            pageInfo { endCursor hasNextPage }
                        }
                    }`, { first, after });
                return { output: { customers: data.customers.edges.map((e: any) => e.node), totalCount: data.customers.totalCount, pageInfo: data.customers.pageInfo } };
            }

            case 'getCustomer': {
                const id = String(inputs.customerId ?? '').trim();
                if (!id) throw new Error('customerId is required.');
                const data = await gql(`
                    query GetCustomer($id: ID!) {
                        user(id: $id) {
                            id email firstName lastName isActive dateJoined
                            orders(first: 5) { totalCount edges { node { id number status } } }
                        }
                    }`, { id });
                return { output: { customer: data.user } };
            }

            case 'listChannels': {
                const data = await gql(`
                    query {
                        channels {
                            id name slug currencyCode isActive
                        }
                    }`);
                return { output: { channels: data.channels } };
            }

            case 'getChannel': {
                const id = String(inputs.channelId ?? '').trim();
                if (!id) throw new Error('channelId is required.');
                const data = await gql(`
                    query GetChannel($id: ID!) {
                        channel(id: $id) {
                            id name slug currencyCode isActive
                            countries { country { code country } }
                        }
                    }`, { id });
                return { output: { channel: data.channel } };
            }

            case 'listAttributes': {
                const first = Number(inputs.first ?? 20);
                const after = String(inputs.after ?? '').trim() || undefined;
                const data = await gql(`
                    query ListAttributes($first: Int!, $after: String) {
                        attributes(first: $first, after: $after) {
                            totalCount
                            edges {
                                node { id name slug type inputType }
                            }
                            pageInfo { endCursor hasNextPage }
                        }
                    }`, { first, after });
                return { output: { attributes: data.attributes.edges.map((e: any) => e.node), totalCount: data.attributes.totalCount, pageInfo: data.attributes.pageInfo } };
            }

            case 'listCategories': {
                const first = Number(inputs.first ?? 20);
                const after = String(inputs.after ?? '').trim() || undefined;
                const data = await gql(`
                    query ListCategories($first: Int!, $after: String) {
                        categories(first: $first, after: $after) {
                            totalCount
                            edges {
                                node { id name slug level }
                            }
                            pageInfo { endCursor hasNextPage }
                        }
                    }`, { first, after });
                return { output: { categories: data.categories.edges.map((e: any) => e.node), totalCount: data.categories.totalCount, pageInfo: data.categories.pageInfo } };
            }

            case 'listCollections': {
                const first = Number(inputs.first ?? 20);
                const after = String(inputs.after ?? '').trim() || undefined;
                const data = await gql(`
                    query ListCollections($first: Int!, $after: String) {
                        collections(first: $first, after: $after) {
                            totalCount
                            edges {
                                node { id name slug }
                            }
                            pageInfo { endCursor hasNextPage }
                        }
                    }`, { first, after });
                return { output: { collections: data.collections.edges.map((e: any) => e.node), totalCount: data.collections.totalCount, pageInfo: data.collections.pageInfo } };
            }

            default:
                throw new Error(`Unknown Saleor action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err.message ?? String(err) };
    }
}

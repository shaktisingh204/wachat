'use server';

export async function executeWooCommerceGraphQLAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const siteUrl = String(inputs.siteUrl ?? '').replace(/\/$/, '');
        const url = `${siteUrl}/graphql`;

        const authHeader = inputs.accessToken
            ? `Bearer ${inputs.accessToken}`
            : `Basic ${Buffer.from(`${inputs.username ?? ''}:${inputs.password ?? ''}`).toString('base64')}`;

        const gql = async (query: string, variables: Record<string, any> = {}) => {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query, variables }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.errors?.[0]?.message || `WooCommerce GraphQL error: ${res.status}`);
            if (data?.errors?.length) throw new Error(data.errors[0].message);
            return data;
        };

        switch (actionName) {
            case 'listProducts': {
                const first = inputs.first ?? 20;
                const after = inputs.after ?? null;
                const data = await gql(
                    `query listProducts($first: Int!, $after: String) {
                        products(first: $first, after: $after) {
                            nodes { id databaseId name slug status type price regularPrice salePrice stockStatus stockQuantity }
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
                            id databaseId name slug status type description shortDescription price regularPrice salePrice stockStatus stockQuantity
                            image { sourceUrl altText }
                            productCategories { nodes { id name slug } }
                        }
                    }`,
                    { id: inputs.id }
                );
                return { output: { product: data.data?.product } };
            }

            case 'createProduct': {
                const data = await gql(
                    `mutation createProduct($input: CreateProductInput!) {
                        createProduct(input: $input) {
                            product { id databaseId name slug status }
                        }
                    }`,
                    { input: inputs.product }
                );
                return { output: { product: data.data?.createProduct?.product } };
            }

            case 'updateProduct': {
                const data = await gql(
                    `mutation updateProduct($input: UpdateProductInput!) {
                        updateProduct(input: $input) {
                            product { id databaseId name slug status }
                        }
                    }`,
                    { input: { id: inputs.id, ...inputs.product } }
                );
                return { output: { product: data.data?.updateProduct?.product } };
            }

            case 'deleteProduct': {
                const data = await gql(
                    `mutation deleteProduct($input: DeleteProductInput!) {
                        deleteProduct(input: $input) {
                            deleted product { id databaseId name }
                        }
                    }`,
                    { input: { id: inputs.id, forceDelete: inputs.forceDelete ?? false } }
                );
                return { output: data.data?.deleteProduct };
            }

            case 'listOrders': {
                const first = inputs.first ?? 20;
                const after = inputs.after ?? null;
                const data = await gql(
                    `query listOrders($first: Int!, $after: String) {
                        orders(first: $first, after: $after) {
                            nodes { id databaseId status total subtotal customerNote dateCreated { date } billing { email firstName lastName } }
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
                            id databaseId status total subtotal customerNote dateCreated { date }
                            billing { firstName lastName email phone address1 city state postcode country }
                            shipping { firstName lastName address1 city state postcode country }
                            lineItems { nodes { product { node { name } } quantity total } }
                        }
                    }`,
                    { id: inputs.id }
                );
                return { output: { order: data.data?.order } };
            }

            case 'createOrder': {
                const data = await gql(
                    `mutation createOrder($input: CreateOrderInput!) {
                        createOrder(input: $input) {
                            order { id databaseId status total }
                        }
                    }`,
                    { input: inputs.order }
                );
                return { output: { order: data.data?.createOrder?.order } };
            }

            case 'updateOrder': {
                const data = await gql(
                    `mutation updateOrder($input: UpdateOrderInput!) {
                        updateOrder(input: $input) {
                            order { id databaseId status total }
                        }
                    }`,
                    { input: { id: inputs.id, ...inputs.order } }
                );
                return { output: { order: data.data?.updateOrder?.order } };
            }

            case 'deleteOrder': {
                const data = await gql(
                    `mutation deleteOrder($input: DeleteOrderInput!) {
                        deleteOrder(input: $input) {
                            deleted order { id databaseId }
                        }
                    }`,
                    { input: { id: inputs.id, forceDelete: inputs.forceDelete ?? false } }
                );
                return { output: data.data?.deleteOrder };
            }

            case 'listCustomers': {
                const first = inputs.first ?? 20;
                const after = inputs.after ?? null;
                const data = await gql(
                    `query listCustomers($first: Int!, $after: String) {
                        customers(first: $first, after: $after) {
                            nodes { id databaseId email firstName lastName username orderCount totalSpent }
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
                            id databaseId email firstName lastName username orderCount totalSpent
                            billing { firstName lastName email phone address1 city state postcode country }
                            shipping { firstName lastName address1 city state postcode country }
                        }
                    }`,
                    { id: inputs.id }
                );
                return { output: { customer: data.data?.customer } };
            }

            case 'createCustomer': {
                const data = await gql(
                    `mutation createCustomer($input: CreateCustomerInput!) {
                        createCustomer(input: $input) {
                            customer { id databaseId email firstName lastName username }
                        }
                    }`,
                    { input: inputs.customer }
                );
                return { output: { customer: data.data?.createCustomer?.customer } };
            }

            case 'listCategories': {
                const first = inputs.first ?? 50;
                const after = inputs.after ?? null;
                const data = await gql(
                    `query listCategories($first: Int!, $after: String) {
                        productCategories(first: $first, after: $after) {
                            nodes { id databaseId name slug count parent { node { name } } }
                            pageInfo { hasNextPage endCursor }
                        }
                    }`,
                    { first, after }
                );
                return { output: data.data?.productCategories };
            }

            case 'getCategory': {
                const data = await gql(
                    `query getCategory($id: ID!) {
                        productCategory(id: $id) {
                            id databaseId name slug description count
                            products(first: 20) { nodes { id name slug } }
                        }
                    }`,
                    { id: inputs.id }
                );
                return { output: { category: data.data?.productCategory } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}

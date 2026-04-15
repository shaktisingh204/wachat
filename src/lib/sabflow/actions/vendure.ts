'use server';

async function vendureQuery(vendureUrl: string, authToken: string, query: string, variables: Record<string, any> = {}, logger?: any) {
    logger?.log(`[Vendure] GraphQL query`);
    const endpoint = `${vendureUrl.replace(/\/$/, '')}/shop-api`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ query, variables }),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.errors?.[0]?.message || `Vendure API error: ${res.status}`);
    }
    if (data.errors && data.errors.length > 0) {
        throw new Error(data.errors[0].message);
    }
    return data.data;
}

export async function executeVendureAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const vendureUrl = String(inputs.vendureUrl ?? '').trim();
        const authToken = String(inputs.authToken ?? '').trim();
        if (!vendureUrl || !authToken) throw new Error('vendureUrl and authToken are required.');
        const gql = (query: string, variables?: Record<string, any>) => vendureQuery(vendureUrl, authToken, query, variables, logger);

        switch (actionName) {
            case 'listProducts': {
                const take = Number(inputs.take ?? 20);
                const skip = Number(inputs.skip ?? 0);
                const data = await gql(`
                    query ListProducts($take: Int, $skip: Int) {
                        products(options: { take: $take, skip: $skip }) {
                            totalItems
                            items { id name slug enabled }
                        }
                    }`, { take, skip });
                return { output: { products: data.products.items, totalItems: data.products.totalItems } };
            }

            case 'getProduct': {
                const id = String(inputs.productId ?? '').trim();
                if (!id) throw new Error('productId is required.');
                const data = await gql(`
                    query GetProduct($id: ID!) {
                        product(id: $id) {
                            id name slug description enabled
                            variants { id name sku priceWithTax stockLevel }
                        }
                    }`, { id });
                return { output: { product: data.product } };
            }

            case 'listOrders': {
                const take = Number(inputs.take ?? 20);
                const skip = Number(inputs.skip ?? 0);
                const data = await gql(`
                    query ListOrders($take: Int, $skip: Int) {
                        orders(options: { take: $take, skip: $skip }) {
                            totalItems
                            items { id code state totalWithTax currencyCode }
                        }
                    }`, { take, skip });
                return { output: { orders: data.orders.items, totalItems: data.orders.totalItems } };
            }

            case 'getOrder': {
                const id = String(inputs.orderId ?? '').trim();
                if (!id) throw new Error('orderId is required.');
                const data = await gql(`
                    query GetOrder($id: ID!) {
                        order(id: $id) {
                            id code state totalWithTax currencyCode
                            lines { id quantity unitPriceWithTax productVariant { id name sku } }
                        }
                    }`, { id });
                return { output: { order: data.order } };
            }

            case 'createOrder': {
                const data = await gql(`
                    mutation CreateOrder {
                        createCustomerAddress { id }
                    }`);
                // Vendure requires adding items; create an empty active order
                const orderData = await gql(`
                    mutation {
                        addItemToOrder(productVariantId: "0", quantity: 0) {
                            ... on Order { id code state }
                        }
                    }`);
                return { output: { result: orderData } };
            }

            case 'addItemToOrder': {
                const productVariantId = String(inputs.productVariantId ?? '').trim();
                const quantity = Number(inputs.quantity ?? 1);
                if (!productVariantId) throw new Error('productVariantId is required.');
                const data = await gql(`
                    mutation AddItem($productVariantId: ID!, $quantity: Int!) {
                        addItemToOrder(productVariantId: $productVariantId, quantity: $quantity) {
                            ... on Order { id code state lines { id quantity } }
                            ... on ErrorResult { errorCode message }
                        }
                    }`, { productVariantId, quantity });
                return { output: { result: data.addItemToOrder } };
            }

            case 'removeItemFromOrder': {
                const orderLineId = String(inputs.orderLineId ?? '').trim();
                if (!orderLineId) throw new Error('orderLineId is required.');
                const data = await gql(`
                    mutation RemoveItem($orderLineId: ID!) {
                        removeOrderLine(orderLineId: $orderLineId) {
                            ... on Order { id code state }
                            ... on ErrorResult { errorCode message }
                        }
                    }`, { orderLineId });
                return { output: { result: data.removeOrderLine } };
            }

            case 'listCustomers': {
                const take = Number(inputs.take ?? 20);
                const skip = Number(inputs.skip ?? 0);
                const data = await gql(`
                    query ListCustomers($take: Int, $skip: Int) {
                        customers(options: { take: $take, skip: $skip }) {
                            totalItems
                            items { id firstName lastName emailAddress }
                        }
                    }`, { take, skip });
                return { output: { customers: data.customers.items, totalItems: data.customers.totalItems } };
            }

            case 'getCustomer': {
                const id = String(inputs.customerId ?? '').trim();
                if (!id) throw new Error('customerId is required.');
                const data = await gql(`
                    query GetCustomer($id: ID!) {
                        customer(id: $id) {
                            id firstName lastName emailAddress phoneNumber
                            orders { totalItems }
                        }
                    }`, { id });
                return { output: { customer: data.customer } };
            }

            case 'registerCustomer': {
                const emailAddress = String(inputs.emailAddress ?? '').trim();
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                const password = String(inputs.password ?? '').trim();
                if (!emailAddress || !firstName || !lastName) throw new Error('emailAddress, firstName, and lastName are required.');
                const data = await gql(`
                    mutation Register($input: RegisterCustomerInput!) {
                        registerCustomerAccount(input: $input) {
                            ... on Success { success }
                            ... on ErrorResult { errorCode message }
                        }
                    }`, { input: { emailAddress, firstName, lastName, password } });
                return { output: { result: data.registerCustomerAccount } };
            }

            case 'listCollections': {
                const take = Number(inputs.take ?? 20);
                const skip = Number(inputs.skip ?? 0);
                const data = await gql(`
                    query ListCollections($take: Int, $skip: Int) {
                        collections(options: { take: $take, skip: $skip }) {
                            totalItems
                            items { id name slug isPrivate }
                        }
                    }`, { take, skip });
                return { output: { collections: data.collections.items, totalItems: data.collections.totalItems } };
            }

            case 'getCollection': {
                const id = String(inputs.collectionId ?? '').trim();
                const slug = String(inputs.slug ?? '').trim();
                if (!id && !slug) throw new Error('collectionId or slug is required.');
                const data = await gql(`
                    query GetCollection($id: ID, $slug: String) {
                        collection(id: $id, slug: $slug) {
                            id name slug description isPrivate
                            children { id name }
                        }
                    }`, { id: id || undefined, slug: slug || undefined });
                return { output: { collection: data.collection } };
            }

            case 'searchProducts': {
                const term = String(inputs.term ?? '').trim();
                const take = Number(inputs.take ?? 20);
                const skip = Number(inputs.skip ?? 0);
                if (!term) throw new Error('term is required.');
                const data = await gql(`
                    query SearchProducts($input: SearchInput!) {
                        search(input: $input) {
                            totalItems
                            items { productId productName slug score }
                        }
                    }`, { input: { term, take, skip } });
                return { output: { results: data.search.items, totalItems: data.search.totalItems } };
            }

            case 'listFacets': {
                const take = Number(inputs.take ?? 20);
                const skip = Number(inputs.skip ?? 0);
                const data = await gql(`
                    query ListFacets($take: Int, $skip: Int) {
                        facets(options: { take: $take, skip: $skip }) {
                            totalItems
                            items { id name code isPrivate values { id name code } }
                        }
                    }`, { take, skip });
                return { output: { facets: data.facets.items, totalItems: data.facets.totalItems } };
            }

            case 'listShippingMethods': {
                const data = await gql(`
                    query {
                        eligibleShippingMethods {
                            id name code price priceWithTax description
                        }
                    }`);
                return { output: { shippingMethods: data.eligibleShippingMethods } };
            }

            default:
                throw new Error(`Unknown Vendure action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err.message ?? String(err) };
    }
}

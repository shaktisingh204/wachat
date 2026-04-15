'use server';

export async function executeSaleorEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const apiUrl = String(inputs.apiUrl ?? '').trim();
        if (!accessToken || !apiUrl) throw new Error('accessToken and apiUrl are required.');

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        const gql = async (query: string, variables: Record<string, any> = {}) => {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({ query, variables }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.errors?.[0]?.message || `Saleor API error: ${res.status}`);
            if (data.errors && data.errors.length > 0) throw new Error(data.errors[0].message);
            return data.data;
        };

        switch (actionName) {
            case 'listProducts': {
                const first = inputs.first ?? 20;
                const after = inputs.after ? `, after: "${inputs.after}"` : '';
                const channel = inputs.channel ? `, channel: "${inputs.channel}"` : '';
                const data = await gql(`query ListProducts { products(first: ${first}${after}${channel}) { edges { node { id name slug description productType { name } } } pageInfo { hasNextPage endCursor } } }`);
                return { output: data };
            }
            case 'getProduct': {
                const id = String(inputs.id ?? '').trim();
                const slug = inputs.slug ? `, slug: "${inputs.slug}"` : '';
                const channel = inputs.channel ? `, channel: "${inputs.channel}"` : '';
                const idParam = id ? `id: "${id}"` : '';
                const data = await gql(`query GetProduct { product(${idParam}${slug}${channel}) { id name slug description variants { id name sku pricing { price { gross { amount currency } } } } } }`);
                return { output: data };
            }
            case 'createProduct': {
                const input = inputs.input;
                if (!input) throw new Error('input object is required.');
                const data = await gql(`mutation CreateProduct($input: ProductCreateInput!) { productCreate(input: $input) { product { id name slug } errors { field message } } }`, { input });
                return { output: data };
            }
            case 'updateProduct': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const input = inputs.input;
                if (!input) throw new Error('input object is required.');
                const data = await gql(`mutation UpdateProduct($id: ID!, $input: ProductInput!) { productUpdate(id: $id, input: $input) { product { id name slug } errors { field message } } }`, { id, input });
                return { output: data };
            }
            case 'deleteProduct': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await gql(`mutation DeleteProduct($id: ID!) { productDelete(id: $id) { product { id name } errors { field message } } }`, { id });
                return { output: data };
            }
            case 'listOrders': {
                const first = inputs.first ?? 20;
                const after = inputs.after ? `, after: "${inputs.after}"` : '';
                const data = await gql(`query ListOrders { orders(first: ${first}${after}) { edges { node { id number status created total { gross { amount currency } } } } pageInfo { hasNextPage endCursor } } }`);
                return { output: data };
            }
            case 'getOrder': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await gql(`query GetOrder($id: ID!) { order(id: $id) { id number status created billingAddress { firstName lastName } lines { id productName quantity } total { gross { amount currency } } } }`, { id });
                return { output: data };
            }
            case 'updateOrder': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const input = inputs.input;
                if (!input) throw new Error('input object is required.');
                const data = await gql(`mutation UpdateOrder($id: ID!, $input: OrderUpdateInput!) { orderUpdate(id: $id, input: $input) { order { id number status } errors { field message } } }`, { id, input });
                return { output: data };
            }
            case 'listCustomers': {
                const first = inputs.first ?? 20;
                const after = inputs.after ? `, after: "${inputs.after}"` : '';
                const data = await gql(`query ListCustomers { customers(first: ${first}${after}) { edges { node { id email firstName lastName } } pageInfo { hasNextPage endCursor } } }`);
                return { output: data };
            }
            case 'getCustomer': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await gql(`query GetCustomer($id: ID!) { user(id: $id) { id email firstName lastName orders(first: 5) { edges { node { id number status } } } } }`, { id });
                return { output: data };
            }
            case 'listCollections': {
                const first = inputs.first ?? 20;
                const channel = inputs.channel ? `, channel: "${inputs.channel}"` : '';
                const data = await gql(`query ListCollections { collections(first: ${first}${channel}) { edges { node { id name slug } } pageInfo { hasNextPage endCursor } } }`);
                return { output: data };
            }
            case 'getCollection': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const channel = inputs.channel ? `, channel: "${inputs.channel}"` : '';
                const data = await gql(`query GetCollection($id: ID!) { collection(id: $id${channel}) { id name slug products(first: 10) { edges { node { id name } } } } }`, { id });
                return { output: data };
            }
            case 'createChannel': {
                const input = inputs.input;
                if (!input) throw new Error('input object is required.');
                const data = await gql(`mutation CreateChannel($input: ChannelCreateInput!) { channelCreate(input: $input) { channel { id name slug currencyCode } errors { field message } } }`, { input });
                return { output: data };
            }
            case 'listChannels': {
                const data = await gql(`query ListChannels { channels { id name slug currencyCode isActive } }`);
                return { output: data };
            }
            case 'assignProductToChannel': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('Product id is required.');
                const input = inputs.input;
                if (!input) throw new Error('input object is required.');
                const data = await gql(`mutation AssignProductToChannel($id: ID!, $input: ProductChannelListingUpdateInput!) { productChannelListingUpdate(id: $id, input: $input) { product { id name } errors { field message } } }`, { id, input });
                return { output: data };
            }
            default:
                throw new Error(`Unknown Saleor Enhanced action: ${actionName}`);
        }
    } catch (err: any) {
        logger.log(`[SaleorEnhanced] Error: ${err.message}`);
        return { error: err.message };
    }
}

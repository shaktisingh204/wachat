'use server';

export async function executeSaleorStorefrontAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = String(inputs.baseUrl ?? '').replace(/\/$/, '');
        const url = `${baseUrl}/graphql/`;
        const accessToken = inputs.accessToken ? String(inputs.accessToken).trim() : null;

        const gql = async (query: string, variables: Record<string, any> = {}) => {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ query, variables }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.errors?.[0]?.message || `Saleor API error: ${res.status}`);
            if (data?.errors?.length) throw new Error(data.errors[0].message);
            return data;
        };

        switch (actionName) {
            case 'getShop': {
                const data = await gql(`{ shop { name description domain { host } defaultCountry { code country } } }`);
                return { output: { shop: data.data?.shop } };
            }

            case 'listProducts': {
                const first = inputs.first ?? 20;
                const after = inputs.after ?? null;
                const channel = inputs.channel ?? 'default-channel';
                const data = await gql(
                    `query listProducts($first: Int!, $after: String, $channel: String!) {
                        products(first: $first, after: $after, channel: $channel) {
                            edges { cursor node { id name slug description thumbnail { url } pricing { priceRange { start { gross { amount currency } } } } } }
                            pageInfo { hasNextPage endCursor }
                        }
                    }`,
                    { first, after, channel }
                );
                return { output: data.data?.products };
            }

            case 'getProduct': {
                const channel = inputs.channel ?? 'default-channel';
                const data = await gql(
                    `query getProduct($id: ID!, $channel: String!) {
                        product(id: $id, channel: $channel) {
                            id name slug description seoTitle seoDescription
                            thumbnail { url altText }
                            pricing { priceRange { start { gross { amount currency } } } }
                            variants { id name sku quantityAvailable pricing { price { gross { amount currency } } } }
                            category { id name }
                        }
                    }`,
                    { id: inputs.id, channel }
                );
                return { output: { product: data.data?.product } };
            }

            case 'listCategories': {
                const first = inputs.first ?? 50;
                const after = inputs.after ?? null;
                const data = await gql(
                    `query listCategories($first: Int!, $after: String) {
                        categories(first: $first, after: $after) {
                            edges { cursor node { id name slug level } }
                            pageInfo { hasNextPage endCursor }
                        }
                    }`,
                    { first, after }
                );
                return { output: data.data?.categories };
            }

            case 'getCategory': {
                const first = inputs.first ?? 20;
                const channel = inputs.channel ?? 'default-channel';
                const data = await gql(
                    `query getCategory($id: ID!, $first: Int!, $channel: String!) {
                        category(id: $id) {
                            id name slug description level
                            products(first: $first, channel: $channel) { edges { node { id name slug } } }
                        }
                    }`,
                    { id: inputs.id, first, channel }
                );
                return { output: { category: data.data?.category } };
            }

            case 'createCheckout': {
                const data = await gql(
                    `mutation createCheckout($input: CheckoutCreateInput!) {
                        checkoutCreate(input: $input) {
                            checkout { id token email lines { id quantity variant { id name } } totalPrice { gross { amount currency } } }
                            errors { field message code }
                        }
                    }`,
                    { input: inputs.checkout }
                );
                const result = data.data?.checkoutCreate;
                if (result?.errors?.length) throw new Error(result.errors[0].message);
                return { output: { checkout: result?.checkout } };
            }

            case 'updateCheckoutBillingAddress': {
                const data = await gql(
                    `mutation updateCheckoutBillingAddress($id: ID!, $billingAddress: AddressInput!) {
                        checkoutBillingAddressUpdate(id: $id, billingAddress: $billingAddress) {
                            checkout { id token billingAddress { firstName lastName streetAddress1 city postalCode country { code } } }
                            errors { field message code }
                        }
                    }`,
                    { id: inputs.id, billingAddress: inputs.billingAddress }
                );
                const result = data.data?.checkoutBillingAddressUpdate;
                if (result?.errors?.length) throw new Error(result.errors[0].message);
                return { output: { checkout: result?.checkout } };
            }

            case 'updateCheckoutShippingAddress': {
                const data = await gql(
                    `mutation updateCheckoutShippingAddress($id: ID!, $shippingAddress: AddressInput!) {
                        checkoutShippingAddressUpdate(id: $id, shippingAddress: $shippingAddress) {
                            checkout { id token shippingAddress { firstName lastName streetAddress1 city postalCode country { code } } }
                            errors { field message code }
                        }
                    }`,
                    { id: inputs.id, shippingAddress: inputs.shippingAddress }
                );
                const result = data.data?.checkoutShippingAddressUpdate;
                if (result?.errors?.length) throw new Error(result.errors[0].message);
                return { output: { checkout: result?.checkout } };
            }

            case 'listShippingMethods': {
                const data = await gql(
                    `query listShippingMethods($id: ID!) {
                        checkout(id: $id) {
                            id availableShippingMethods { id name price { amount currency } minimumOrderPrice { amount currency } }
                        }
                    }`,
                    { id: inputs.id }
                );
                return { output: { shippingMethods: data.data?.checkout?.availableShippingMethods } };
            }

            case 'completeCheckout': {
                const data = await gql(
                    `mutation completeCheckout($id: ID!, $redirectUrl: String) {
                        checkoutComplete(id: $id, redirectUrl: $redirectUrl) {
                            order { id number status totalPrice { gross { amount currency } } }
                            confirmationNeeded confirmationData
                            errors { field message code }
                        }
                    }`,
                    { id: inputs.id, redirectUrl: inputs.redirectUrl ?? null }
                );
                const result = data.data?.checkoutComplete;
                if (result?.errors?.length) throw new Error(result.errors[0].message);
                return { output: { order: result?.order, confirmationNeeded: result?.confirmationNeeded } };
            }

            case 'createPayment': {
                const data = await gql(
                    `mutation createPayment($id: ID!, $input: PaymentInput!) {
                        checkoutPaymentCreate(id: $id, input: $input) {
                            payment { id gateway chargeStatus }
                            errors { field message code }
                        }
                    }`,
                    { id: inputs.id, input: inputs.payment }
                );
                const result = data.data?.checkoutPaymentCreate;
                if (result?.errors?.length) throw new Error(result.errors[0].message);
                return { output: { payment: result?.payment } };
            }

            case 'listOrders': {
                const first = inputs.first ?? 20;
                const after = inputs.after ?? null;
                const data = await gql(
                    `query listOrders($first: Int!, $after: String) {
                        me {
                            orders(first: $first, after: $after) {
                                edges { cursor node { id number status totalPrice { gross { amount currency } } created } }
                                pageInfo { hasNextPage endCursor }
                            }
                        }
                    }`,
                    { first, after }
                );
                return { output: data.data?.me?.orders };
            }

            case 'getOrder': {
                const data = await gql(
                    `query getOrder($id: ID!) {
                        order(id: $id) {
                            id number status created
                            totalPrice { gross { amount currency } }
                            billingAddress { firstName lastName streetAddress1 city postalCode country { code } }
                            shippingAddress { firstName lastName streetAddress1 city postalCode country { code } }
                            lines { id productName variantName quantity totalPrice { gross { amount currency } } }
                        }
                    }`,
                    { id: inputs.id }
                );
                return { output: { order: data.data?.order } };
            }

            case 'registerAccount': {
                const data = await gql(
                    `mutation registerAccount($email: String!, $password: String!, $redirectUrl: String!) {
                        accountRegister(input: { email: $email, password: $password, redirectUrl: $redirectUrl }) {
                            user { id email isActive }
                            errors { field message code }
                            requiresConfirmation
                        }
                    }`,
                    { email: inputs.email, password: inputs.password, redirectUrl: inputs.redirectUrl ?? '' }
                );
                const result = data.data?.accountRegister;
                if (result?.errors?.length) throw new Error(result.errors[0].message);
                return { output: { user: result?.user, requiresConfirmation: result?.requiresConfirmation } };
            }

            case 'confirmAccount': {
                const data = await gql(
                    `mutation confirmAccount($email: String!, $token: String!) {
                        confirmAccount(email: $email, token: $token) {
                            user { id email isActive isConfirmed }
                            errors { field message code }
                        }
                    }`,
                    { email: inputs.email, token: inputs.token }
                );
                const result = data.data?.confirmAccount;
                if (result?.errors?.length) throw new Error(result.errors[0].message);
                return { output: { user: result?.user } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}

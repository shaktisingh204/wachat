'use server';

// ---------------------------------------------------------------------------
// Braintree – GraphQL API
// Docs: https://graphql.braintreepayments.com/guides/overview
// ---------------------------------------------------------------------------

async function braintreeFetch(
    publicKey: string,
    privateKey: string,
    sandbox: boolean,
    query: string,
    variables: Record<string, any>,
    logger?: any
): Promise<any> {
    const base = sandbox
        ? 'https://payments.sandbox.braintree-api.com/graphql'
        : 'https://payments.braintree-api.com/graphql';

    const credentials = Buffer.from(`${publicKey}:${privateKey}`).toString('base64');
    logger?.log(`[Braintree] GraphQL query: ${query.slice(0, 80)}...`);

    const res = await fetch(base, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${credentials}`,
            'Braintree-Version': '2023-08-01',
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    });

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) return { error: data?.message || `HTTP ${res.status}` };
    if (data?.errors?.length) return { error: data.errors[0]?.message || 'GraphQL error' };
    return data?.data ?? data;
}

export async function executeBraintreeAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const publicKey: string = inputs.publicKey || '';
        const privateKey: string = inputs.privateKey || '';
        const sandbox: boolean = inputs.sandbox !== false && inputs.sandbox !== 'false';

        switch (actionName) {
            case 'createTransaction': {
                const query = `
                    mutation ChargePaymentMethod($input: ChargePaymentMethodInput!) {
                        chargePaymentMethod(input: $input) {
                            transaction { id status amount { value currencyIsoCode } }
                        }
                    }`;
                const variables = {
                    input: {
                        paymentMethodId: inputs.paymentMethodId,
                        transaction: {
                            amount: String(inputs.amount),
                            orderId: inputs.orderId,
                            ...inputs.transactionOptions,
                        },
                    },
                };
                const result = await braintreeFetch(publicKey, privateKey, sandbox, query, variables, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'getTransaction': {
                const query = `
                    query GetTransaction($id: ID!) {
                        node(id: $id) {
                            ... on Transaction {
                                id status amount { value currencyIsoCode }
                                createdAt updatedAt orderId
                            }
                        }
                    }`;
                const result = await braintreeFetch(publicKey, privateKey, sandbox, query, { id: inputs.transactionId }, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'listTransactions': {
                const query = `
                    query SearchTransactions($input: TransactionSearchInput!) {
                        search {
                            transactions(input: $input) {
                                edges { node { id status amount { value currencyIsoCode } createdAt } }
                            }
                        }
                    }`;
                const variables = { input: inputs.searchInput || {} };
                const result = await braintreeFetch(publicKey, privateKey, sandbox, query, variables, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'refundTransaction': {
                const query = `
                    mutation RefundTransaction($input: RefundTransactionInput!) {
                        refundTransaction(input: $input) {
                            refund { id status amount { value currencyIsoCode } }
                        }
                    }`;
                const variables = {
                    input: {
                        transactionId: inputs.transactionId,
                        amount: inputs.amount ? String(inputs.amount) : undefined,
                        orderId: inputs.orderId,
                    },
                };
                const result = await braintreeFetch(publicKey, privateKey, sandbox, query, variables, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'voidTransaction': {
                const query = `
                    mutation ReverseTransaction($input: ReverseTransactionInput!) {
                        reverseTransaction(input: $input) {
                            reversal { ... on Transaction { id status } }
                        }
                    }`;
                const variables = { input: { transactionId: inputs.transactionId } };
                const result = await braintreeFetch(publicKey, privateKey, sandbox, query, variables, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'createCustomer': {
                const query = `
                    mutation CreateCustomer($input: CreateCustomerInput!) {
                        createCustomer(input: $input) {
                            customer { id firstName lastName email }
                        }
                    }`;
                const variables = {
                    input: {
                        customer: {
                            firstName: inputs.firstName,
                            lastName: inputs.lastName,
                            email: inputs.email,
                            phone: inputs.phone,
                            company: inputs.company,
                            ...inputs.extra,
                        },
                    },
                };
                const result = await braintreeFetch(publicKey, privateKey, sandbox, query, variables, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'getCustomer': {
                const query = `
                    query GetCustomer($id: ID!) {
                        node(id: $id) {
                            ... on Customer {
                                id firstName lastName email phone company
                                paymentMethods { edges { node { id usage } } }
                            }
                        }
                    }`;
                const result = await braintreeFetch(publicKey, privateKey, sandbox, query, { id: inputs.customerId }, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'updateCustomer': {
                const query = `
                    mutation UpdateCustomer($input: UpdateCustomerInput!) {
                        updateCustomer(input: $input) {
                            customer { id firstName lastName email }
                        }
                    }`;
                const variables = {
                    input: {
                        customerId: inputs.customerId,
                        customer: {
                            firstName: inputs.firstName,
                            lastName: inputs.lastName,
                            email: inputs.email,
                            phone: inputs.phone,
                            company: inputs.company,
                            ...inputs.extra,
                        },
                    },
                };
                const result = await braintreeFetch(publicKey, privateKey, sandbox, query, variables, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'deleteCustomer': {
                const query = `
                    mutation DeleteCustomer($input: DeleteCustomerInput!) {
                        deleteCustomer(input: $input) { clientMutationId }
                    }`;
                const variables = { input: { customerId: inputs.customerId } };
                const result = await braintreeFetch(publicKey, privateKey, sandbox, query, variables, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'createPaymentMethod': {
                const query = `
                    mutation VaultPaymentMethod($input: VaultPaymentMethodInput!) {
                        vaultPaymentMethod(input: $input) {
                            paymentMethod { id usage }
                        }
                    }`;
                const variables = {
                    input: {
                        paymentMethodId: inputs.paymentMethodId,
                        customerId: inputs.customerId,
                        ...inputs.extra,
                    },
                };
                const result = await braintreeFetch(publicKey, privateKey, sandbox, query, variables, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'getPaymentMethod': {
                const query = `
                    query GetPaymentMethod($id: ID!) {
                        node(id: $id) {
                            ... on PaymentMethod { id usage }
                            ... on CreditCard { id last4 expirationMonth expirationYear cardType }
                        }
                    }`;
                const result = await braintreeFetch(publicKey, privateKey, sandbox, query, { id: inputs.paymentMethodId }, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'deletePaymentMethod': {
                const query = `
                    mutation DeletePaymentMethodFromVault($input: DeletePaymentMethodFromVaultInput!) {
                        deletePaymentMethodFromVault(input: $input) { clientMutationId }
                    }`;
                const variables = { input: { paymentMethodId: inputs.paymentMethodId } };
                const result = await braintreeFetch(publicKey, privateKey, sandbox, query, variables, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'createSubscription': {
                const query = `
                    mutation CreateSubscription($input: CreateSubscriptionInput!) {
                        createSubscription(input: $input) {
                            subscription { id status }
                        }
                    }`;
                const variables = {
                    input: {
                        paymentMethodId: inputs.paymentMethodId,
                        planId: inputs.planId,
                        price: inputs.price ? String(inputs.price) : undefined,
                        numberOfBillingCycles: inputs.numberOfBillingCycles,
                        ...inputs.extra,
                    },
                };
                const result = await braintreeFetch(publicKey, privateKey, sandbox, query, variables, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'getSubscription': {
                const query = `
                    query GetSubscription($id: ID!) {
                        node(id: $id) {
                            ... on Subscription { id status planId nextBillingDate }
                        }
                    }`;
                const result = await braintreeFetch(publicKey, privateKey, sandbox, query, { id: inputs.subscriptionId }, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'cancelSubscription': {
                const query = `
                    mutation CancelSubscription($input: CancelSubscriptionInput!) {
                        cancelSubscription(input: $input) {
                            subscription { id status }
                        }
                    }`;
                const variables = { input: { subscriptionId: inputs.subscriptionId } };
                const result = await braintreeFetch(publicKey, privateKey, sandbox, query, variables, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            default:
                return { error: `Braintree action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        return { error: err?.message || String(err) };
    }
}

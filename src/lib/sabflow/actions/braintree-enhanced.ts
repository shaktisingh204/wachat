'use server';

export async function executeBraintreeEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const publicKey = String(inputs.publicKey ?? '').trim();
        const privateKey = String(inputs.privateKey ?? '').trim();
        if (!publicKey || !privateKey) throw new Error('publicKey and privateKey are required.');

        const useProd = inputs.production === true || inputs.production === 'true';
        const baseUrl = useProd
            ? 'https://payments.braintree-api.com/graphql'
            : 'https://payments.sandbox.braintree-api.com/graphql';

        const auth = Buffer.from(`${publicKey}:${privateKey}`).toString('base64');

        async function gql(query: string, variables: Record<string, any> = {}) {
            logger?.log(`[BraintreeEnhanced] GraphQL op: ${actionName}`);
            const res = await fetch(baseUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${auth}`,
                    'Content-Type': 'application/json',
                    'Braintree-Version': '2019-01-01',
                },
                body: JSON.stringify({ query, variables }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.message || `Braintree API error: ${res.status}`);
            if (json.errors?.length) throw new Error(json.errors[0]?.message || 'Braintree GraphQL error');
            return json.data;
        }

        switch (actionName) {
            case 'createTransaction': {
                const amount = String(inputs.amount ?? '').trim();
                const paymentMethodId = String(inputs.paymentMethodId ?? '').trim();
                if (!amount || !paymentMethodId) throw new Error('amount and paymentMethodId are required.');
                const query = `mutation CreateTransaction($input: ChargePaymentMethodInput!) {
                    chargePaymentMethod(input: $input) {
                        transaction { id status amount { value currencyIsoCode } }
                    }
                }`;
                const data = await gql(query, { input: { paymentMethodId, transaction: { amount } } });
                const tx = data?.chargePaymentMethod?.transaction;
                return { output: { id: tx?.id, status: tx?.status, amount: tx?.amount?.value, currency: tx?.amount?.currencyIsoCode } };
            }

            case 'getTransaction': {
                const transactionId = String(inputs.transactionId ?? '').trim();
                if (!transactionId) throw new Error('transactionId is required.');
                const query = `query GetTransaction($id: ID!) {
                    node(id: $id) { ... on Transaction { id status amount { value currencyIsoCode } createdAt } }
                }`;
                const data = await gql(query, { id: transactionId });
                const tx = data?.node;
                return { output: { id: tx?.id, status: tx?.status, amount: tx?.amount?.value, currency: tx?.amount?.currencyIsoCode, createdAt: tx?.createdAt } };
            }

            case 'refundTransaction': {
                const transactionId = String(inputs.transactionId ?? '').trim();
                if (!transactionId) throw new Error('transactionId is required.');
                const amount = inputs.amount ? String(inputs.amount) : undefined;
                const query = `mutation RefundTransaction($input: RefundTransactionInput!) {
                    refundTransaction(input: $input) { refund { id status amount { value currencyIsoCode } } }
                }`;
                const refundInput: any = { transactionId };
                if (amount) refundInput.amount = amount;
                const data = await gql(query, { input: refundInput });
                const refund = data?.refundTransaction?.refund;
                return { output: { id: refund?.id, status: refund?.status, amount: refund?.amount?.value } };
            }

            case 'voidTransaction': {
                const transactionId = String(inputs.transactionId ?? '').trim();
                if (!transactionId) throw new Error('transactionId is required.');
                const query = `mutation VoidTransaction($input: ReverseTransactionInput!) {
                    reverseTransaction(input: $input) { reversal { ... on Transaction { id status } } }
                }`;
                const data = await gql(query, { input: { transactionId } });
                const rev = data?.reverseTransaction?.reversal;
                return { output: { id: rev?.id, status: rev?.status } };
            }

            case 'createCustomer': {
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const query = `mutation CreateCustomer($input: CreateCustomerInput!) {
                    createCustomer(input: $input) { customer { id firstName lastName email } }
                }`;
                const data = await gql(query, { input: { customer: { firstName, lastName, email } } });
                const customer = data?.createCustomer?.customer;
                return { output: { id: customer?.id, firstName: customer?.firstName, lastName: customer?.lastName, email: customer?.email } };
            }

            case 'getCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const query = `query GetCustomer($id: ID!) {
                    node(id: $id) { ... on Customer { id firstName lastName email } }
                }`;
                const data = await gql(query, { id: customerId });
                const customer = data?.node;
                return { output: { id: customer?.id, firstName: customer?.firstName, lastName: customer?.lastName, email: customer?.email } };
            }

            case 'updateCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const query = `mutation UpdateCustomer($input: UpdateCustomerInput!) {
                    updateCustomer(input: $input) { customer { id firstName lastName email } }
                }`;
                const customerUpdate: any = {};
                if (inputs.firstName) customerUpdate.firstName = String(inputs.firstName);
                if (inputs.lastName) customerUpdate.lastName = String(inputs.lastName);
                if (inputs.email) customerUpdate.email = String(inputs.email);
                const data = await gql(query, { input: { customerId, customer: customerUpdate } });
                const customer = data?.updateCustomer?.customer;
                return { output: { id: customer?.id, firstName: customer?.firstName, lastName: customer?.lastName, email: customer?.email } };
            }

            case 'deleteCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const query = `mutation DeleteCustomer($input: DeleteCustomerInput!) {
                    deleteCustomer(input: $input) { clientMutationId }
                }`;
                await gql(query, { input: { customerId } });
                return { output: { success: true, customerId } };
            }

            case 'createPaymentMethod': {
                const customerId = String(inputs.customerId ?? '').trim();
                const paymentMethodNonce = String(inputs.paymentMethodNonce ?? '').trim();
                if (!customerId || !paymentMethodNonce) throw new Error('customerId and paymentMethodNonce are required.');
                const query = `mutation CreatePaymentMethod($input: VaultPaymentMethodInput!) {
                    vaultPaymentMethod(input: $input) { paymentMethod { id } }
                }`;
                const data = await gql(query, { input: { customerId, paymentMethodNonce } });
                const pm = data?.vaultPaymentMethod?.paymentMethod;
                return { output: { id: pm?.id } };
            }

            case 'getPaymentMethod': {
                const paymentMethodId = String(inputs.paymentMethodId ?? '').trim();
                if (!paymentMethodId) throw new Error('paymentMethodId is required.');
                const query = `query GetPaymentMethod($id: ID!) {
                    node(id: $id) { ... on PaymentMethod { id usage } }
                }`;
                const data = await gql(query, { id: paymentMethodId });
                const pm = data?.node;
                return { output: { id: pm?.id, usage: pm?.usage } };
            }

            case 'deletePaymentMethod': {
                const paymentMethodId = String(inputs.paymentMethodId ?? '').trim();
                if (!paymentMethodId) throw new Error('paymentMethodId is required.');
                const query = `mutation DeletePaymentMethod($input: DeletePaymentMethodFromVaultInput!) {
                    deletePaymentMethodFromVault(input: $input) { clientMutationId }
                }`;
                await gql(query, { input: { paymentMethodId } });
                return { output: { success: true, paymentMethodId } };
            }

            case 'listTransactions': {
                const first = Number(inputs.first ?? 10);
                const query = `query ListTransactions($first: Int!) {
                    search { transactions(first: $first) { edges { node { id status amount { value currencyIsoCode } createdAt } } } }
                }`;
                const data = await gql(query, { first });
                const transactions = data?.search?.transactions?.edges?.map((e: any) => ({
                    id: e.node?.id,
                    status: e.node?.status,
                    amount: e.node?.amount?.value,
                    currency: e.node?.amount?.currencyIsoCode,
                    createdAt: e.node?.createdAt,
                })) ?? [];
                return { output: { transactions } };
            }

            case 'createSubscription': {
                const planId = String(inputs.planId ?? '').trim();
                const paymentMethodId = String(inputs.paymentMethodId ?? '').trim();
                if (!planId || !paymentMethodId) throw new Error('planId and paymentMethodId are required.');
                const query = `mutation CreateSubscription($input: CreateSubscriptionInput!) {
                    createSubscription(input: $input) { subscription { id status } }
                }`;
                const data = await gql(query, { input: { planId, paymentMethodId } });
                const sub = data?.createSubscription?.subscription;
                return { output: { id: sub?.id, status: sub?.status } };
            }

            case 'getSubscription': {
                const subscriptionId = String(inputs.subscriptionId ?? '').trim();
                if (!subscriptionId) throw new Error('subscriptionId is required.');
                const query = `query GetSubscription($id: ID!) {
                    node(id: $id) { ... on Subscription { id status nextBillingDate } }
                }`;
                const data = await gql(query, { id: subscriptionId });
                const sub = data?.node;
                return { output: { id: sub?.id, status: sub?.status, nextBillingDate: sub?.nextBillingDate } };
            }

            case 'cancelSubscription': {
                const subscriptionId = String(inputs.subscriptionId ?? '').trim();
                if (!subscriptionId) throw new Error('subscriptionId is required.');
                const query = `mutation CancelSubscription($input: CancelSubscriptionInput!) {
                    cancelSubscription(input: $input) { subscription { id status } }
                }`;
                const data = await gql(query, { input: { subscriptionId } });
                const sub = data?.cancelSubscription?.subscription;
                return { output: { id: sub?.id, status: sub?.status } };
            }

            default:
                return { error: `Braintree Enhanced action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Braintree Enhanced action failed.' };
    }
}

'use server';

export async function executeWaveAccountingAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const endpoint = 'https://gql.waveapps.com/graphql/public';
        const headers = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        const gql = async (query: string, variables: Record<string, any> = {}) => {
            logger?.log(`[WaveAccounting] GraphQL: ${actionName}`);
            const res = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({ query, variables }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.errors?.[0]?.message || `Wave API error: ${res.status}`);
            }
            if (data.errors?.length) {
                throw new Error(data.errors[0].message);
            }
            return data?.data ?? {};
        };

        switch (actionName) {
            case 'listBusinesses': {
                const data = await gql(`query { businesses { edges { node { id name } } } }`);
                return { output: { businesses: data?.businesses?.edges?.map((e: any) => e.node) ?? [] } };
            }

            case 'getBusiness': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const data = await gql(`query($id: ID!) { business(id: $id) { id name } }`, { id: businessId });
                return { output: { business: data?.business ?? {} } };
            }

            case 'listCustomers': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const data = await gql(
                    `query($businessId: ID!) { business(id: $businessId) { customers { edges { node { id name email } } } } }`,
                    { businessId }
                );
                return { output: { customers: data?.business?.customers?.edges?.map((e: any) => e.node) ?? [] } };
            }

            case 'createCustomer': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const data = await gql(
                    `mutation($input: CustomerCreateInput!) { customerCreate(input: $input) { customer { id name email } didSucceed errors { message } } }`,
                    { input: { businessId, name: inputs.name, email: inputs.email } }
                );
                if (!data?.customerCreate?.didSucceed) {
                    throw new Error(data?.customerCreate?.errors?.[0]?.message || 'customerCreate failed');
                }
                return { output: { customer: data?.customerCreate?.customer ?? {} } };
            }

            case 'updateCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const patchData: Record<string, any> = { id: customerId };
                if (inputs.name !== undefined) patchData.name = inputs.name;
                if (inputs.email !== undefined) patchData.email = inputs.email;
                const data = await gql(
                    `mutation($input: CustomerPatchInput!) { customerPatch(input: $input) { customer { id name email } didSucceed errors { message } } }`,
                    { input: patchData }
                );
                if (!data?.customerPatch?.didSucceed) {
                    throw new Error(data?.customerPatch?.errors?.[0]?.message || 'customerPatch failed');
                }
                return { output: { customer: data?.customerPatch?.customer ?? {} } };
            }

            case 'deleteCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const data = await gql(
                    `mutation($input: CustomerDeleteInput!) { customerDelete(input: $input) { didSucceed errors { message } } }`,
                    { input: { id: customerId } }
                );
                if (!data?.customerDelete?.didSucceed) {
                    throw new Error(data?.customerDelete?.errors?.[0]?.message || 'customerDelete failed');
                }
                return { output: { success: true } };
            }

            case 'listProducts': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const data = await gql(
                    `query($businessId: ID!) { business(id: $businessId) { products { edges { node { id name unitPrice { value currency { code } } } } } } }`,
                    { businessId }
                );
                return { output: { products: data?.business?.products?.edges?.map((e: any) => e.node) ?? [] } };
            }

            case 'createProduct': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const data = await gql(
                    `mutation($input: ProductCreateInput!) { productCreate(input: $input) { product { id name } didSucceed errors { message } } }`,
                    { input: { businessId, name: inputs.name, unitPrice: inputs.unitPrice } }
                );
                if (!data?.productCreate?.didSucceed) {
                    throw new Error(data?.productCreate?.errors?.[0]?.message || 'productCreate failed');
                }
                return { output: { product: data?.productCreate?.product ?? {} } };
            }

            case 'listInvoices': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const data = await gql(
                    `query($businessId: ID!) { business(id: $businessId) { invoices { edges { node { id status total { value currency { code } } } } } } }`,
                    { businessId }
                );
                return { output: { invoices: data?.business?.invoices?.edges?.map((e: any) => e.node) ?? [] } };
            }

            case 'getInvoice': {
                const businessId = String(inputs.businessId ?? '').trim();
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!businessId || !invoiceId) throw new Error('businessId and invoiceId are required.');
                const data = await gql(
                    `query($businessId: ID!, $invoiceId: ID!) { business(id: $businessId) { invoice(id: $invoiceId) { id status total { value currency { code } } } } }`,
                    { businessId, invoiceId }
                );
                return { output: { invoice: data?.business?.invoice ?? {} } };
            }

            case 'createInvoice': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const invoiceInput: Record<string, any> = { businessId };
                if (inputs.customerId !== undefined) invoiceInput.customerId = inputs.customerId;
                if (inputs.items !== undefined) invoiceInput.items = inputs.items;
                if (inputs.dueDate !== undefined) invoiceInput.dueDate = inputs.dueDate;
                const data = await gql(
                    `mutation($input: InvoiceCreateInput!) { invoiceCreate(input: $input) { invoice { id status } didSucceed errors { message } } }`,
                    { input: invoiceInput }
                );
                if (!data?.invoiceCreate?.didSucceed) {
                    throw new Error(data?.invoiceCreate?.errors?.[0]?.message || 'invoiceCreate failed');
                }
                return { output: { invoice: data?.invoiceCreate?.invoice ?? {} } };
            }

            case 'sendInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const data = await gql(
                    `mutation($input: InvoiceSendInput!) { invoiceSend(input: $input) { didSucceed errors { message } } }`,
                    { input: { invoiceId, to: inputs.to, subject: inputs.subject, message: inputs.message } }
                );
                if (!data?.invoiceSend?.didSucceed) {
                    throw new Error(data?.invoiceSend?.errors?.[0]?.message || 'invoiceSend failed');
                }
                return { output: { success: true } };
            }

            case 'deleteInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const data = await gql(
                    `mutation($input: InvoiceDeleteInput!) { invoiceDelete(input: $input) { didSucceed errors { message } } }`,
                    { input: { id: invoiceId } }
                );
                if (!data?.invoiceDelete?.didSucceed) {
                    throw new Error(data?.invoiceDelete?.errors?.[0]?.message || 'invoiceDelete failed');
                }
                return { output: { success: true } };
            }

            case 'recordPayment': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const data = await gql(
                    `mutation($input: MoneyTransactionCreateInput!) { moneyTransactionCreate(input: $input) { transaction { id } didSucceed errors { message } } }`,
                    { input: { businessId, externalId: inputs.externalId, date: inputs.date, description: inputs.description, amount: inputs.amount, currency: inputs.currency } }
                );
                if (!data?.moneyTransactionCreate?.didSucceed) {
                    throw new Error(data?.moneyTransactionCreate?.errors?.[0]?.message || 'moneyTransactionCreate failed');
                }
                return { output: { transaction: data?.moneyTransactionCreate?.transaction ?? {} } };
            }

            case 'listAccounts': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const data = await gql(
                    `query($businessId: ID!) { business(id: $businessId) { accounts { edges { node { id name balance { value currency { code } } } } } } }`,
                    { businessId }
                );
                return { output: { accounts: data?.business?.accounts?.edges?.map((e: any) => e.node) ?? [] } };
            }

            case 'getAccount': {
                const businessId = String(inputs.businessId ?? '').trim();
                const accountId = String(inputs.accountId ?? '').trim();
                if (!businessId || !accountId) throw new Error('businessId and accountId are required.');
                const data = await gql(
                    `query($businessId: ID!, $accountId: ID!) { business(id: $businessId) { account(id: $accountId) { id name balance { value currency { code } } } } }`,
                    { businessId, accountId }
                );
                return { output: { account: data?.business?.account ?? {} } };
            }

            default:
                throw new Error(`Unknown Wave Accounting action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[WaveAccounting] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown Wave Accounting error' };
    }
}

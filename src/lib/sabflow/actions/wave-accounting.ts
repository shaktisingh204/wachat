'use server';

export async function executeWaveAccountingAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.token ?? '').trim();
        const gqlUrl = 'https://gql.waveapps.com/graphql/public';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        const gql = async (query: string, variables?: Record<string, any>) => {
            const res = await fetch(gqlUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({ query, variables }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.errors?.[0]?.message || `Wave API error: ${res.status}`);
            if (data.errors?.length) throw new Error(data.errors[0].message);
            return data.data;
        };

        switch (actionName) {
            case 'listBusinesses': {
                const data = await gql(`
                    query ListBusinesses($page: Int, $pageSize: Int) {
                        businesses(page: $page, pageSize: $pageSize) {
                            pageInfo { currentPage totalPages totalCount }
                            edges { node { id name isPersonal isClassicAccounting } }
                        }
                    }
                `, { page: inputs.page ?? 1, pageSize: inputs.pageSize ?? 20 });
                return { output: { businesses: data.businesses.edges.map((e: any) => e.node), pageInfo: data.businesses.pageInfo } };
            }

            case 'getBusiness': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const data = await gql(`
                    query GetBusiness($businessId: ID!) {
                        business(id: $businessId) {
                            id name isPersonal currency { code } timezone { identifier }
                            address { addressLine1 addressLine2 city province { code } country { code } postalCode }
                        }
                    }
                `, { businessId });
                return { output: { business: data.business } };
            }

            case 'listCustomers': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const data = await gql(`
                    query ListCustomers($businessId: ID!, $page: Int, $pageSize: Int) {
                        business(id: $businessId) {
                            customers(page: $page, pageSize: $pageSize) {
                                pageInfo { currentPage totalPages totalCount }
                                edges { node { id name email displayId } }
                            }
                        }
                    }
                `, { businessId, page: inputs.page ?? 1, pageSize: inputs.pageSize ?? 20 });
                const customers = data.business.customers;
                return { output: { customers: customers.edges.map((e: any) => e.node), pageInfo: customers.pageInfo } };
            }

            case 'getCustomer': {
                const businessId = String(inputs.businessId ?? '').trim();
                const customerId = String(inputs.customerId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                if (!customerId) throw new Error('customerId is required.');
                const data = await gql(`
                    query GetCustomer($businessId: ID!, $customerId: ID!) {
                        business(id: $businessId) {
                            customer(id: $customerId) {
                                id name email phone displayId
                                address { addressLine1 city province { code } country { code } postalCode }
                            }
                        }
                    }
                `, { businessId, customerId });
                return { output: { customer: data.business.customer } };
            }

            case 'createCustomer': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const input: Record<string, any> = { businessId };
                if (inputs.name) input.name = inputs.name;
                if (inputs.email) input.email = inputs.email;
                if (inputs.phone) input.phone = inputs.phone;
                if (inputs.address) input.address = inputs.address;
                const data = await gql(`
                    mutation CreateCustomer($input: CustomerCreateInput!) {
                        customerCreate(input: $input) {
                            didSucceed
                            inputErrors { code message path }
                            customer { id name email displayId }
                        }
                    }
                `, { input });
                const result = data.customerCreate;
                if (!result.didSucceed) throw new Error(result.inputErrors?.[0]?.message || 'customerCreate failed.');
                return { output: { customer: result.customer } };
            }

            case 'updateCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const input: Record<string, any> = { id: customerId };
                if (inputs.name) input.name = inputs.name;
                if (inputs.email) input.email = inputs.email;
                if (inputs.phone) input.phone = inputs.phone;
                if (inputs.address) input.address = inputs.address;
                const data = await gql(`
                    mutation UpdateCustomer($input: CustomerPatchInput!) {
                        customerPatch(input: $input) {
                            didSucceed
                            inputErrors { code message path }
                            customer { id name email displayId }
                        }
                    }
                `, { input });
                const result = data.customerPatch;
                if (!result.didSucceed) throw new Error(result.inputErrors?.[0]?.message || 'customerPatch failed.');
                return { output: { customer: result.customer } };
            }

            case 'listInvoices': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const data = await gql(`
                    query ListInvoices($businessId: ID!, $page: Int, $pageSize: Int) {
                        business(id: $businessId) {
                            invoices(page: $page, pageSize: $pageSize) {
                                pageInfo { currentPage totalPages totalCount }
                                edges { node { id invoiceNumber status amountDue { value currency { code } } customer { name } createdAt dueDate } }
                            }
                        }
                    }
                `, { businessId, page: inputs.page ?? 1, pageSize: inputs.pageSize ?? 20 });
                const invoices = data.business.invoices;
                return { output: { invoices: invoices.edges.map((e: any) => e.node), pageInfo: invoices.pageInfo } };
            }

            case 'getInvoice': {
                const businessId = String(inputs.businessId ?? '').trim();
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                if (!invoiceId) throw new Error('invoiceId is required.');
                const data = await gql(`
                    query GetInvoice($businessId: ID!, $invoiceId: ID!) {
                        business(id: $businessId) {
                            invoice(id: $invoiceId) {
                                id invoiceNumber status memo
                                amountDue { value currency { code } }
                                amountPaid { value }
                                customer { id name email }
                                items { product { id name } description quantity unitPrice amount { value } }
                                createdAt dueDate
                            }
                        }
                    }
                `, { businessId, invoiceId });
                return { output: { invoice: data.business.invoice } };
            }

            case 'createInvoice': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const input: Record<string, any> = { businessId };
                if (inputs.customerId) input.customerId = inputs.customerId;
                if (inputs.invoiceDate) input.invoiceDate = inputs.invoiceDate;
                if (inputs.dueDate) input.dueDate = inputs.dueDate;
                if (inputs.memo) input.memo = inputs.memo;
                if (inputs.items) input.items = inputs.items;
                const data = await gql(`
                    mutation CreateInvoice($input: InvoiceCreateInput!) {
                        invoiceCreate(input: $input) {
                            didSucceed
                            inputErrors { code message path }
                            invoice { id invoiceNumber status amountDue { value currency { code } } }
                        }
                    }
                `, { input });
                const result = data.invoiceCreate;
                if (!result.didSucceed) throw new Error(result.inputErrors?.[0]?.message || 'invoiceCreate failed.');
                return { output: { invoice: result.invoice } };
            }

            case 'sendInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const input: Record<string, any> = { invoiceId };
                if (inputs.to) input.to = inputs.to;
                if (inputs.subject) input.subject = inputs.subject;
                if (inputs.message) input.message = inputs.message;
                const data = await gql(`
                    mutation SendInvoice($input: InvoiceSendInput!) {
                        invoiceSend(input: $input) {
                            didSucceed
                            inputErrors { code message path }
                        }
                    }
                `, { input });
                const result = data.invoiceSend;
                if (!result.didSucceed) throw new Error(result.inputErrors?.[0]?.message || 'invoiceSend failed.');
                return { output: { success: true, invoiceId } };
            }

            case 'listProducts': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const data = await gql(`
                    query ListProducts($businessId: ID!, $page: Int, $pageSize: Int) {
                        business(id: $businessId) {
                            products(page: $page, pageSize: $pageSize) {
                                pageInfo { currentPage totalPages totalCount }
                                edges { node { id name description unitPrice isSold isBought } }
                            }
                        }
                    }
                `, { businessId, page: inputs.page ?? 1, pageSize: inputs.pageSize ?? 20 });
                const products = data.business.products;
                return { output: { products: products.edges.map((e: any) => e.node), pageInfo: products.pageInfo } };
            }

            case 'createProduct': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const input: Record<string, any> = { businessId };
                if (inputs.name) input.name = inputs.name;
                if (inputs.description) input.description = inputs.description;
                if (inputs.unitPrice !== undefined) input.unitPrice = inputs.unitPrice;
                if (inputs.isSold !== undefined) input.isSold = inputs.isSold;
                if (inputs.isBought !== undefined) input.isBought = inputs.isBought;
                if (inputs.incomeAccountId) input.incomeAccountId = inputs.incomeAccountId;
                const data = await gql(`
                    mutation CreateProduct($input: ProductCreateInput!) {
                        productCreate(input: $input) {
                            didSucceed
                            inputErrors { code message path }
                            product { id name description unitPrice isSold isBought }
                        }
                    }
                `, { input });
                const result = data.productCreate;
                if (!result.didSucceed) throw new Error(result.inputErrors?.[0]?.message || 'productCreate failed.');
                return { output: { product: result.product } };
            }

            case 'listAccounts': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const data = await gql(`
                    query ListAccounts($businessId: ID!, $page: Int, $pageSize: Int) {
                        business(id: $businessId) {
                            accounts(page: $page, pageSize: $pageSize) {
                                pageInfo { currentPage totalPages totalCount }
                                edges { node { id name description type { name value } subtype { name value } isArchived } }
                            }
                        }
                    }
                `, { businessId, page: inputs.page ?? 1, pageSize: inputs.pageSize ?? 20 });
                const accounts = data.business.accounts;
                return { output: { accounts: accounts.edges.map((e: any) => e.node), pageInfo: accounts.pageInfo } };
            }

            case 'listTransactions': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const data = await gql(`
                    query ListTransactions($businessId: ID!, $page: Int, $pageSize: Int) {
                        business(id: $businessId) {
                            transactions(page: $page, pageSize: $pageSize) {
                                pageInfo { currentPage totalPages totalCount }
                                edges { node { id description transactionDate amount { value currency { code } } anchor } }
                            }
                        }
                    }
                `, { businessId, page: inputs.page ?? 1, pageSize: inputs.pageSize ?? 20 });
                const transactions = data.business.transactions;
                return { output: { transactions: transactions.edges.map((e: any) => e.node), pageInfo: transactions.pageInfo } };
            }

            case 'createTransaction': {
                const businessId = String(inputs.businessId ?? '').trim();
                if (!businessId) throw new Error('businessId is required.');
                const input: Record<string, any> = { businessId };
                if (inputs.externalId) input.externalId = inputs.externalId;
                if (inputs.date) input.date = inputs.date;
                if (inputs.description) input.description = inputs.description;
                if (inputs.anchor) input.anchor = inputs.anchor;
                if (inputs.lineItems) input.lineItems = inputs.lineItems;
                const data = await gql(`
                    mutation CreateTransaction($input: MoneyTransactionCreateInput!) {
                        moneyTransactionCreate(input: $input) {
                            didSucceed
                            inputErrors { code message path }
                            transaction { id description transactionDate amount { value currency { code } } }
                        }
                    }
                `, { input });
                const result = data.moneyTransactionCreate;
                if (!result.didSucceed) throw new Error(result.inputErrors?.[0]?.message || 'moneyTransactionCreate failed.');
                return { output: { transaction: result.transaction } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}

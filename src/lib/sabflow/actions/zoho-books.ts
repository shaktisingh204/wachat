'use server';

export async function executeZohoBooksAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const accessToken = inputs.accessToken;
        const organizationId = inputs.organizationId;
        const baseUrl = 'https://www.zohoapis.com/books/v3';

        const headers: Record<string, string> = {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
        };

        async function zohoGet(path: string, params?: Record<string, string>) {
            const qp = new URLSearchParams({ organization_id: organizationId, ...params });
            const res = await fetch(`${baseUrl}${path}?${qp.toString()}`, {
                method: 'GET',
                headers,
            });
            const data = await res.json();
            if (!res.ok || data.code !== 0) {
                return { error: data.message || JSON.stringify(data) };
            }
            return { data };
        }

        async function zohoPost(path: string, body: any) {
            const qp = new URLSearchParams({ organization_id: organizationId });
            const res = await fetch(`${baseUrl}${path}?${qp.toString()}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok || data.code !== 0) {
                return { error: data.message || JSON.stringify(data) };
            }
            return { data };
        }

        async function zohoPut(path: string, body: any) {
            const qp = new URLSearchParams({ organization_id: organizationId });
            const res = await fetch(`${baseUrl}${path}?${qp.toString()}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok || data.code !== 0) {
                return { error: data.message || JSON.stringify(data) };
            }
            return { data };
        }

        async function zohoDelete(path: string) {
            const qp = new URLSearchParams({ organization_id: organizationId });
            const res = await fetch(`${baseUrl}${path}?${qp.toString()}`, {
                method: 'DELETE',
                headers,
            });
            const data = await res.json();
            if (!res.ok || data.code !== 0) {
                return { error: data.message || JSON.stringify(data) };
            }
            return { data };
        }

        switch (actionName) {
            case 'listContacts': {
                const result = await zohoGet('/contacts', {
                    ...(inputs.contactType ? { contact_type: inputs.contactType } : {}),
                    ...(inputs.page ? { page: String(inputs.page) } : {}),
                });
                if (result.error) return { error: result.error };
                return { output: { contacts: result.data.contacts, page_context: result.data.page_context } };
            }

            case 'getContact': {
                const result = await zohoGet(`/contacts/${inputs.contactId}`);
                if (result.error) return { error: result.error };
                return { output: { contact: result.data.contact } };
            }

            case 'createContact': {
                const body = {
                    contact_name: inputs.contactName,
                    company_name: inputs.companyName,
                    contact_type: inputs.contactType || 'customer',
                    email: inputs.email,
                    phone: inputs.phone,
                    billing_address: inputs.billingAddress,
                    currency_id: inputs.currencyId,
                    payment_terms: inputs.paymentTerms,
                };
                const result = await zohoPost('/contacts', body);
                if (result.error) return { error: result.error };
                return { output: { contact: result.data.contact } };
            }

            case 'updateContact': {
                const body = {
                    contact_name: inputs.contactName,
                    company_name: inputs.companyName,
                    email: inputs.email,
                    phone: inputs.phone,
                };
                const result = await zohoPut(`/contacts/${inputs.contactId}`, body);
                if (result.error) return { error: result.error };
                return { output: { contact: result.data.contact } };
            }

            case 'deleteContact': {
                const result = await zohoDelete(`/contacts/${inputs.contactId}`);
                if (result.error) return { error: result.error };
                return { output: { deleted: true, message: result.data.message } };
            }

            case 'listInvoices': {
                const result = await zohoGet('/invoices', {
                    ...(inputs.status ? { status: inputs.status } : {}),
                    ...(inputs.customerId ? { customer_id: inputs.customerId } : {}),
                    ...(inputs.page ? { page: String(inputs.page) } : {}),
                });
                if (result.error) return { error: result.error };
                return { output: { invoices: result.data.invoices, page_context: result.data.page_context } };
            }

            case 'getInvoice': {
                const result = await zohoGet(`/invoices/${inputs.invoiceId}`);
                if (result.error) return { error: result.error };
                return { output: { invoice: result.data.invoice } };
            }

            case 'createInvoice': {
                const body = {
                    customer_id: inputs.customerId,
                    invoice_number: inputs.invoiceNumber,
                    date: inputs.date,
                    due_date: inputs.dueDate,
                    line_items: inputs.lineItems || [],
                    notes: inputs.notes,
                    terms: inputs.terms,
                    currency_id: inputs.currencyId,
                };
                const result = await zohoPost('/invoices', body);
                if (result.error) return { error: result.error };
                return { output: { invoice: result.data.invoice } };
            }

            case 'updateInvoice': {
                const body = {
                    customer_id: inputs.customerId,
                    date: inputs.date,
                    due_date: inputs.dueDate,
                    line_items: inputs.lineItems,
                    notes: inputs.notes,
                };
                const result = await zohoPut(`/invoices/${inputs.invoiceId}`, body);
                if (result.error) return { error: result.error };
                return { output: { invoice: result.data.invoice } };
            }

            case 'deleteInvoice': {
                const result = await zohoDelete(`/invoices/${inputs.invoiceId}`);
                if (result.error) return { error: result.error };
                return { output: { deleted: true, message: result.data.message } };
            }

            case 'listPayments': {
                const result = await zohoGet('/customerpayments', {
                    ...(inputs.customerId ? { customer_id: inputs.customerId } : {}),
                    ...(inputs.page ? { page: String(inputs.page) } : {}),
                });
                if (result.error) return { error: result.error };
                return { output: { payments: result.data.customerpayments, page_context: result.data.page_context } };
            }

            case 'createPayment': {
                const body = {
                    customer_id: inputs.customerId,
                    payment_mode: inputs.paymentMode || 'cash',
                    amount: inputs.amount,
                    date: inputs.date,
                    invoices: inputs.invoices || [],
                    reference_number: inputs.referenceNumber,
                    description: inputs.description,
                };
                const result = await zohoPost('/customerpayments', body);
                if (result.error) return { error: result.error };
                return { output: { payment: result.data.payment } };
            }

            case 'listExpenses': {
                const result = await zohoGet('/expenses', {
                    ...(inputs.status ? { status: inputs.status } : {}),
                    ...(inputs.page ? { page: String(inputs.page) } : {}),
                });
                if (result.error) return { error: result.error };
                return { output: { expenses: result.data.expenses, page_context: result.data.page_context } };
            }

            case 'createExpense': {
                const body = {
                    account_id: inputs.accountId,
                    date: inputs.date,
                    amount: inputs.amount,
                    description: inputs.description,
                    paid_through_account_id: inputs.paidThroughAccountId,
                    vendor_id: inputs.vendorId,
                    currency_id: inputs.currencyId,
                    reference_number: inputs.referenceNumber,
                };
                const result = await zohoPost('/expenses', body);
                if (result.error) return { error: result.error };
                return { output: { expense: result.data.expense } };
            }

            case 'getOrganization': {
                const result = await zohoGet('/organizations');
                if (result.error) return { error: result.error };
                return { output: { organizations: result.data.organizations } };
            }

            default:
                return { error: `Unknown Zoho Books action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Zoho Books action error: ${err.message}`);
        return { error: err.message || 'Zoho Books action failed' };
    }
}

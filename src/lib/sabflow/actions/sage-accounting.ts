'use server';

export async function executeSageAccountingAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const baseUrl = 'https://api.accounting.sage.com/v3.1';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('items_per_page', String(inputs.pageSize));
                if (inputs.search) params.set('search', String(inputs.search));
                const res = await fetch(`${baseUrl}/contacts?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.['$message'] || `Sage API error: ${res.status}`);
                return { output: { contacts: data['$items'] ?? data, total: data['$total'] } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const res = await fetch(`${baseUrl}/contacts/${contactId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.['$message'] || `Sage API error: ${res.status}`);
                return { output: { contact: data } };
            }

            case 'createContact': {
                const body: Record<string, any> = { contact: {} };
                if (inputs.name) body.contact.name = inputs.name;
                if (inputs.contactType) body.contact.contact_type_ids = Array.isArray(inputs.contactType) ? inputs.contactType : [inputs.contactType];
                if (inputs.email) body.contact.email = inputs.email;
                if (inputs.phone) body.contact.telephone = inputs.phone;
                if (inputs.taxNumber) body.contact.tax_number = inputs.taxNumber;
                const res = await fetch(`${baseUrl}/contacts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.['$message'] || `Sage API error: ${res.status}`);
                return { output: { contact: data } };
            }

            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const body: Record<string, any> = { contact: {} };
                if (inputs.name) body.contact.name = inputs.name;
                if (inputs.email) body.contact.email = inputs.email;
                if (inputs.phone) body.contact.telephone = inputs.phone;
                if (inputs.taxNumber) body.contact.tax_number = inputs.taxNumber;
                const res = await fetch(`${baseUrl}/contacts/${contactId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.['$message'] || `Sage API error: ${res.status}`);
                return { output: { contact: data } };
            }

            case 'listInvoices': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('items_per_page', String(inputs.pageSize));
                if (inputs.status) params.set('status_id', String(inputs.status));
                if (inputs.fromDate) params.set('from_date', String(inputs.fromDate));
                if (inputs.toDate) params.set('to_date', String(inputs.toDate));
                const res = await fetch(`${baseUrl}/sales_invoices?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.['$message'] || `Sage API error: ${res.status}`);
                return { output: { invoices: data['$items'] ?? data, total: data['$total'] } };
            }

            case 'getInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const res = await fetch(`${baseUrl}/sales_invoices/${invoiceId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.['$message'] || `Sage API error: ${res.status}`);
                return { output: { invoice: data } };
            }

            case 'createInvoice': {
                const body: Record<string, any> = { sales_invoice: {} };
                if (inputs.contactId) body.sales_invoice.contact_id = inputs.contactId;
                if (inputs.date) body.sales_invoice.date = inputs.date;
                if (inputs.dueDate) body.sales_invoice.due_date = inputs.dueDate;
                if (inputs.reference) body.sales_invoice.reference = inputs.reference;
                if (inputs.lineItems) body.sales_invoice.invoice_lines_attributes = inputs.lineItems;
                const res = await fetch(`${baseUrl}/sales_invoices`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.['$message'] || `Sage API error: ${res.status}`);
                return { output: { invoice: data } };
            }

            case 'updateInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const body: Record<string, any> = { sales_invoice: {} };
                if (inputs.date) body.sales_invoice.date = inputs.date;
                if (inputs.dueDate) body.sales_invoice.due_date = inputs.dueDate;
                if (inputs.reference) body.sales_invoice.reference = inputs.reference;
                if (inputs.lineItems) body.sales_invoice.invoice_lines_attributes = inputs.lineItems;
                const res = await fetch(`${baseUrl}/sales_invoices/${invoiceId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.['$message'] || `Sage API error: ${res.status}`);
                return { output: { invoice: data } };
            }

            case 'listPayments': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('items_per_page', String(inputs.pageSize));
                if (inputs.fromDate) params.set('from_date', String(inputs.fromDate));
                if (inputs.toDate) params.set('to_date', String(inputs.toDate));
                const res = await fetch(`${baseUrl}/payments?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.['$message'] || `Sage API error: ${res.status}`);
                return { output: { payments: data['$items'] ?? data, total: data['$total'] } };
            }

            case 'createPayment': {
                const body: Record<string, any> = { payment: {} };
                if (inputs.transactionTypeId) body.payment.transaction_type_id = inputs.transactionTypeId;
                if (inputs.transactionId) body.payment.transaction_id = inputs.transactionId;
                if (inputs.date) body.payment.date = inputs.date;
                if (inputs.amount) body.payment.amount = inputs.amount;
                if (inputs.bankAccountId) body.payment.bank_account_id = inputs.bankAccountId;
                const res = await fetch(`${baseUrl}/payments`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.['$message'] || `Sage API error: ${res.status}`);
                return { output: { payment: data } };
            }

            case 'listAccounts': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('items_per_page', String(inputs.pageSize));
                if (inputs.search) params.set('search', String(inputs.search));
                const res = await fetch(`${baseUrl}/ledger_accounts?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.['$message'] || `Sage API error: ${res.status}`);
                return { output: { accounts: data['$items'] ?? data, total: data['$total'] } };
            }

            case 'getAccount': {
                const accountId = String(inputs.accountId ?? '').trim();
                if (!accountId) throw new Error('accountId is required.');
                const res = await fetch(`${baseUrl}/ledger_accounts/${accountId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.['$message'] || `Sage API error: ${res.status}`);
                return { output: { account: data } };
            }

            case 'listJournalEntries': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('items_per_page', String(inputs.pageSize));
                if (inputs.fromDate) params.set('from_date', String(inputs.fromDate));
                if (inputs.toDate) params.set('to_date', String(inputs.toDate));
                const res = await fetch(`${baseUrl}/journals?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.['$message'] || `Sage API error: ${res.status}`);
                return { output: { journals: data['$items'] ?? data, total: data['$total'] } };
            }

            case 'createJournalEntry': {
                const body: Record<string, any> = { journal: {} };
                if (inputs.date) body.journal.date = inputs.date;
                if (inputs.reference) body.journal.reference = inputs.reference;
                if (inputs.description) body.journal.description = inputs.description;
                if (inputs.journalLines) body.journal.journal_lines_attributes = inputs.journalLines;
                const res = await fetch(`${baseUrl}/journals`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.['$message'] || `Sage API error: ${res.status}`);
                return { output: { journal: data } };
            }

            case 'listBankAccounts': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.pageSize) params.set('items_per_page', String(inputs.pageSize));
                const res = await fetch(`${baseUrl}/bank_accounts?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.['$message'] || `Sage API error: ${res.status}`);
                return { output: { bankAccounts: data['$items'] ?? data, total: data['$total'] } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}

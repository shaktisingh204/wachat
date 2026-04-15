
'use server';

async function freshsalesFetch(domain: string, apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Freshsales] ${method} ${path}`);
    const url = `https://${domain}.freshsales.io/api${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Token token=${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.errors?.[0]?.message || data?.message || `Freshsales API error: ${res.status}`);
    }
    return data;
}

export async function executeFreshSalesAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const domain = String(inputs.domain ?? '').trim().replace(/\.freshsales\.io.*/, '');
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!domain || !apiKey) throw new Error('domain and apiKey are required.');
        const fs = (method: string, path: string, body?: any) => freshsalesFetch(domain, apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listLeads': {
                const page = Number(inputs.page ?? 1);
                const perPage = Number(inputs.perPage ?? 25);
                const data = await fs('GET', `/leads?page=${page}&per_page=${perPage}`);
                return { output: { leads: data.leads ?? [], totalCount: String(data.meta?.total_count ?? 0) } };
            }

            case 'getLead': {
                const leadId = String(inputs.leadId ?? '').trim();
                if (!leadId) throw new Error('leadId is required.');
                const data = await fs('GET', `/leads/${leadId}`);
                return { output: { lead: data.lead ?? data } };
            }

            case 'createLead': {
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const body: any = { lead: { email, first_name: firstName, last_name: lastName } };
                if (inputs.phone) body.lead.phone = String(inputs.phone);
                if (inputs.company) body.lead.company = { name: String(inputs.company) };
                if (inputs.title) body.lead.job_title = String(inputs.title);
                const data = await fs('POST', '/leads', body);
                return { output: { lead: data.lead ?? data, leadId: String(data.lead?.id ?? '') } };
            }

            case 'updateLead': {
                const leadId = String(inputs.leadId ?? '').trim();
                if (!leadId) throw new Error('leadId is required.');
                const body: any = { lead: {} };
                if (inputs.firstName) body.lead.first_name = String(inputs.firstName);
                if (inputs.lastName) body.lead.last_name = String(inputs.lastName);
                if (inputs.email) body.lead.email = String(inputs.email);
                if (inputs.phone) body.lead.phone = String(inputs.phone);
                if (inputs.title) body.lead.job_title = String(inputs.title);
                const data = await fs('PUT', `/leads/${leadId}`, body);
                return { output: { lead: data.lead ?? data } };
            }

            case 'deleteLead': {
                const leadId = String(inputs.leadId ?? '').trim();
                if (!leadId) throw new Error('leadId is required.');
                await fs('DELETE', `/leads/${leadId}`);
                return { output: { deleted: 'true' } };
            }

            case 'listContacts': {
                const page = Number(inputs.page ?? 1);
                const perPage = Number(inputs.perPage ?? 25);
                const data = await fs('GET', `/contacts?page=${page}&per_page=${perPage}`);
                return { output: { contacts: data.contacts ?? [], totalCount: String(data.meta?.total_count ?? 0) } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await fs('GET', `/contacts/${contactId}`);
                return { output: { contact: data.contact ?? data } };
            }

            case 'createContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const body: any = { contact: { email } };
                if (inputs.firstName) body.contact.first_name = String(inputs.firstName);
                if (inputs.lastName) body.contact.last_name = String(inputs.lastName);
                if (inputs.phone) body.contact.mobile_number = String(inputs.phone);
                if (inputs.title) body.contact.job_title = String(inputs.title);
                if (inputs.accountId) body.contact.sales_account_id = Number(inputs.accountId);
                const data = await fs('POST', '/contacts', body);
                return { output: { contact: data.contact ?? data, contactId: String(data.contact?.id ?? '') } };
            }

            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const body: any = { contact: {} };
                if (inputs.firstName) body.contact.first_name = String(inputs.firstName);
                if (inputs.lastName) body.contact.last_name = String(inputs.lastName);
                if (inputs.email) body.contact.email = String(inputs.email);
                if (inputs.phone) body.contact.mobile_number = String(inputs.phone);
                const data = await fs('PUT', `/contacts/${contactId}`, body);
                return { output: { contact: data.contact ?? data } };
            }

            case 'deleteContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                await fs('DELETE', `/contacts/${contactId}`);
                return { output: { deleted: 'true' } };
            }

            case 'listAccounts': {
                const page = Number(inputs.page ?? 1);
                const perPage = Number(inputs.perPage ?? 25);
                const data = await fs('GET', `/sales_accounts?page=${page}&per_page=${perPage}`);
                return { output: { accounts: data.sales_accounts ?? [], totalCount: String(data.meta?.total_count ?? 0) } };
            }

            case 'getAccount': {
                const accountId = String(inputs.accountId ?? '').trim();
                if (!accountId) throw new Error('accountId is required.');
                const data = await fs('GET', `/sales_accounts/${accountId}`);
                return { output: { account: data.sales_account ?? data } };
            }

            case 'createAccount': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { sales_account: { name } };
                if (inputs.website) body.sales_account.website = String(inputs.website);
                if (inputs.phone) body.sales_account.phone = String(inputs.phone);
                if (inputs.industry) body.sales_account.industry_type_id = Number(inputs.industry);
                const data = await fs('POST', '/sales_accounts', body);
                return { output: { account: data.sales_account ?? data, accountId: String(data.sales_account?.id ?? '') } };
            }

            case 'updateAccount': {
                const accountId = String(inputs.accountId ?? '').trim();
                if (!accountId) throw new Error('accountId is required.');
                const body: any = { sales_account: {} };
                if (inputs.name) body.sales_account.name = String(inputs.name);
                if (inputs.website) body.sales_account.website = String(inputs.website);
                if (inputs.phone) body.sales_account.phone = String(inputs.phone);
                const data = await fs('PUT', `/sales_accounts/${accountId}`, body);
                return { output: { account: data.sales_account ?? data } };
            }

            case 'listDeals': {
                const page = Number(inputs.page ?? 1);
                const perPage = Number(inputs.perPage ?? 25);
                const data = await fs('GET', `/deals?page=${page}&per_page=${perPage}`);
                return { output: { deals: data.deals ?? [], totalCount: String(data.meta?.total_count ?? 0) } };
            }

            case 'getDeal': {
                const dealId = String(inputs.dealId ?? '').trim();
                if (!dealId) throw new Error('dealId is required.');
                const data = await fs('GET', `/deals/${dealId}`);
                return { output: { deal: data.deal ?? data } };
            }

            case 'createDeal': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { deal: { name } };
                if (inputs.amount !== undefined) body.deal.amount = Number(inputs.amount);
                if (inputs.expectedClose) body.deal.expected_close = String(inputs.expectedClose);
                if (inputs.contactId) body.deal.contact_id = Number(inputs.contactId);
                if (inputs.accountId) body.deal.sales_account_id = Number(inputs.accountId);
                const data = await fs('POST', '/deals', body);
                return { output: { deal: data.deal ?? data, dealId: String(data.deal?.id ?? '') } };
            }

            case 'updateDeal': {
                const dealId = String(inputs.dealId ?? '').trim();
                if (!dealId) throw new Error('dealId is required.');
                const body: any = { deal: {} };
                if (inputs.name) body.deal.name = String(inputs.name);
                if (inputs.amount !== undefined) body.deal.amount = Number(inputs.amount);
                if (inputs.expectedClose) body.deal.expected_close = String(inputs.expectedClose);
                const data = await fs('PUT', `/deals/${dealId}`, body);
                return { output: { deal: data.deal ?? data } };
            }

            case 'listActivities': {
                const page = Number(inputs.page ?? 1);
                const perPage = Number(inputs.perPage ?? 25);
                const data = await fs('GET', `/tasks?page=${page}&per_page=${perPage}`);
                return { output: { activities: data.tasks ?? [], totalCount: String(data.meta?.total_count ?? 0) } };
            }

            case 'createActivity': {
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const body: any = { task: { title } };
                if (inputs.dueDate) body.task.due_date = String(inputs.dueDate);
                if (inputs.ownerId) body.task.owner_id = Number(inputs.ownerId);
                if (inputs.targetableId) body.task.targetable_id = Number(inputs.targetableId);
                if (inputs.targetableType) body.task.targetable_type = String(inputs.targetableType);
                const data = await fs('POST', '/tasks', body);
                return { output: { activity: data.task ?? data, activityId: String(data.task?.id ?? '') } };
            }

            default:
                return { error: `Freshsales action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Freshsales action failed.' };
    }
}

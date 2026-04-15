'use server';

async function freshworksFetch(domain: string, apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Freshworks] ${method} ${path}`);
    const url = `https://${domain}.myfreshworks.com/crm/sales/api${path}`;
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
        throw new Error(data?.errors?.message?.[0] || data?.message || `Freshworks API error: ${res.status}`);
    }
    return data;
}

export async function executeFreshworksAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const domain = String(inputs.domain ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!domain || !apiKey) throw new Error('domain and apiKey are required.');

        const fw = (method: string, path: string, body?: any) => freshworksFetch(domain, apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listContacts': {
                const page = Number(inputs.page ?? 1);
                const data = await fw('GET', `/contacts/view/all?page=${page}`);
                return { output: { contacts: data.contacts ?? [], count: (data.contacts ?? []).length } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await fw('GET', `/contacts/${contactId}`);
                return { output: { contact: data.contact ?? {} } };
            }

            case 'createContact': {
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!firstName && !lastName && !email) throw new Error('At least one of firstName, lastName, or email is required.');
                const contact: any = {};
                if (firstName) contact.first_name = firstName;
                if (lastName) contact.last_name = lastName;
                if (email) contact.email = email;
                if (inputs.phone) contact.phone = String(inputs.phone);
                if (inputs.jobTitle) contact.job_title = String(inputs.jobTitle);
                const data = await fw('POST', '/contacts', { contact });
                return { output: { contact: data.contact ?? {} } };
            }

            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const contact: any = {};
                if (inputs.firstName) contact.first_name = String(inputs.firstName);
                if (inputs.lastName) contact.last_name = String(inputs.lastName);
                if (inputs.email) contact.email = String(inputs.email);
                if (inputs.phone) contact.phone = String(inputs.phone);
                if (inputs.jobTitle) contact.job_title = String(inputs.jobTitle);
                const data = await fw('PUT', `/contacts/${contactId}`, { contact });
                return { output: { contact: data.contact ?? {} } };
            }

            case 'deleteContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                await fw('DELETE', `/contacts/${contactId}`);
                return { output: { deleted: 'true', contactId } };
            }

            case 'listLeads': {
                const page = Number(inputs.page ?? 1);
                const data = await fw('GET', `/leads/view/all?page=${page}`);
                return { output: { leads: data.leads ?? [], count: (data.leads ?? []).length } };
            }

            case 'getLead': {
                const leadId = String(inputs.leadId ?? '').trim();
                if (!leadId) throw new Error('leadId is required.');
                const data = await fw('GET', `/leads/${leadId}`);
                return { output: { lead: data.lead ?? {} } };
            }

            case 'createLead': {
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!firstName && !lastName) throw new Error('At least one of firstName or lastName is required.');
                const lead: any = {};
                if (firstName) lead.first_name = firstName;
                if (lastName) lead.last_name = lastName;
                if (email) lead.email = email;
                if (inputs.phone) lead.phone = String(inputs.phone);
                if (inputs.company) lead.company = { name: String(inputs.company) };
                const data = await fw('POST', '/leads', { lead });
                return { output: { lead: data.lead ?? {} } };
            }

            case 'updateLead': {
                const leadId = String(inputs.leadId ?? '').trim();
                if (!leadId) throw new Error('leadId is required.');
                const lead: any = {};
                if (inputs.firstName) lead.first_name = String(inputs.firstName);
                if (inputs.lastName) lead.last_name = String(inputs.lastName);
                if (inputs.email) lead.email = String(inputs.email);
                if (inputs.phone) lead.phone = String(inputs.phone);
                const data = await fw('PUT', `/leads/${leadId}`, { lead });
                return { output: { lead: data.lead ?? {} } };
            }

            case 'convertLead': {
                const leadId = String(inputs.leadId ?? '').trim();
                if (!leadId) throw new Error('leadId is required.');
                const data = await fw('POST', `/leads/${leadId}/convert`);
                return { output: { contact: data.contact ?? {}, deal: data.deal ?? {} } };
            }

            case 'listAccounts': {
                const page = Number(inputs.page ?? 1);
                const data = await fw('GET', `/sales_accounts/view/all?page=${page}`);
                return { output: { accounts: data.sales_accounts ?? [], count: (data.sales_accounts ?? []).length } };
            }

            case 'getAccount': {
                const accountId = String(inputs.accountId ?? '').trim();
                if (!accountId) throw new Error('accountId is required.');
                const data = await fw('GET', `/sales_accounts/${accountId}`);
                return { output: { account: data.sales_account ?? {} } };
            }

            case 'createAccount': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const sales_account: any = { name };
                if (inputs.website) sales_account.website = String(inputs.website);
                if (inputs.phone) sales_account.phone = String(inputs.phone);
                const data = await fw('POST', '/sales_accounts', { sales_account });
                return { output: { account: data.sales_account ?? {} } };
            }

            case 'listDeals': {
                const page = Number(inputs.page ?? 1);
                const data = await fw('GET', `/deals/view/all?page=${page}`);
                return { output: { deals: data.deals ?? [], count: (data.deals ?? []).length } };
            }

            case 'getDeal': {
                const dealId = String(inputs.dealId ?? '').trim();
                if (!dealId) throw new Error('dealId is required.');
                const data = await fw('GET', `/deals/${dealId}`);
                return { output: { deal: data.deal ?? {} } };
            }

            case 'createDeal': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const deal: any = { name };
                if (inputs.amount) deal.amount = Number(inputs.amount);
                if (inputs.closeDate) deal.expected_close = String(inputs.closeDate);
                if (inputs.salesAccountId) deal.sales_account_id = Number(inputs.salesAccountId);
                if (inputs.ownerId) deal.owner_id = Number(inputs.ownerId);
                const data = await fw('POST', '/deals', { deal });
                return { output: { deal: data.deal ?? {} } };
            }

            case 'updateDeal': {
                const dealId = String(inputs.dealId ?? '').trim();
                if (!dealId) throw new Error('dealId is required.');
                const deal: any = {};
                if (inputs.name) deal.name = String(inputs.name);
                if (inputs.amount) deal.amount = Number(inputs.amount);
                if (inputs.closeDate) deal.expected_close = String(inputs.closeDate);
                if (inputs.dealStageId) deal.deal_stage_id = Number(inputs.dealStageId);
                const data = await fw('PUT', `/deals/${dealId}`, { deal });
                return { output: { deal: data.deal ?? {} } };
            }

            case 'listActivities': {
                const page = Number(inputs.page ?? 1);
                const data = await fw('GET', `/sales_activities?page=${page}`);
                return { output: { activities: data.sales_activities ?? [], count: (data.sales_activities ?? []).length } };
            }

            case 'createNote': {
                const targetableType = String(inputs.targetableType ?? 'Contact').trim();
                const targetableId = String(inputs.targetableId ?? '').trim();
                const description = String(inputs.description ?? '').trim();
                if (!targetableId || !description) throw new Error('targetableId and description are required.');
                const data = await fw('POST', '/notes', {
                    note: { targetable_type: targetableType, targetable_id: Number(targetableId), description },
                });
                return { output: { note: data.note ?? {} } };
            }

            case 'listUsers': {
                const data = await fw('GET', '/selector/owners');
                return { output: { users: data.users ?? [], count: (data.users ?? []).length } };
            }

            default:
                return { error: `Freshworks action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Freshworks action failed.' };
    }
}

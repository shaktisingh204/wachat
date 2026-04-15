'use server';

function dynHeaders(accessToken: string): Record<string, string> {
    return {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
    };
}

function dynBase(inputs: any): { baseUrl: string; headers: Record<string, string> } {
    if (!inputs.accessToken) throw new Error('Missing required input: accessToken');
    if (!inputs.orgName) throw new Error('Missing required input: orgName');
    const baseUrl = `https://${inputs.orgName}.crm.dynamics.com/api/data/v9.2`;
    return { baseUrl, headers: dynHeaders(inputs.accessToken) };
}

async function dynRequest(method: string, url: string, headers: Record<string, string>, body?: any, queryParams?: Record<string, string>): Promise<any> {
    const reqUrl = new URL(url);
    if (queryParams) {
        for (const [k, v] of Object.entries(queryParams)) reqUrl.searchParams.set(k, v);
    }
    const res = await fetch(reqUrl.toString(), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return { success: true };
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
        throw new Error(data?.error?.message ?? `Dynamics 365 API error ${res.status}: ${text}`);
    }
    return data;
}

export async function executeMicrosoftDynamicsAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        logger.log(`Executing Microsoft Dynamics 365 action: ${actionName}`);
        const { baseUrl, headers } = dynBase(inputs);

        switch (actionName) {

            case 'listAccounts': {
                const params: Record<string, string> = {};
                if (inputs.select) params['$select'] = inputs.select;
                if (inputs.filter) params['$filter'] = inputs.filter;
                if (inputs.top) params['$top'] = String(inputs.top);
                if (inputs.orderby) params['$orderby'] = inputs.orderby;
                const data = await dynRequest('GET', `${baseUrl}/accounts`, headers, undefined, params);
                return { output: { accounts: data?.value ?? [], count: data?.['@odata.count'] } };
            }

            case 'getAccount': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                const params: Record<string, string> = {};
                if (inputs.select) params['$select'] = inputs.select;
                if (inputs.expand) params['$expand'] = inputs.expand;
                const data = await dynRequest('GET', `${baseUrl}/accounts(${inputs.accountId})`, headers, undefined, params);
                return { output: { account: data } };
            }

            case 'createAccount': {
                if (!inputs.data) return { error: 'Missing required input: data (account fields)' };
                const data = await dynRequest('POST', `${baseUrl}/accounts`, headers, inputs.data);
                return { output: { created: true, account: data } };
            }

            case 'updateAccount': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                if (!inputs.data) return { error: 'Missing required input: data (fields to update)' };
                const data = await dynRequest('PATCH', `${baseUrl}/accounts(${inputs.accountId})`, headers, inputs.data);
                return { output: { updated: true, accountId: inputs.accountId, result: data } };
            }

            case 'deleteAccount': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                await dynRequest('DELETE', `${baseUrl}/accounts(${inputs.accountId})`, headers);
                return { output: { deleted: true, accountId: inputs.accountId } };
            }

            case 'listContacts': {
                const params: Record<string, string> = {};
                if (inputs.select) params['$select'] = inputs.select;
                if (inputs.filter) params['$filter'] = inputs.filter;
                if (inputs.top) params['$top'] = String(inputs.top);
                if (inputs.orderby) params['$orderby'] = inputs.orderby;
                const data = await dynRequest('GET', `${baseUrl}/contacts`, headers, undefined, params);
                return { output: { contacts: data?.value ?? [], count: data?.['@odata.count'] } };
            }

            case 'getContact': {
                if (!inputs.contactId) return { error: 'Missing required input: contactId' };
                const params: Record<string, string> = {};
                if (inputs.select) params['$select'] = inputs.select;
                if (inputs.expand) params['$expand'] = inputs.expand;
                const data = await dynRequest('GET', `${baseUrl}/contacts(${inputs.contactId})`, headers, undefined, params);
                return { output: { contact: data } };
            }

            case 'createContact': {
                if (!inputs.data) return { error: 'Missing required input: data (contact fields)' };
                const data = await dynRequest('POST', `${baseUrl}/contacts`, headers, inputs.data);
                return { output: { created: true, contact: data } };
            }

            case 'listOpportunities': {
                const params: Record<string, string> = {};
                if (inputs.select) params['$select'] = inputs.select;
                if (inputs.filter) params['$filter'] = inputs.filter;
                if (inputs.top) params['$top'] = String(inputs.top);
                if (inputs.orderby) params['$orderby'] = inputs.orderby;
                const data = await dynRequest('GET', `${baseUrl}/opportunities`, headers, undefined, params);
                return { output: { opportunities: data?.value ?? [], count: data?.['@odata.count'] } };
            }

            case 'getOpportunity': {
                if (!inputs.opportunityId) return { error: 'Missing required input: opportunityId' };
                const params: Record<string, string> = {};
                if (inputs.select) params['$select'] = inputs.select;
                if (inputs.expand) params['$expand'] = inputs.expand;
                const data = await dynRequest('GET', `${baseUrl}/opportunities(${inputs.opportunityId})`, headers, undefined, params);
                return { output: { opportunity: data } };
            }

            case 'createOpportunity': {
                if (!inputs.data) return { error: 'Missing required input: data (opportunity fields)' };
                const data = await dynRequest('POST', `${baseUrl}/opportunities`, headers, inputs.data);
                return { output: { created: true, opportunity: data } };
            }

            case 'listLeads': {
                const params: Record<string, string> = {};
                if (inputs.select) params['$select'] = inputs.select;
                if (inputs.filter) params['$filter'] = inputs.filter;
                if (inputs.top) params['$top'] = String(inputs.top);
                if (inputs.orderby) params['$orderby'] = inputs.orderby;
                const data = await dynRequest('GET', `${baseUrl}/leads`, headers, undefined, params);
                return { output: { leads: data?.value ?? [], count: data?.['@odata.count'] } };
            }

            case 'getLead': {
                if (!inputs.leadId) return { error: 'Missing required input: leadId' };
                const params: Record<string, string> = {};
                if (inputs.select) params['$select'] = inputs.select;
                if (inputs.expand) params['$expand'] = inputs.expand;
                const data = await dynRequest('GET', `${baseUrl}/leads(${inputs.leadId})`, headers, undefined, params);
                return { output: { lead: data } };
            }

            case 'createLead': {
                if (!inputs.data) return { error: 'Missing required input: data (lead fields)' };
                const data = await dynRequest('POST', `${baseUrl}/leads`, headers, inputs.data);
                return { output: { created: true, lead: data } };
            }

            case 'executeQuery': {
                if (!inputs.entity) return { error: 'Missing required input: entity (e.g. accounts, contacts)' };
                const params: Record<string, string> = {};
                if (inputs.select) params['$select'] = inputs.select;
                if (inputs.filter) params['$filter'] = inputs.filter;
                if (inputs.expand) params['$expand'] = inputs.expand;
                if (inputs.orderby) params['$orderby'] = inputs.orderby;
                if (inputs.top) params['$top'] = String(inputs.top);
                if (inputs.skip) params['$skip'] = String(inputs.skip);
                if (inputs.count) params['$count'] = 'true';
                const data = await dynRequest('GET', `${baseUrl}/${inputs.entity}`, headers, undefined, params);
                return { output: { results: data?.value ?? data, count: data?.['@odata.count'], nextLink: data?.['@odata.nextLink'] } };
            }

            default:
                return { error: `Microsoft Dynamics 365 action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Microsoft Dynamics 365 action error [${actionName}]: ${err?.message}`);
        return { error: err?.message ?? 'Unknown Microsoft Dynamics 365 error' };
    }
}

'use server';

const BE_BASE = 'https://clientapi.benchmarkemail.com';

async function beFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[BenchmarkEmail] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            AuthToken: apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${BE_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Benchmark Email API error: ${res.status}`);
    }
    return data;
}

export async function executeBenchmarkEmailAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const be = (method: string, path: string, body?: any) =>
            beFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listContacts': {
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                const params: string[] = [];
                if (inputs.pageNumber) params.push(`PageNumber=${Number(inputs.pageNumber)}`);
                if (inputs.pageSize) params.push(`PageSize=${Number(inputs.pageSize)}`);
                const qs = params.length ? `?${params.join('&')}` : '';
                const data = await be('GET', `/Contact/${listId}/ContactList${qs}`);
                return { output: { contacts: data.Response ?? [], total: String((data.Response ?? []).length) } };
            }

            case 'createContact': {
                const listId = String(inputs.listId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!listId || !email) throw new Error('listId and email are required.');
                const contactData: any = { Email: email };
                if (inputs.firstName) contactData.FirstName = String(inputs.firstName);
                if (inputs.lastName) contactData.LastName = String(inputs.lastName);
                const data = await be('POST', `/Contact/${listId}/ContactList`, { Contact: contactData });
                return { output: { contactId: String(data.Response?.ID ?? ''), email } };
            }

            case 'updateContact': {
                const listId = String(inputs.listId ?? '').trim();
                const contactId = String(inputs.contactId ?? '').trim();
                if (!listId || !contactId) throw new Error('listId and contactId are required.');
                const contactData: any = {};
                if (inputs.email) contactData.Email = String(inputs.email);
                if (inputs.firstName) contactData.FirstName = String(inputs.firstName);
                if (inputs.lastName) contactData.LastName = String(inputs.lastName);
                const data = await be('PUT', `/Contact/${listId}/ContactList/${contactId}`, { Contact: contactData });
                return { output: { contactId: String(data.Response?.ID ?? contactId) } };
            }

            case 'deleteContact': {
                const listId = String(inputs.listId ?? '').trim();
                const contactId = String(inputs.contactId ?? '').trim();
                if (!listId || !contactId) throw new Error('listId and contactId are required.');
                await be('DELETE', `/Contact/${listId}/ContactList/${contactId}`);
                return { output: { deleted: 'true', listId, contactId } };
            }

            case 'listLists': {
                const params: string[] = [];
                if (inputs.pageNumber) params.push(`PageNumber=${Number(inputs.pageNumber)}`);
                if (inputs.pageSize) params.push(`PageSize=${Number(inputs.pageSize)}`);
                const qs = params.length ? `?${params.join('&')}` : '';
                const data = await be('GET', `/Contact${qs}`);
                return { output: { lists: data.Response ?? [], total: String((data.Response ?? []).length) } };
            }

            case 'createList': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await be('POST', '/Contact', { Contact: { Name: name } });
                return { output: { listId: String(data.Response?.ID ?? ''), name } };
            }

            case 'addContactToList': {
                const listId = String(inputs.listId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!listId || !email) throw new Error('listId and email are required.');
                const contactData: any = { Email: email };
                if (inputs.firstName) contactData.FirstName = String(inputs.firstName);
                if (inputs.lastName) contactData.LastName = String(inputs.lastName);
                const data = await be('POST', `/Contact/${listId}/ContactList`, { Contact: contactData });
                return { output: { contactId: String(data.Response?.ID ?? ''), listId, email } };
            }

            case 'deleteContactFromList': {
                const listId = String(inputs.listId ?? '').trim();
                const contactId = String(inputs.contactId ?? '').trim();
                if (!listId || !contactId) throw new Error('listId and contactId are required.');
                await be('DELETE', `/Contact/${listId}/ContactList/${contactId}`);
                return { output: { deleted: 'true', listId, contactId } };
            }

            case 'listCampaigns': {
                const params: string[] = [];
                if (inputs.pageNumber) params.push(`PageNumber=${Number(inputs.pageNumber)}`);
                if (inputs.pageSize) params.push(`PageSize=${Number(inputs.pageSize)}`);
                const qs = params.length ? `?${params.join('&')}` : '';
                const data = await be('GET', `/Email${qs}`);
                return { output: { campaigns: data.Response ?? [], total: String((data.Response ?? []).length) } };
            }

            case 'createCampaign': {
                const name = String(inputs.name ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const fromName = String(inputs.fromName ?? '').trim();
                const fromEmail = String(inputs.fromEmail ?? '').trim();
                if (!name || !subject || !fromName || !fromEmail) throw new Error('name, subject, fromName, and fromEmail are required.');
                const emailData: any = { Name: name, Subject: subject, FromName: fromName, FromEmail: fromEmail };
                if (inputs.replyToEmail) emailData.ReplyToEmail = String(inputs.replyToEmail);
                if (inputs.htmlContent) emailData.HTMLContent = String(inputs.htmlContent);
                const data = await be('POST', '/Email', { Email: emailData });
                return { output: { campaignId: String(data.Response?.ID ?? ''), name } };
            }

            case 'sendCampaign': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!campaignId) throw new Error('campaignId is required.');
                const body: any = {};
                if (inputs.scheduleDate) body.ScheduleDate = String(inputs.scheduleDate);
                if (inputs.listIds) body.MailingList = Array.isArray(inputs.listIds) ? inputs.listIds : [inputs.listIds];
                const data = await be('POST', `/Email/${campaignId}/Schedule`, body);
                return { output: { sent: 'true', campaignId, status: data.Response ?? '' } };
            }

            case 'getCampaignReport': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!campaignId) throw new Error('campaignId is required.');
                const data = await be('GET', `/Report/Email/${campaignId}/Summary`);
                return { output: { report: data.Response ?? {}, campaignId } };
            }

            case 'listAutoresponders': {
                const params: string[] = [];
                if (inputs.pageNumber) params.push(`PageNumber=${Number(inputs.pageNumber)}`);
                const qs = params.length ? `?${params.join('&')}` : '';
                const data = await be('GET', `/Autoresponder${qs}`);
                return { output: { autoresponders: data.Response ?? [], total: String((data.Response ?? []).length) } };
            }

            case 'listTemplates': {
                const params: string[] = [];
                if (inputs.pageNumber) params.push(`PageNumber=${Number(inputs.pageNumber)}`);
                if (inputs.pageSize) params.push(`PageSize=${Number(inputs.pageSize)}`);
                const qs = params.length ? `?${params.join('&')}` : '';
                const data = await be('GET', `/Template${qs}`);
                return { output: { templates: data.Response ?? [], total: String((data.Response ?? []).length) } };
            }

            case 'getAccountInfo': {
                const data = await be('GET', '/Account');
                return { output: { account: data.Response ?? {}, email: data.Response?.Email ?? '', name: data.Response?.Name ?? '' } };
            }

            default:
                return { error: `Benchmark Email action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Benchmark Email action failed.' };
    }
}

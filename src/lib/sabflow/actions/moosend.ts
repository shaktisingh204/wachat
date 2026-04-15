'use server';

const MOOSEND_BASE = 'https://api.moosend.com/v3';

async function moosendFetch(
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    logger?.log(`[Moosend] ${method} ${path}`);
    const separator = path.includes('?') ? '&' : '?';
    const url = `${MOOSEND_BASE}${path}${separator}apikey=${encodeURIComponent(apiKey)}`;
    const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok || data?.Code !== 0) {
        const err = data?.Error ?? data?.message ?? `Moosend API error: ${res.status}`;
        throw new Error(String(err));
    }
    return data?.Context ?? data;
}

export async function executeMoosendAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const ms = (method: string, path: string, body?: any) =>
            moosendFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listMailingLists': {
                const data = await ms('GET', '/lists.json');
                return { output: { mailingLists: data } };
            }

            case 'getMailingList': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await ms('GET', `/lists/${id}/details.json`);
                return { output: { mailingList: data } };
            }

            case 'createMailingList': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await ms('POST', '/lists/create.json', { Name: name });
                return { output: { mailingList: data } };
            }

            case 'addSubscriber': {
                const mailingListId = String(inputs.mailingListId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!mailingListId) throw new Error('mailingListId is required.');
                if (!email) throw new Error('email is required.');
                const body: any = { Email: email };
                if (inputs.name) body.Name = String(inputs.name);
                const data = await ms('POST', `/subscribers/${mailingListId}/subscribe.json`, body);
                return { output: { subscriber: data } };
            }

            case 'getSubscriber': {
                const mailingListId = String(inputs.mailingListId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!mailingListId) throw new Error('mailingListId is required.');
                if (!email) throw new Error('email is required.');
                const data = await ms('GET', `/subscribers/${mailingListId}/view.json?Email=${encodeURIComponent(email)}`);
                return { output: { subscriber: data } };
            }

            case 'unsubscribe': {
                const mailingListId = String(inputs.mailingListId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!mailingListId) throw new Error('mailingListId is required.');
                if (!email) throw new Error('email is required.');
                const data = await ms('POST', `/subscribers/${mailingListId}/unsubscribe.json`, { Email: email });
                return { output: { result: data } };
            }

            case 'removeSubscriber': {
                const mailingListId = String(inputs.mailingListId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!mailingListId) throw new Error('mailingListId is required.');
                if (!email) throw new Error('email is required.');
                const data = await ms('POST', `/subscribers/${mailingListId}/remove.json`, { Email: email });
                return { output: { result: data } };
            }

            case 'listCampaigns': {
                const data = await ms('GET', '/campaigns.json');
                return { output: { campaigns: data } };
            }

            case 'getCampaign': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await ms('GET', `/campaigns/${id}/view.json`);
                return { output: { campaign: data } };
            }

            case 'createEmailCampaign': {
                const body: any = {
                    Name: String(inputs.name ?? ''),
                    Subject: String(inputs.subject ?? ''),
                    SenderEmail: String(inputs.senderEmail ?? ''),
                    SenderName: String(inputs.senderName ?? ''),
                    MailingListID: String(inputs.mailingListId ?? ''),
                };
                if (inputs.htmlContent) body.HTMLContent = String(inputs.htmlContent);
                const data = await ms('POST', '/campaigns/create.json', body);
                return { output: { campaign: data } };
            }

            case 'sendCampaign': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await ms('POST', `/campaigns/${id}/send.json`, {});
                return { output: { result: data } };
            }

            case 'scheduleCampaign': {
                const id = String(inputs.id ?? '').trim();
                const scheduledDateTime = String(inputs.scheduledDateTime ?? '').trim();
                if (!id) throw new Error('id is required.');
                if (!scheduledDateTime) throw new Error('scheduledDateTime is required.');
                const data = await ms('POST', `/campaigns/${id}/schedule.json`, {
                    ScheduledDateTime: scheduledDateTime,
                    Timezone: inputs.timezone ?? 'UTC',
                });
                return { output: { result: data } };
            }

            case 'getStats': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await ms('GET', `/campaigns/${id}/stats/sent.json`);
                return { output: { stats: data } };
            }

            default:
                return { error: `Unknown Moosend action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Moosend] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown Moosend error' };
    }
}

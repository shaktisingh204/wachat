'use server';

const LOOPS_BASE = 'https://app.loops.so/api/v1';

async function loopsFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Loops] ${method} ${path}`);
    const url = `${LOOPS_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Loops API error: ${res.status}`);
    }
    return data;
}

export async function executeLoopsAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) return { error: 'inputs.apiKey is required' };

        switch (actionName) {
            case 'createContact': {
                if (!inputs.email) return { error: 'inputs.email is required' };
                const data = await loopsFetch(apiKey, 'POST', '/contacts/create', {
                    email: inputs.email,
                    firstName: inputs.firstName,
                    lastName: inputs.lastName,
                    source: inputs.source,
                    subscribed: inputs.subscribed ?? true,
                    userGroup: inputs.userGroup,
                    userId: inputs.userId,
                    mailingLists: inputs.mailingLists || {},
                    ...inputs.customFields,
                }, logger);
                return { output: data };
            }

            case 'updateContact': {
                if (!inputs.email) return { error: 'inputs.email is required' };
                const data = await loopsFetch(apiKey, 'PUT', '/contacts/update', {
                    email: inputs.email,
                    firstName: inputs.firstName,
                    lastName: inputs.lastName,
                    source: inputs.source,
                    subscribed: inputs.subscribed,
                    userGroup: inputs.userGroup,
                    userId: inputs.userId,
                    mailingLists: inputs.mailingLists,
                    ...inputs.customFields,
                }, logger);
                return { output: data };
            }

            case 'deleteContact': {
                if (!inputs.email && !inputs.userId) return { error: 'inputs.email or inputs.userId is required' };
                const body: any = {};
                if (inputs.email) body.email = inputs.email;
                if (inputs.userId) body.userId = inputs.userId;
                const data = await loopsFetch(apiKey, 'POST', '/contacts/delete', body, logger);
                return { output: data };
            }

            case 'findContact': {
                if (!inputs.email) return { error: 'inputs.email is required' };
                const params = new URLSearchParams({ email: inputs.email });
                const data = await loopsFetch(apiKey, 'GET', `/contacts/find?${params}`, undefined, logger);
                return { output: data };
            }

            case 'sendEvent': {
                if (!inputs.eventName) return { error: 'inputs.eventName is required' };
                if (!inputs.email && !inputs.userId) return { error: 'inputs.email or inputs.userId is required' };
                const payload: any = { eventName: inputs.eventName };
                if (inputs.email) payload.email = inputs.email;
                if (inputs.userId) payload.userId = inputs.userId;
                if (inputs.contactProperties) payload.contactProperties = inputs.contactProperties;
                if (inputs.eventProperties) payload.eventProperties = inputs.eventProperties;
                if (inputs.mailingLists) payload.mailingLists = inputs.mailingLists;
                const data = await loopsFetch(apiKey, 'POST', '/events/send', payload, logger);
                return { output: data };
            }

            case 'sendTransactional': {
                if (!inputs.transactionalId) return { error: 'inputs.transactionalId is required' };
                if (!inputs.email) return { error: 'inputs.email is required' };
                const data = await loopsFetch(apiKey, 'POST', '/transactional', {
                    transactionalId: inputs.transactionalId,
                    email: inputs.email,
                    dataVariables: inputs.dataVariables || {},
                    attachments: inputs.attachments,
                    addToAudience: inputs.addToAudience,
                }, logger);
                return { output: data };
            }

            case 'listCustomFields': {
                const data = await loopsFetch(apiKey, 'GET', '/contacts/customFields', undefined, logger);
                return { output: data };
            }

            case 'createMailingList': {
                if (!inputs.name) return { error: 'inputs.name is required' };
                const data = await loopsFetch(apiKey, 'POST', '/lists', {
                    name: inputs.name,
                    isPublic: inputs.isPublic ?? false,
                }, logger);
                return { output: data };
            }

            case 'subscribeToList': {
                if (!inputs.mailingListId) return { error: 'inputs.mailingListId is required' };
                if (!inputs.email) return { error: 'inputs.email is required' };
                const data = await loopsFetch(apiKey, 'PUT', '/contacts/update', {
                    email: inputs.email,
                    mailingLists: { [inputs.mailingListId]: true },
                }, logger);
                return { output: data };
            }

            case 'unsubscribeFromList': {
                if (!inputs.mailingListId) return { error: 'inputs.mailingListId is required' };
                if (!inputs.email) return { error: 'inputs.email is required' };
                const data = await loopsFetch(apiKey, 'PUT', '/contacts/update', {
                    email: inputs.email,
                    mailingLists: { [inputs.mailingListId]: false },
                }, logger);
                return { output: data };
            }

            case 'getContactMailingLists': {
                if (!inputs.email) return { error: 'inputs.email is required' };
                const params = new URLSearchParams({ email: inputs.email });
                const data = await loopsFetch(apiKey, 'GET', `/contacts/find?${params}`, undefined, logger);
                return { output: { email: inputs.email, mailingLists: data?.[0]?.mailingLists || {} } };
            }

            case 'listTransactionalEmails': {
                const data = await loopsFetch(apiKey, 'GET', '/transactional', undefined, logger);
                return { output: data };
            }

            case 'getTransactionalEmail': {
                if (!inputs.transactionalId) return { error: 'inputs.transactionalId is required' };
                const data = await loopsFetch(apiKey, 'GET', `/transactional/${inputs.transactionalId}`, undefined, logger);
                return { output: data };
            }

            case 'testTransactionalEmail': {
                if (!inputs.transactionalId) return { error: 'inputs.transactionalId is required' };
                if (!inputs.email) return { error: 'inputs.email is required' };
                const data = await loopsFetch(apiKey, 'POST', `/transactional/${inputs.transactionalId}/test`, {
                    email: inputs.email,
                    dataVariables: inputs.dataVariables || {},
                }, logger);
                return { output: data };
            }

            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const qs = params.toString() ? `?${params}` : '';
                const data = await loopsFetch(apiKey, 'GET', `/contacts${qs}`, undefined, logger);
                return { output: data };
            }

            default:
                return { error: `Unknown Loops action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Loops] Error: ${err.message}`);
        return { error: err.message || 'Loops action failed' };
    }
}

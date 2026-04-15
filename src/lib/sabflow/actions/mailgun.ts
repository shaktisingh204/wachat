
'use server';

function getMailgunBase(region: string): string {
    return region === 'eu' ? 'https://api.eu.mailgun.net/v3' : 'https://api.mailgun.net/v3';
}

function makeAuth(apiKey: string): string {
    return 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64');
}

async function mailgunFetch(
    auth: string,
    method: string,
    url: string,
    body?: URLSearchParams | Record<string, any>,
    isJson = false,
    logger?: any
) {
    logger?.log(`[Mailgun] ${method} ${url}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: auth,
        },
    };
    if (body !== undefined) {
        if (isJson) {
            (options.headers as any)['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        } else if (body instanceof URLSearchParams) {
            (options.headers as any)['Content-Type'] = 'application/x-www-form-urlencoded';
            options.body = body.toString();
        }
    }
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { message: text }; }
    if (!res.ok) {
        throw new Error(data?.message || `Mailgun API error: ${res.status}`);
    }
    return data;
}

export async function executeMailgunAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const domain = String(inputs.domain ?? '').trim();
        const region = String(inputs.region ?? 'us').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const base = getMailgunBase(region);
        const auth = makeAuth(apiKey);

        const mg = (method: string, path: string, body?: URLSearchParams | Record<string, any>, isJson = false) =>
            mailgunFetch(auth, method, `${base}${path}`, body, isJson, logger);

        switch (actionName) {
            case 'sendEmail': {
                if (!domain) throw new Error('domain is required.');
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                if (!to || !from || !subject) throw new Error('to, from, and subject are required.');
                const params = new URLSearchParams();
                params.append('to', to);
                params.append('from', from);
                params.append('subject', subject);
                if (inputs.html) params.append('html', String(inputs.html));
                if (inputs.text) params.append('text', String(inputs.text));
                if (inputs.cc) params.append('cc', String(inputs.cc));
                if (inputs.bcc) params.append('bcc', String(inputs.bcc));
                if (inputs.replyTo) params.append('h:Reply-To', String(inputs.replyTo));
                const data = await mg('POST', `/${domain}/messages`, params);
                return { output: { id: data.id ?? '', message: data.message ?? '' } };
            }

            case 'sendTemplate': {
                if (!domain) throw new Error('domain is required.');
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const template = String(inputs.template ?? '').trim();
                if (!to || !from || !subject || !template) throw new Error('to, from, subject, and template are required.');
                const params = new URLSearchParams();
                params.append('to', to);
                params.append('from', from);
                params.append('subject', subject);
                params.append('template', template);
                if (inputs.variables) params.append('t:variables', String(inputs.variables));
                const data = await mg('POST', `/${domain}/messages`, params);
                return { output: { id: data.id ?? '', message: data.message ?? '' } };
            }

            case 'getEmailStatus': {
                if (!domain) throw new Error('domain is required.');
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required.');
                const data = await mg('GET', `/${domain}/events?message-id=${encodeURIComponent(messageId)}`);
                const items = data.items ?? [];
                return { output: { events: items, count: String(items.length) } };
            }

            case 'createMailingList': {
                const address = String(inputs.address ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!address || !name) throw new Error('address and name are required.');
                const params = new URLSearchParams();
                params.append('address', address);
                params.append('name', name);
                if (inputs.description) params.append('description', String(inputs.description));
                const data = await mg('POST', '/lists', params);
                return { output: { address: data.list?.address ?? address, name: data.list?.name ?? name, created: 'true' } };
            }

            case 'addListMember': {
                const listAddress = String(inputs.listAddress ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!listAddress || !email) throw new Error('listAddress and email are required.');
                const params = new URLSearchParams();
                params.append('address', email);
                if (inputs.name) params.append('name', String(inputs.name));
                if (inputs.vars) params.append('vars', String(inputs.vars));
                params.append('subscribed', 'true');
                const data = await mg('POST', `/lists/${listAddress}/members`, params);
                return { output: { address: data.member?.address ?? email, added: 'true' } };
            }

            case 'getListMembers': {
                const listAddress = String(inputs.listAddress ?? '').trim();
                const limit = Number(inputs.limit ?? 100);
                if (!listAddress) throw new Error('listAddress is required.');
                const data = await mg('GET', `/lists/${listAddress}/members?limit=${limit}`);
                const items = data.items ?? [];
                return { output: { members: items, count: String(items.length) } };
            }

            case 'deleteListMember': {
                const listAddress = String(inputs.listAddress ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!listAddress || !email) throw new Error('listAddress and email are required.');
                await mg('DELETE', `/lists/${listAddress}/members/${encodeURIComponent(email)}`);
                return { output: { deleted: 'true', email } };
            }

            case 'validateEmail': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const validateAuth = makeAuth(apiKey);
                const data = await mailgunFetch(
                    validateAuth,
                    'GET',
                    `https://api.mailgun.net/v4/address/validate?address=${encodeURIComponent(email)}`,
                    undefined,
                    false,
                    logger
                );
                return { output: { isValid: String(data.is_valid ?? false), result: data.result ?? '', risk: data.risk ?? '' } };
            }

            case 'getStats': {
                if (!domain) throw new Error('domain is required.');
                const event = String(inputs.event ?? '').trim();
                if (!event) throw new Error('event is required.');
                let path = `/${domain}/stats/total?event=${encodeURIComponent(event)}`;
                if (inputs.start) path += `&start=${encodeURIComponent(String(inputs.start))}`;
                const data = await mg('GET', path);
                const stats = data.stats ?? [];
                return { output: { stats, count: String(stats.length) } };
            }

            case 'getDomains': {
                const data = await mg('GET', '/domains');
                const items = data.items ?? [];
                return { output: { domains: items, count: String(items.length) } };
            }

            case 'suppressEmail': {
                if (!domain) throw new Error('domain is required.');
                const address = String(inputs.address ?? '').trim();
                if (!address) throw new Error('address is required.');
                const params = new URLSearchParams();
                params.append('address', address);
                if (inputs.tag) params.append('tag', String(inputs.tag));
                const data = await mg('POST', `/${domain}/unsubscribes`, params);
                return { output: { suppressed: 'true', address, message: data.message ?? '' } };
            }

            case 'getSuppressions': {
                if (!domain) throw new Error('domain is required.');
                const limit = Number(inputs.limit ?? 100);
                const data = await mg('GET', `/${domain}/unsubscribes?limit=${limit}`);
                const items = data.items ?? [];
                return { output: { suppressions: items, count: String(items.length) } };
            }

            default:
                return { error: `Mailgun action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Mailgun action failed.' };
    }
}

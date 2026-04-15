'use server';

export async function executeMailgunEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const domain = String(inputs.domain ?? '').trim();
        const basicAuth = Buffer.from('api:' + apiKey).toString('base64');
        const BASE = 'https://api.mailgun.net/v3';

        switch (actionName) {
            case 'sendEmail': {
                const url = `${BASE}/${domain}/messages`;
                const form = new URLSearchParams();
                form.append('from', String(inputs.from ?? ''));
                form.append('to', String(inputs.to ?? ''));
                if (inputs.cc) form.append('cc', String(inputs.cc));
                if (inputs.bcc) form.append('bcc', String(inputs.bcc));
                form.append('subject', String(inputs.subject ?? ''));
                if (inputs.text) form.append('text', String(inputs.text));
                if (inputs.html) form.append('html', String(inputs.html));
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${basicAuth}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: form.toString(),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Mailgun error: ${res.status}`);
                return { output: { id: data.id, message: data.message } };
            }

            case 'listMessages': {
                const url = `${BASE}/${domain}/messages`;
                const res = await fetch(url, {
                    method: 'GET',
                    headers: { 'Authorization': `Basic ${basicAuth}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Mailgun error: ${res.status}`);
                return { output: { items: data.items, paging: data.paging } };
            }

            case 'getMessage': {
                const storageUrl = String(inputs.storageUrl ?? '').trim();
                const res = await fetch(storageUrl, {
                    method: 'GET',
                    headers: { 'Authorization': `Basic ${basicAuth}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Mailgun error: ${res.status}`);
                return { output: data };
            }

            case 'deleteMessage': {
                const storageUrl = String(inputs.storageUrl ?? '').trim();
                const res = await fetch(storageUrl, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Basic ${basicAuth}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Mailgun error: ${res.status}`);
                return { output: { message: data.message } };
            }

            case 'listDomains': {
                const limit = inputs.limit ?? 100;
                const skip = inputs.skip ?? 0;
                const url = `${BASE}/domains?limit=${limit}&skip=${skip}`;
                const res = await fetch(url, {
                    method: 'GET',
                    headers: { 'Authorization': `Basic ${basicAuth}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Mailgun error: ${res.status}`);
                return { output: { items: data.items, total_count: data.total_count } };
            }

            case 'getDomain': {
                const targetDomain = String(inputs.targetDomain ?? domain).trim();
                const url = `${BASE}/domains/${targetDomain}`;
                const res = await fetch(url, {
                    method: 'GET',
                    headers: { 'Authorization': `Basic ${basicAuth}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Mailgun error: ${res.status}`);
                return { output: { domain: data.domain, receiving_dns_records: data.receiving_dns_records, sending_dns_records: data.sending_dns_records } };
            }

            case 'createDomain': {
                const url = `${BASE}/domains`;
                const form = new URLSearchParams();
                form.append('name', String(inputs.name ?? ''));
                if (inputs.smtp_password) form.append('smtp_password', String(inputs.smtp_password));
                if (inputs.spam_action) form.append('spam_action', String(inputs.spam_action));
                if (inputs.wildcard !== undefined) form.append('wildcard', String(inputs.wildcard));
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${basicAuth}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: form.toString(),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Mailgun error: ${res.status}`);
                return { output: { domain: data.domain, message: data.message } };
            }

            case 'deleteDomain': {
                const targetDomain = String(inputs.targetDomain ?? domain).trim();
                const url = `${BASE}/domains/${targetDomain}`;
                const res = await fetch(url, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Basic ${basicAuth}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Mailgun error: ${res.status}`);
                return { output: { message: data.message } };
            }

            case 'listRoutes': {
                const limit = inputs.limit ?? 100;
                const skip = inputs.skip ?? 0;
                const url = `${BASE}/routes?limit=${limit}&skip=${skip}`;
                const res = await fetch(url, {
                    method: 'GET',
                    headers: { 'Authorization': `Basic ${basicAuth}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Mailgun error: ${res.status}`);
                return { output: { items: data.items, total_count: data.total_count } };
            }

            case 'createRoute': {
                const url = `${BASE}/routes`;
                const form = new URLSearchParams();
                form.append('expression', String(inputs.expression ?? ''));
                const actions: string[] = Array.isArray(inputs.actions) ? inputs.actions : [String(inputs.actions ?? '')];
                actions.forEach(a => form.append('action', a));
                if (inputs.description) form.append('description', String(inputs.description));
                if (inputs.priority !== undefined) form.append('priority', String(inputs.priority));
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${basicAuth}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: form.toString(),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Mailgun error: ${res.status}`);
                return { output: { route: data.route, message: data.message } };
            }

            case 'updateRoute': {
                const routeId = String(inputs.routeId ?? '').trim();
                const url = `${BASE}/routes/${routeId}`;
                const form = new URLSearchParams();
                if (inputs.expression) form.append('expression', String(inputs.expression));
                if (inputs.actions) {
                    const actions: string[] = Array.isArray(inputs.actions) ? inputs.actions : [String(inputs.actions)];
                    actions.forEach(a => form.append('action', a));
                }
                if (inputs.description) form.append('description', String(inputs.description));
                if (inputs.priority !== undefined) form.append('priority', String(inputs.priority));
                const res = await fetch(url, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Basic ${basicAuth}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: form.toString(),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Mailgun error: ${res.status}`);
                return { output: data };
            }

            case 'deleteRoute': {
                const routeId = String(inputs.routeId ?? '').trim();
                const url = `${BASE}/routes/${routeId}`;
                const res = await fetch(url, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Basic ${basicAuth}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Mailgun error: ${res.status}`);
                return { output: { message: data.message } };
            }

            case 'listMailingLists': {
                const url = `${BASE}/lists/pages`;
                const res = await fetch(url, {
                    method: 'GET',
                    headers: { 'Authorization': `Basic ${basicAuth}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Mailgun error: ${res.status}`);
                return { output: { items: data.items } };
            }

            case 'createMailingList': {
                const url = `${BASE}/lists`;
                const form = new URLSearchParams();
                form.append('address', String(inputs.address ?? ''));
                if (inputs.name) form.append('name', String(inputs.name));
                if (inputs.description) form.append('description', String(inputs.description));
                if (inputs.access_level) form.append('access_level', String(inputs.access_level));
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${basicAuth}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: form.toString(),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Mailgun error: ${res.status}`);
                return { output: { list: data.list, message: data.message } };
            }

            case 'addMember': {
                const listAddress = String(inputs.listAddress ?? '').trim();
                const url = `${BASE}/lists/${listAddress}/members`;
                const form = new URLSearchParams();
                form.append('address', String(inputs.address ?? ''));
                if (inputs.name) form.append('name', String(inputs.name));
                if (inputs.subscribed !== undefined) form.append('subscribed', String(inputs.subscribed));
                if (inputs.upsert !== undefined) form.append('upsert', String(inputs.upsert));
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${basicAuth}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: form.toString(),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Mailgun error: ${res.status}`);
                return { output: { member: data.member, message: data.message } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Mailgun action failed.' };
    }
}

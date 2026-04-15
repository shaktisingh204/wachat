
'use server';

import crypto from 'crypto';

async function mailchimpFetch(apiKey: string, server: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Mailchimp] ${method} ${path}`);
    const base64Auth = Buffer.from(`anystring:${apiKey}`).toString('base64');
    const url = `https://${server}.api.mailchimp.com/3.0${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Basic ${base64Auth}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.detail || data?.title || `Mailchimp API error: ${res.status}`);
    }
    return data;
}

function md5Email(email: string): string {
    return crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
}

function getServer(apiKey: string): string {
    return apiKey.split('-').pop() ?? 'us1';
}

export async function executeMailchimpAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const server = getServer(apiKey);
        const mc = (method: string, path: string, body?: any) => mailchimpFetch(apiKey, server, method, path, body, logger);

        switch (actionName) {
            case 'addSubscriber': {
                const listId = String(inputs.listId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                const status = String(inputs.status ?? 'subscribed').trim();
                if (!listId || !email) throw new Error('listId and email are required.');
                const body: any = { email_address: email, status };
                if (firstName || lastName) body.merge_fields = { FNAME: firstName, LNAME: lastName };
                const data = await mc('POST', `/lists/${listId}/members`, body);
                return { output: { id: data.id, email: data.email_address, status: data.status } };
            }

            case 'updateSubscriber': {
                const listId = String(inputs.listId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!listId || !email) throw new Error('listId and email are required.');
                const hash = md5Email(email);
                const body: any = {};
                if (inputs.status) body.status = String(inputs.status);
                if (inputs.firstName || inputs.lastName) {
                    body.merge_fields = { FNAME: String(inputs.firstName ?? ''), LNAME: String(inputs.lastName ?? '') };
                }
                const data = await mc('PATCH', `/lists/${listId}/members/${hash}`, body);
                return { output: { id: data.id, email: data.email_address, status: data.status } };
            }

            case 'getSubscriber': {
                const listId = String(inputs.listId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!listId || !email) throw new Error('listId and email are required.');
                const hash = md5Email(email);
                const data = await mc('GET', `/lists/${listId}/members/${hash}`);
                return { output: { id: data.id, email: data.email_address, status: data.status, tags: data.tags ?? [] } };
            }

            case 'archiveSubscriber': {
                const listId = String(inputs.listId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!listId || !email) throw new Error('listId and email are required.');
                const hash = md5Email(email);
                await mc('DELETE', `/lists/${listId}/members/${hash}`);
                return { output: { archived: 'true', email } };
            }

            case 'addTag': {
                const listId = String(inputs.listId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const tagName = String(inputs.tagName ?? '').trim();
                if (!listId || !email || !tagName) throw new Error('listId, email, and tagName are required.');
                const hash = md5Email(email);
                await mc('POST', `/lists/${listId}/members/${hash}/tags`, { tags: [{ name: tagName, status: 'active' }] });
                return { output: { tagged: 'true', tagName } };
            }

            case 'removeTag': {
                const listId = String(inputs.listId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const tagName = String(inputs.tagName ?? '').trim();
                if (!listId || !email || !tagName) throw new Error('listId, email, and tagName are required.');
                const hash = md5Email(email);
                await mc('POST', `/lists/${listId}/members/${hash}/tags`, { tags: [{ name: tagName, status: 'inactive' }] });
                return { output: { removed: 'true', tagName } };
            }

            case 'listMembers': {
                const listId = String(inputs.listId ?? '').trim();
                const count = Number(inputs.count ?? 100);
                const status = String(inputs.status ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                let path = `/lists/${listId}/members?count=${count}`;
                if (status) path += `&status=${status}`;
                const data = await mc('GET', path);
                return { output: { members: data.members ?? [], total: String(data.total_items ?? 0) } };
            }

            case 'createCampaign': {
                const listId = String(inputs.listId ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const fromName = String(inputs.fromName ?? '').trim();
                const replyTo = String(inputs.replyTo ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                if (!listId || !subject || !fromName || !replyTo) throw new Error('listId, subject, fromName, and replyTo are required.');
                const data = await mc('POST', '/campaigns', {
                    type: 'regular',
                    recipients: { list_id: listId },
                    settings: { subject_line: subject, from_name: fromName, reply_to: replyTo, title: title || subject },
                });
                return { output: { id: data.id, status: data.status, webId: String(data.web_id ?? '') } };
            }

            case 'sendCampaign': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!campaignId) throw new Error('campaignId is required.');
                await mc('POST', `/campaigns/${campaignId}/actions/send`);
                return { output: { sent: 'true', campaignId } };
            }

            case 'getCampaignReport': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!campaignId) throw new Error('campaignId is required.');
                const data = await mc('GET', `/reports/${campaignId}`);
                return { output: { opens: String(data.opens?.unique_opens ?? 0), clicks: String(data.clicks?.unique_clicks ?? 0), bounces: String(data.bounces?.hard_bounces ?? 0), unsubscribes: String(data.unsubscribes ?? 0) } };
            }

            case 'createTag': {
                const listId = String(inputs.listId ?? '').trim();
                const tagName = String(inputs.tagName ?? '').trim();
                if (!listId || !tagName) throw new Error('listId and tagName are required.');
                const data = await mc('POST', `/lists/${listId}/segments`, { name: tagName, static_segment: [], options: {} });
                return { output: { id: String(data.id), name: data.name } };
            }

            case 'addSubscriberNote': {
                const listId = String(inputs.listId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const note = String(inputs.note ?? '').trim();
                if (!listId || !email || !note) throw new Error('listId, email, and note are required.');
                const hash = md5Email(email);
                const data = await mc('POST', `/lists/${listId}/members/${hash}/notes`, { note });
                return { output: { id: String(data.note_id), note: data.note } };
            }

            default:
                return { error: `Mailchimp action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Mailchimp action failed.' };
    }
}

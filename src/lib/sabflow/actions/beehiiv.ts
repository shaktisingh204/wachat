
'use server';

const BEEHIIV_BASE = 'https://api.beehiiv.com/v2';

async function beehiivFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Beehiiv] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${BEEHIIV_BASE}${path}`, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.errors?.join(', ') || `Beehiiv API error: ${res.status}`);
    }
    return data;
}

export async function executeBeehiivAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const bh = (method: string, path: string, body?: any) => beehiivFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'createSubscriber': {
                const publicationId = String(inputs.publicationId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!publicationId) throw new Error('publicationId is required.');
                if (!email) throw new Error('email is required.');
                const payload: any = { email };
                if (inputs.reactivateExisting !== undefined) payload.reactivate_existing = inputs.reactivateExisting === true || inputs.reactivateExisting === 'true';
                if (inputs.sendWelcomeEmail !== undefined) payload.send_welcome_email = inputs.sendWelcomeEmail === true || inputs.sendWelcomeEmail === 'true';
                if (inputs.utmSource) payload.utm_source = String(inputs.utmSource);
                if (inputs.utmMedium) payload.utm_medium = String(inputs.utmMedium);
                if (inputs.customFields) {
                    const cf = typeof inputs.customFields === 'string' ? JSON.parse(inputs.customFields) : inputs.customFields;
                    payload.custom_fields = cf;
                }
                const data = await bh('POST', `/publications/${publicationId}/subscriptions`, payload);
                const sub = data.data ?? data;
                return { output: { id: sub.id ?? '', email: sub.email ?? email, status: sub.status ?? '' } };
            }

            case 'getSubscriber': {
                const publicationId = String(inputs.publicationId ?? '').trim();
                const subscriberId = String(inputs.subscriberId ?? '').trim();
                if (!publicationId) throw new Error('publicationId is required.');
                if (!subscriberId) throw new Error('subscriberId is required.');
                const data = await bh('GET', `/publications/${publicationId}/subscriptions/${subscriberId}`);
                const sub = data.data ?? data;
                return { output: { id: sub.id ?? '', email: sub.email ?? '', status: sub.status ?? '', created: String(sub.created_at ?? '') } };
            }

            case 'unsubscribeSubscriber': {
                const publicationId = String(inputs.publicationId ?? '').trim();
                const subscriberId = String(inputs.subscriberId ?? '').trim();
                if (!publicationId) throw new Error('publicationId is required.');
                if (!subscriberId) throw new Error('subscriberId is required.');
                await bh('DELETE', `/publications/${publicationId}/subscriptions/${subscriberId}`);
                return { output: { success: 'true', subscriberId } };
            }

            case 'createPost': {
                const publicationId = String(inputs.publicationId ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                if (!publicationId) throw new Error('publicationId is required.');
                if (!subject) throw new Error('subject is required.');
                const payload: any = { subject };
                if (inputs.previewText) payload.preview_text = String(inputs.previewText);
                if (inputs.authors) payload.authors = typeof inputs.authors === 'string' ? JSON.parse(inputs.authors) : inputs.authors;
                if (inputs.bodyHtml) payload.content_json = inputs.bodyHtml;
                const data = await bh('POST', `/publications/${publicationId}/posts`, payload);
                const post = data.data ?? data;
                return { output: { id: post.id ?? '', subject: post.subject ?? subject, status: post.status ?? '' } };
            }

            case 'getPublications': {
                const data = await bh('GET', '/publications');
                const pubs = data.data ?? [];
                return { output: { count: String(pubs.length), publications: JSON.stringify(pubs) } };
            }

            case 'listSubscribers': {
                const publicationId = String(inputs.publicationId ?? '').trim();
                if (!publicationId) throw new Error('publicationId is required.');
                const limit = inputs.limit ? `&limit=${inputs.limit}` : '';
                const page = inputs.page ? `&page=${inputs.page}` : '';
                const data = await bh('GET', `/publications/${publicationId}/subscriptions?expand[]=stats${limit}${page}`);
                const subs = data.data ?? [];
                return { output: { count: String(subs.length), subscribers: JSON.stringify(subs) } };
            }

            default:
                return { error: `Beehiiv action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Beehiiv action failed.' };
    }
}

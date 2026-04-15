
'use server';

const MAILERLITE_BASE = 'https://connect.mailerlite.com/api';

async function mailerliteFetch(
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[MailerLite] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${MAILERLITE_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || `MailerLite API error: ${res.status}`);
    }
    return data;
}

export async function executeMailerliteAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const ml = (method: string, path: string, body?: any) =>
            mailerliteFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listSubscribers': {
                const page = inputs.page ? `page=${Number(inputs.page)}` : '';
                const limit = inputs.limit ? `limit=${Number(inputs.limit)}` : '';
                const qs = [page, limit].filter(Boolean).join('&');
                const data = await ml('GET', `/subscribers${qs ? `?${qs}` : ''}`);
                return {
                    output: {
                        subscribers: data?.data ?? [],
                        total: String(data?.meta?.total ?? 0),
                    },
                };
            }

            case 'getSubscriber': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const data = await ml('GET', `/subscribers/${encodeURIComponent(email)}`);
                const s = data?.data ?? {};
                return {
                    output: {
                        id: String(s.id ?? ''),
                        email: s.email ?? email,
                        status: s.status ?? '',
                        fields: s.fields ?? {},
                    },
                };
            }

            case 'createSubscriber': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const fields: any = {};
                if (inputs.firstName) fields.name = String(inputs.firstName);
                if (inputs.lastName) fields.last_name = String(inputs.lastName);
                if (inputs.fields && typeof inputs.fields === 'object') {
                    Object.assign(fields, inputs.fields);
                }
                const body: any = { email };
                if (Object.keys(fields).length > 0) body.fields = fields;
                const data = await ml('POST', '/subscribers', body);
                const s = data?.data ?? {};
                return {
                    output: {
                        id: String(s.id ?? ''),
                        email: s.email ?? email,
                    },
                };
            }

            case 'updateSubscriber': {
                const subscriberId = String(inputs.subscriberId ?? '').trim();
                if (!subscriberId) throw new Error('subscriberId is required.');
                const body: any = {};
                if (inputs.fields && typeof inputs.fields === 'object') {
                    body.fields = inputs.fields;
                }
                const data = await ml('PUT', `/subscribers/${subscriberId}`, body);
                const s = data?.data ?? {};
                return {
                    output: {
                        id: String(s.id ?? subscriberId),
                    },
                };
            }

            case 'deleteSubscriber': {
                const subscriberId = String(inputs.subscriberId ?? '').trim();
                if (!subscriberId) throw new Error('subscriberId is required.');
                await ml('DELETE', `/subscribers/${subscriberId}`);
                return {
                    output: {
                        deleted: 'true',
                        subscriberId,
                    },
                };
            }

            case 'listGroups': {
                const data = await ml('GET', '/groups');
                return {
                    output: {
                        groups: data?.data ?? [],
                        total: String(data?.meta?.total ?? 0),
                    },
                };
            }

            case 'addToGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                const subscriberId = String(inputs.subscriberId ?? '').trim();
                if (!groupId || !subscriberId) throw new Error('groupId and subscriberId are required.');
                await ml('POST', `/groups/${groupId}/subscribers/${subscriberId}`);
                return {
                    output: {
                        success: 'true',
                        groupId,
                        subscriberId,
                    },
                };
            }

            case 'removeFromGroup': {
                const groupId = String(inputs.groupId ?? '').trim();
                const subscriberId = String(inputs.subscriberId ?? '').trim();
                if (!groupId || !subscriberId) throw new Error('groupId and subscriberId are required.');
                await ml('DELETE', `/groups/${groupId}/subscribers/${subscriberId}`);
                return {
                    output: {
                        deleted: 'true',
                        groupId,
                        subscriberId,
                    },
                };
            }

            case 'createCampaign': {
                const name = String(inputs.name ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const fromName = String(inputs.fromName ?? '').trim();
                const fromEmail = String(inputs.fromEmail ?? '').trim();
                if (!name || !subject || !fromName || !fromEmail) {
                    throw new Error('name, subject, fromName, and fromEmail are required.');
                }
                const body: any = { name, subject, from: { name: fromName, email: fromEmail } };
                if (inputs.groupIds) {
                    body.groups = Array.isArray(inputs.groupIds)
                        ? inputs.groupIds
                        : String(inputs.groupIds).split(',').map((g: string) => g.trim());
                }
                const data = await ml('POST', '/campaigns', body);
                const c = data?.data ?? {};
                return {
                    output: {
                        id: String(c.id ?? ''),
                        name: c.name ?? name,
                    },
                };
            }

            case 'listCampaigns': {
                const data = await ml('GET', '/campaigns');
                return {
                    output: {
                        campaigns: data?.data ?? [],
                        total: String(data?.meta?.total ?? 0),
                    },
                };
            }

            case 'getCampaignStats': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!campaignId) throw new Error('campaignId is required.');
                const data = await ml('GET', `/campaigns/${campaignId}/reports/subscriber-activity`);
                return {
                    output: {
                        stats: data?.data ?? {},
                    },
                };
            }

            case 'listForms': {
                const data = await ml('GET', '/forms');
                return {
                    output: {
                        forms: data?.data ?? [],
                        total: String(data?.meta?.total ?? 0),
                    },
                };
            }

            default:
                return { error: `MailerLite action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'MailerLite action failed.' };
    }
}

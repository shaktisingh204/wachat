
'use server';

const HUNTER_BASE = 'https://api.hunter.io/v2';

async function hunterFetch(
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[Hunter] ${method} ${path}`);
    // Append api_key to query string for all requests
    const separator = path.includes('?') ? '&' : '?';
    const url = `${HUNTER_BASE}${path}${separator}api_key=${encodeURIComponent(apiKey)}`;
    const options: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.errors?.[0]?.details || data?.message || `Hunter API error: ${res.status}`);
    }
    return data;
}

export async function executeHunterAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const ht = (method: string, path: string, body?: any) =>
            hunterFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'domainSearch': {
                const domain = String(inputs.domain ?? '').trim();
                if (!domain) throw new Error('domain is required.');
                const limit = inputs.limit ? `&limit=${Number(inputs.limit)}` : '';
                const offset = inputs.offset ? `&offset=${Number(inputs.offset)}` : '';
                const data = await ht('GET', `/domain-search?domain=${encodeURIComponent(domain)}${limit}${offset}`);
                const d = data?.data ?? {};
                return {
                    output: {
                        domain: d.domain ?? domain,
                        emails: d.emails ?? [],
                        total: String(d.meta?.total ?? 0),
                    },
                };
            }

            case 'emailFinder': {
                const domain = String(inputs.domain ?? '').trim();
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                if (!domain || !firstName || !lastName) {
                    throw new Error('domain, firstName, and lastName are required.');
                }
                const data = await ht(
                    'GET',
                    `/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}`
                );
                const d = data?.data ?? {};
                return {
                    output: {
                        email: d.email ?? '',
                        score: String(d.score ?? ''),
                        position: d.position ?? '',
                    },
                };
            }

            case 'emailVerifier': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const data = await ht('GET', `/email-verifier?email=${encodeURIComponent(email)}`);
                const d = data?.data ?? {};
                return {
                    output: {
                        email: d.email ?? email,
                        result: d.result ?? '',
                        score: String(d.score ?? ''),
                        disposable: String(d.disposable ?? false),
                        webmail: String(d.webmail ?? false),
                    },
                };
            }

            case 'countEmails': {
                const domain = String(inputs.domain ?? '').trim();
                if (!domain) throw new Error('domain is required.');
                const data = await ht('GET', `/email-count?domain=${encodeURIComponent(domain)}`);
                const d = data?.data ?? {};
                return {
                    output: {
                        total: String(d.total ?? 0),
                        personalEmails: String(d.personal_emails ?? 0),
                        genericEmails: String(d.generic_emails ?? 0),
                    },
                };
            }

            case 'listLeads': {
                const data = await ht('GET', '/leads');
                return {
                    output: {
                        leads: data?.data?.leads ?? [],
                        total: String(data?.data?.meta?.total ?? 0),
                    },
                };
            }

            case 'createLead': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const body: any = { email };
                if (inputs.firstName) body.first_name = String(inputs.firstName);
                if (inputs.lastName) body.last_name = String(inputs.lastName);
                if (inputs.company) body.company = String(inputs.company);
                if (inputs.phone) body.phone_number = String(inputs.phone);
                const data = await ht('POST', '/leads', body);
                const d = data?.data ?? {};
                return {
                    output: {
                        id: String(d.id ?? ''),
                        email: d.email ?? email,
                    },
                };
            }

            case 'deleteLead': {
                const leadId = String(inputs.leadId ?? '').trim();
                if (!leadId) throw new Error('leadId is required.');
                await ht('DELETE', `/leads/${leadId}`);
                return {
                    output: {
                        deleted: 'true',
                        leadId,
                    },
                };
            }

            case 'listCampaigns': {
                const data = await ht('GET', '/campaigns');
                return {
                    output: {
                        campaigns: data?.data?.campaigns ?? [],
                        total: String(data?.data?.meta?.total ?? 0),
                    },
                };
            }

            default:
                return { error: `Hunter action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Hunter action failed.' };
    }
}

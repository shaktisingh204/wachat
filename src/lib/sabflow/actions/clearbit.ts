
'use server';

const CLEARBIT_PERSON_BASE = 'https://person.clearbit.com/v2';
const CLEARBIT_COMPANY_BASE = 'https://company.clearbit.com/v2';
const CLEARBIT_PROSPECTOR_BASE = 'https://prospector.clearbit.com/v2';
const CLEARBIT_REVEAL_BASE = 'https://reveal.clearbit.com/v1';
const CLEARBIT_RISK_BASE = 'https://risk.clearbit.com/v1';
const CLEARBIT_AUTOCOMPLETE_BASE = 'https://autocomplete.clearbit.com/v1';

async function clearbitFetch(
    apiKey: string,
    method: string,
    url: string,
    body?: any,
    logger?: any
) {
    logger?.log(`[Clearbit] ${method} ${url}`);
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
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error?.message || data?.message || `Clearbit API error: ${res.status}`);
    }
    return data;
}

export async function executeClearbitAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const cb = (method: string, url: string, body?: any) =>
            clearbitFetch(apiKey, method, url, body, logger);

        switch (actionName) {
            case 'enrichPerson': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const data = await cb('GET', `${CLEARBIT_PERSON_BASE}/people/find?email=${encodeURIComponent(email)}`);
                return {
                    output: {
                        id: data.id ?? '',
                        firstName: data.name?.given_name ?? '',
                        lastName: data.name?.family_name ?? '',
                        email: data.email ?? email,
                        location: data.location ?? '',
                        employmentName: data.employment?.name ?? '',
                        employmentRole: data.employment?.role ?? '',
                    },
                };
            }

            case 'enrichCompany': {
                const domain = String(inputs.domain ?? '').trim();
                if (!domain) throw new Error('domain is required.');
                const data = await cb('GET', `${CLEARBIT_COMPANY_BASE}/companies/find?domain=${encodeURIComponent(domain)}`);
                return {
                    output: {
                        id: data.id ?? '',
                        name: data.name ?? '',
                        domain: data.domain ?? domain,
                        description: data.description ?? '',
                        employees: String(data.metrics?.employees ?? ''),
                        raised: String(data.metrics?.raised ?? ''),
                    },
                };
            }

            case 'enrichCombined': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const data = await cb('GET', `${CLEARBIT_PERSON_BASE}/combined/find?email=${encodeURIComponent(email)}`);
                return {
                    output: {
                        person: data.person ?? {},
                        company: data.company ?? {},
                    },
                };
            }

            case 'prospectSearch': {
                const domain = String(inputs.domain ?? '').trim();
                if (!domain) throw new Error('domain is required.');
                const body: any = { domain };
                if (inputs.role) body.role = String(inputs.role);
                if (inputs.seniority) body.seniority = String(inputs.seniority);
                if (inputs.title) body.title = String(inputs.title);
                if (inputs.city) body.city = String(inputs.city);
                if (inputs.country) body.country = String(inputs.country);
                const data = await cb('POST', `${CLEARBIT_PROSPECTOR_BASE}/people/search`, body);
                return {
                    output: {
                        results: data.results ?? [],
                        total: String(data.total ?? 0),
                        page: String(data.page ?? 1),
                    },
                };
            }

            case 'revealIp': {
                const ip = String(inputs.ip ?? '').trim();
                if (!ip) throw new Error('ip is required.');
                const data = await cb('GET', `${CLEARBIT_REVEAL_BASE}/companies/find?ip=${encodeURIComponent(ip)}`);
                return {
                    output: {
                        name: data.name ?? '',
                        domain: data.domain ?? '',
                        location: data.location ?? '',
                    },
                };
            }

            case 'lookupEmail': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const data = await cb('GET', `${CLEARBIT_RISK_BASE}/calculate?email=${encodeURIComponent(email)}`);
                return {
                    output: {
                        score: String(data.score ?? ''),
                        risk: data.risk ?? '',
                        reasons: data.reasons ?? [],
                    },
                };
            }

            case 'findLogo': {
                const domain = String(inputs.domain ?? '').trim();
                if (!domain) throw new Error('domain is required.');
                return {
                    output: {
                        logoUrl: `https://logo.clearbit.com/${domain}`,
                        domain,
                    },
                };
            }

            case 'autocomplete': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const data = await cb('GET', `${CLEARBIT_AUTOCOMPLETE_BASE}/companies/suggest?query=${encodeURIComponent(query)}`);
                return {
                    output: {
                        suggestions: Array.isArray(data) ? data : [],
                    },
                };
            }

            default:
                return { error: `Clearbit action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Clearbit action failed.' };
    }
}

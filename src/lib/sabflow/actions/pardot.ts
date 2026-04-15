'use server';

const PARDOT_BASE = 'https://pi.pardot.com/api/v5/objects';

async function pardotFetch(
    accessToken: string,
    businessUnitId: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    logger?.log(`[Pardot] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Pardot-Business-Unit-Id': businessUnitId,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${PARDOT_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        const err = data?.message ?? data?.error ?? `Pardot API error: ${res.status}`;
        throw new Error(String(err));
    }
    return data;
}

export async function executePardotAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const businessUnitId = String(inputs.businessUnitId ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        if (!businessUnitId) throw new Error('businessUnitId is required.');

        const pd = (method: string, path: string, body?: any) =>
            pardotFetch(accessToken, businessUnitId, method, path, body, logger);

        switch (actionName) {
            case 'listProspects': {
                const limit = inputs.limit ?? 200;
                const offset = inputs.offset ?? 0;
                const data = await pd('GET', `/prospects?limit=${limit}&offset=${offset}`);
                return { output: { prospects: data?.values ?? data } };
            }

            case 'getProspect': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await pd('GET', `/prospects/${id}`);
                return { output: { prospect: data } };
            }

            case 'createProspect': {
                const body = inputs.prospect ?? inputs;
                const data = await pd('POST', '/prospects', body);
                return { output: { prospect: data } };
            }

            case 'updateProspect': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const body = inputs.prospect ?? inputs;
                const data = await pd('PATCH', `/prospects/${id}`, body);
                return { output: { prospect: data } };
            }

            case 'deleteProspect': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                await pd('DELETE', `/prospects/${id}`);
                return { output: { success: true, id } };
            }

            case 'listLists': {
                const limit = inputs.limit ?? 200;
                const offset = inputs.offset ?? 0;
                const data = await pd('GET', `/lists?limit=${limit}&offset=${offset}`);
                return { output: { lists: data?.values ?? data } };
            }

            case 'getList': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await pd('GET', `/lists/${id}`);
                return { output: { list: data } };
            }

            case 'createList': {
                const body = inputs.list ?? inputs;
                const data = await pd('POST', '/lists', body);
                return { output: { list: data } };
            }

            case 'addProspectToList': {
                const body = inputs.membership ?? {
                    listId: inputs.listId,
                    prospectId: inputs.prospectId,
                };
                const data = await pd('POST', '/list-memberships', body);
                return { output: { membership: data } };
            }

            case 'listForms': {
                const limit = inputs.limit ?? 200;
                const offset = inputs.offset ?? 0;
                const data = await pd('GET', `/forms?limit=${limit}&offset=${offset}`);
                return { output: { forms: data?.values ?? data } };
            }

            case 'getForm': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await pd('GET', `/forms/${id}`);
                return { output: { form: data } };
            }

            case 'listCampaigns': {
                const limit = inputs.limit ?? 200;
                const offset = inputs.offset ?? 0;
                const data = await pd('GET', `/campaigns?limit=${limit}&offset=${offset}`);
                return { output: { campaigns: data?.values ?? data } };
            }

            case 'getCampaign': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await pd('GET', `/campaigns/${id}`);
                return { output: { campaign: data } };
            }

            case 'getStats': {
                const params = new URLSearchParams();
                if (inputs.campaignId) params.set('campaignId', String(inputs.campaignId));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await pd('GET', `/reports/email-clicks${qs}`);
                return { output: { stats: data?.values ?? data } };
            }

            case 'listEmailTemplates': {
                const limit = inputs.limit ?? 200;
                const offset = inputs.offset ?? 0;
                const data = await pd('GET', `/email-templates?limit=${limit}&offset=${offset}`);
                return { output: { emailTemplates: data?.values ?? data } };
            }

            default:
                return { error: `Unknown Pardot action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Pardot] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown Pardot error' };
    }
}

'use server';

async function wufooRequest(
    method: string,
    subdomain: string,
    path: string,
    apiKey: string,
    body?: any,
    queryParams?: Record<string, string>
): Promise<any> {
    const baseUrl = `https://${subdomain}.wufoo.com/api/v3`;
    const url = new URL(`${baseUrl}${path}`);
    if (queryParams) {
        for (const [k, v] of Object.entries(queryParams)) {
            url.searchParams.set(k, v);
        }
    }

    const credentials = Buffer.from(`${apiKey}:footastic`).toString('base64');

    const headers: Record<string, string> = {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
    };

    let fetchBody: string | undefined;
    if (body !== undefined && method !== 'GET') {
        if (typeof body === 'object') {
            fetchBody = new URLSearchParams(body).toString();
        } else {
            fetchBody = String(body);
        }
    }

    const res = await fetch(url.toString(), {
        method,
        headers,
        body: fetchBody,
    });

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }

    if (!res.ok) {
        throw new Error(data?.Text || data?.message || `HTTP ${res.status}: ${text}`);
    }

    return data;
}

export async function executeWufooAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey: string = inputs.apiKey;
        const subdomain: string = inputs.subdomain;
        if (!apiKey) throw new Error('Missing required input: apiKey');
        if (!subdomain) throw new Error('Missing required input: subdomain');

        logger.log(`Executing Wufoo action: ${actionName}`);

        switch (actionName) {
            case 'listForms': {
                const data = await wufooRequest('GET', subdomain, '/forms.json', apiKey);
                return { output: { forms: data.Forms || data } };
            }

            case 'getForm': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const data = await wufooRequest('GET', subdomain, `/forms/${inputs.formId}.json`, apiKey);
                return { output: { form: data.Forms?.[0] || data } };
            }

            case 'listFields': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const data = await wufooRequest('GET', subdomain, `/forms/${inputs.formId}/fields.json`, apiKey);
                return { output: { fields: data.Fields || data } };
            }

            case 'listEntries': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const params: Record<string, string> = {};
                if (inputs.pageStart) params['pageStart'] = String(inputs.pageStart);
                if (inputs.pageSize) params['pageSize'] = String(inputs.pageSize);
                if (inputs.sortId) params['sortId'] = String(inputs.sortId);
                if (inputs.sortDirection) params['sortDirection'] = String(inputs.sortDirection);
                const data = await wufooRequest('GET', subdomain, `/forms/${inputs.formId}/entries.json`, apiKey, undefined, params);
                return { output: { entries: data.Entries || data } };
            }

            case 'getEntry': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                if (!inputs.entryId) throw new Error('Missing required input: entryId');
                const data = await wufooRequest('GET', subdomain, `/forms/${inputs.formId}/entries/${inputs.entryId}.json`, apiKey);
                return { output: { entry: data.Entries?.[0] || data } };
            }

            case 'submitForm': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                if (!inputs.fields) throw new Error('Missing required input: fields');
                const fields = typeof inputs.fields === 'string' ? JSON.parse(inputs.fields) : inputs.fields;
                const data = await wufooRequest('POST', subdomain, `/forms/${inputs.formId}/entries.json`, apiKey, fields);
                return { output: { result: data } };
            }

            case 'countEntries': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const data = await wufooRequest('GET', subdomain, `/forms/${inputs.formId}/entries/count.json`, apiKey);
                return { output: { count: data.EntryCount || data } };
            }

            case 'listReports': {
                const data = await wufooRequest('GET', subdomain, '/reports.json', apiKey);
                return { output: { reports: data.Reports || data } };
            }

            case 'getReport': {
                if (!inputs.reportId) throw new Error('Missing required input: reportId');
                const data = await wufooRequest('GET', subdomain, `/reports/${inputs.reportId}.json`, apiKey);
                return { output: { report: data.Reports?.[0] || data } };
            }

            case 'listReportFields': {
                if (!inputs.reportId) throw new Error('Missing required input: reportId');
                const data = await wufooRequest('GET', subdomain, `/reports/${inputs.reportId}/fields.json`, apiKey);
                return { output: { fields: data.Fields || data } };
            }

            case 'listWidgets': {
                if (!inputs.reportId) throw new Error('Missing required input: reportId');
                const data = await wufooRequest('GET', subdomain, `/reports/${inputs.reportId}/widgets.json`, apiKey);
                return { output: { widgets: data.Widgets || data } };
            }

            case 'listUsers': {
                const data = await wufooRequest('GET', subdomain, '/users.json', apiKey);
                return { output: { users: data.Users || data } };
            }

            case 'getUser': {
                if (!inputs.userId) throw new Error('Missing required input: userId');
                const data = await wufooRequest('GET', subdomain, `/users/${inputs.userId}.json`, apiKey);
                return { output: { user: data.Users?.[0] || data } };
            }

            case 'getAccountDetails': {
                const data = await wufooRequest('GET', subdomain, '/me.json', apiKey);
                return { output: { account: data } };
            }

            case 'listWebhooks': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const data = await wufooRequest('GET', subdomain, `/forms/${inputs.formId}/webhooks.json`, apiKey);
                return { output: { webhooks: data.WebHooks || data } };
            }

            default:
                throw new Error(`Unknown action: ${actionName}`);
        }
    } catch (err: any) {
        logger.log(`Wufoo action error: ${err.message}`);
        return { error: err.message || 'Wufoo action failed' };
    }
}

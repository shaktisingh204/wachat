'use server';

const FORMSTACK_BASE_URL = 'https://www.formstack.com/api/v2';

async function formstackRequest(
    method: string,
    path: string,
    accessToken: string,
    body?: any,
    queryParams?: Record<string, string>
): Promise<any> {
    const url = new URL(`${FORMSTACK_BASE_URL}${path}`);
    if (queryParams) {
        for (const [k, v] of Object.entries(queryParams)) {
            url.searchParams.set(k, v);
        }
    }

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    const res = await fetch(url.toString(), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return { success: true };

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) {
        throw new Error(data?.error ?? data?.message ?? `Formstack API error ${res.status}: ${text}`);
    }
    return data;
}

export async function executeFormstackAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        if (!inputs.accessToken) return { error: 'Missing required input: accessToken' };
        const { accessToken } = inputs;
        logger.log(`Executing Formstack action: ${actionName}`);

        switch (actionName) {

            case 'listForms': {
                const params: Record<string, string> = {};
                if (inputs.page) params.page = String(inputs.page);
                if (inputs.per_page) params.per_page = String(inputs.per_page);
                if (inputs.folder_id) params.folder_id = String(inputs.folder_id);
                const data = await formstackRequest('GET', '/form.json', accessToken, undefined, params);
                return { output: { forms: data.forms ?? [], total: data.total } };
            }

            case 'getForm': {
                if (!inputs.formId) return { error: 'Missing required input: formId' };
                const data = await formstackRequest('GET', `/form/${inputs.formId}.json`, accessToken);
                return { output: { form: data } };
            }

            case 'createForm': {
                if (!inputs.name) return { error: 'Missing required input: name' };
                const body: Record<string, any> = { name: inputs.name };
                if (inputs.db !== undefined) body.db = inputs.db;
                if (inputs.template_id) body.template_id = inputs.template_id;
                if (inputs.organization) body.organization = inputs.organization;
                const data = await formstackRequest('POST', '/form.json', accessToken, body);
                return { output: { form: data } };
            }

            case 'listSubmissions': {
                if (!inputs.formId) return { error: 'Missing required input: formId' };
                const params: Record<string, string> = {};
                if (inputs.page) params.page = String(inputs.page);
                if (inputs.per_page) params.per_page = String(inputs.per_page);
                if (inputs.min_time) params.min_time = inputs.min_time;
                if (inputs.max_time) params.max_time = inputs.max_time;
                if (inputs.search_field_id) params.search_field_id = inputs.search_field_id;
                if (inputs.search_value) params.search_value = inputs.search_value;
                const data = await formstackRequest('GET', `/form/${inputs.formId}/submission.json`, accessToken, undefined, params);
                return { output: { submissions: data.submissions ?? [], total: data.total } };
            }

            case 'getSubmission': {
                if (!inputs.submissionId) return { error: 'Missing required input: submissionId' };
                const data = await formstackRequest('GET', `/submission/${inputs.submissionId}.json`, accessToken);
                return { output: { submission: data } };
            }

            case 'deleteSubmission': {
                if (!inputs.submissionId) return { error: 'Missing required input: submissionId' };
                const data = await formstackRequest('DELETE', `/submission/${inputs.submissionId}.json`, accessToken);
                return { output: { deleted: true, submissionId: inputs.submissionId, result: data } };
            }

            case 'listFields': {
                if (!inputs.formId) return { error: 'Missing required input: formId' };
                const data = await formstackRequest('GET', `/form/${inputs.formId}/field.json`, accessToken);
                return { output: { fields: data.fields ?? data ?? [] } };
            }

            case 'getField': {
                if (!inputs.fieldId) return { error: 'Missing required input: fieldId' };
                const data = await formstackRequest('GET', `/field/${inputs.fieldId}.json`, accessToken);
                return { output: { field: data } };
            }

            case 'createField': {
                if (!inputs.formId) return { error: 'Missing required input: formId' };
                if (!inputs.field_type) return { error: 'Missing required input: field_type' };
                const body: Record<string, any> = {
                    field_type: inputs.field_type,
                };
                if (inputs.label) body.label = inputs.label;
                if (inputs.required !== undefined) body.required = inputs.required;
                if (inputs.placeholder) body.placeholder = inputs.placeholder;
                if (inputs.default_value) body.default_value = inputs.default_value;
                const data = await formstackRequest('POST', `/form/${inputs.formId}/field.json`, accessToken, body);
                return { output: { field: data } };
            }

            case 'updateField': {
                if (!inputs.fieldId) return { error: 'Missing required input: fieldId' };
                const body: Record<string, any> = {};
                if (inputs.label) body.label = inputs.label;
                if (inputs.required !== undefined) body.required = inputs.required;
                if (inputs.placeholder) body.placeholder = inputs.placeholder;
                if (inputs.default_value) body.default_value = inputs.default_value;
                if (inputs.field_type) body.field_type = inputs.field_type;
                const data = await formstackRequest('PUT', `/field/${inputs.fieldId}.json`, accessToken, body);
                return { output: { field: data } };
            }

            case 'exportSubmissions': {
                if (!inputs.formId) return { error: 'Missing required input: formId' };
                const params: Record<string, string> = {};
                if (inputs.min_time) params.min_time = inputs.min_time;
                if (inputs.max_time) params.max_time = inputs.max_time;
                if (inputs.page) params.page = String(inputs.page);
                if (inputs.per_page) params.per_page = String(inputs.per_page);
                const data = await formstackRequest('GET', `/form/${inputs.formId}/submission.json`, accessToken, undefined, params);
                return { output: { submissions: data.submissions ?? [], total: data.total, pages: data.pages } };
            }

            case 'getFormAnalytics': {
                if (!inputs.formId) return { error: 'Missing required input: formId' };
                const params: Record<string, string> = {};
                if (inputs.date_start) params.date_start = inputs.date_start;
                if (inputs.date_end) params.date_end = inputs.date_end;
                const data = await formstackRequest('GET', `/form/${inputs.formId}/analytics.json`, accessToken, undefined, params);
                return { output: { analytics: data } };
            }

            case 'shareForm': {
                if (!inputs.formId) return { error: 'Missing required input: formId' };
                if (!inputs.emails) return { error: 'Missing required input: emails' };
                const body: Record<string, any> = {
                    emails: inputs.emails,
                };
                if (inputs.message) body.message = inputs.message;
                const data = await formstackRequest('POST', `/form/${inputs.formId}/share.json`, accessToken, body);
                return { output: { shared: true, result: data } };
            }

            case 'duplicateForm': {
                if (!inputs.formId) return { error: 'Missing required input: formId' };
                const body: Record<string, any> = {};
                if (inputs.name) body.name = inputs.name;
                const data = await formstackRequest('POST', `/form/${inputs.formId}/copy.json`, accessToken, body);
                return { output: { form: data } };
            }

            default:
                return { error: `Formstack action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Formstack action error [${actionName}]: ${err?.message}`);
        return { error: err?.message ?? 'Unknown Formstack error' };
    }
}

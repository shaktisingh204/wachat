'use server';

const FILLOUT_BASE_URL = 'https://api.fillout.com/v1/api';

async function filloutRequest(
    method: string,
    path: string,
    apiKey: string,
    body?: any,
    queryParams?: Record<string, string>
): Promise<any> {
    const url = new URL(`${FILLOUT_BASE_URL}${path}`);
    if (queryParams) {
        for (const [k, v] of Object.entries(queryParams)) {
            url.searchParams.set(k, v);
        }
    }

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    const res = await fetch(url.toString(), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }

    if (!res.ok) {
        throw new Error(data?.message || data?.error || `HTTP ${res.status}: ${text}`);
    }

    return data;
}

export async function executeFilloutAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey: string = inputs.apiKey;
        if (!apiKey) throw new Error('Missing required input: apiKey');

        logger.log(`Executing Fillout action: ${actionName}`);

        switch (actionName) {
            case 'listForms': {
                const data = await filloutRequest('GET', '/forms', apiKey);
                return { output: { forms: data } };
            }

            case 'getForm': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const data = await filloutRequest('GET', `/forms/${inputs.formId}`, apiKey);
                return { output: { form: data } };
            }

            case 'listSubmissions': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const params: Record<string, string> = {};
                if (inputs.page) params['page'] = String(inputs.page);
                if (inputs.limit) params['limit'] = String(inputs.limit);
                if (inputs.afterDate) params['afterDate'] = String(inputs.afterDate);
                if (inputs.beforeDate) params['beforeDate'] = String(inputs.beforeDate);
                const data = await filloutRequest('GET', `/forms/${inputs.formId}/submissions`, apiKey, undefined, params);
                return { output: { submissions: data.responses || data } };
            }

            case 'getSubmission': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                if (!inputs.submissionId) throw new Error('Missing required input: submissionId');
                const data = await filloutRequest('GET', `/forms/${inputs.formId}/submissions/${inputs.submissionId}`, apiKey);
                return { output: { submission: data } };
            }

            case 'deleteSubmission': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                if (!inputs.submissionId) throw new Error('Missing required input: submissionId');
                await filloutRequest('DELETE', `/forms/${inputs.formId}/submissions/${inputs.submissionId}`, apiKey);
                return { output: { success: true, submissionId: inputs.submissionId } };
            }

            case 'createWebhook': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                if (!inputs.url) throw new Error('Missing required input: url');
                const body: Record<string, any> = { url: inputs.url };
                if (inputs.events) body.events = typeof inputs.events === 'string' ? JSON.parse(inputs.events) : inputs.events;
                if (inputs.secret) body.secret = inputs.secret;
                const data = await filloutRequest('POST', `/forms/${inputs.formId}/webhooks`, apiKey, body);
                return { output: { webhook: data } };
            }

            case 'listWebhooks': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const data = await filloutRequest('GET', `/forms/${inputs.formId}/webhooks`, apiKey);
                return { output: { webhooks: data } };
            }

            case 'deleteWebhook': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                if (!inputs.webhookId) throw new Error('Missing required input: webhookId');
                await filloutRequest('DELETE', `/forms/${inputs.formId}/webhooks/${inputs.webhookId}`, apiKey);
                return { output: { success: true, webhookId: inputs.webhookId } };
            }

            case 'getFormAnalytics': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const data = await filloutRequest('GET', `/forms/${inputs.formId}/analytics`, apiKey);
                return { output: { analytics: data } };
            }

            case 'getFormQuestions': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const data = await filloutRequest('GET', `/forms/${inputs.formId}/questions`, apiKey);
                return { output: { questions: data } };
            }

            case 'createForm': {
                if (!inputs.name) throw new Error('Missing required input: name');
                const body: Record<string, any> = { name: inputs.name };
                if (inputs.description) body.description = inputs.description;
                const data = await filloutRequest('POST', '/forms', apiKey, body);
                return { output: { form: data } };
            }

            case 'updateForm': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const body: Record<string, any> = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description) body.description = inputs.description;
                const data = await filloutRequest('PATCH', `/forms/${inputs.formId}`, apiKey, body);
                return { output: { form: data } };
            }

            case 'duplicateForm': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const data = await filloutRequest('POST', `/forms/${inputs.formId}/duplicate`, apiKey, {});
                return { output: { form: data } };
            }

            case 'listResponses': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const params: Record<string, string> = {};
                if (inputs.page) params['page'] = String(inputs.page);
                if (inputs.limit) params['limit'] = String(inputs.limit);
                if (inputs.status) params['status'] = String(inputs.status);
                const data = await filloutRequest('GET', `/forms/${inputs.formId}/submissions`, apiKey, undefined, params);
                return { output: { responses: data.responses || data } };
            }

            case 'exportSubmissions': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const params: Record<string, string> = {};
                if (inputs.format) params['format'] = String(inputs.format);
                if (inputs.afterDate) params['afterDate'] = String(inputs.afterDate);
                if (inputs.beforeDate) params['beforeDate'] = String(inputs.beforeDate);
                const data = await filloutRequest('GET', `/forms/${inputs.formId}/submissions/export`, apiKey, undefined, params);
                return { output: { export: data } };
            }

            default:
                throw new Error(`Unknown action: ${actionName}`);
        }
    } catch (err: any) {
        logger.log(`Fillout action error: ${err.message}`);
        return { error: err.message || 'Fillout action failed' };
    }
}

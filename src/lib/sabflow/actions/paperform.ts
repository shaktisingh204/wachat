'use server';

const PAPERFORM_BASE_URL = 'https://api.paperform.co';

async function paperformRequest(
    method: string,
    path: string,
    apiKey: string,
    body?: any,
    queryParams?: Record<string, string>
): Promise<any> {
    const url = new URL(`${PAPERFORM_BASE_URL}${path}`);
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
        throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}: ${text}`);
    }

    return data;
}

export async function executePaperformAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey: string = inputs.apiKey;
        if (!apiKey) throw new Error('Missing required input: apiKey');

        logger.log(`Executing Paperform action: ${actionName}`);

        switch (actionName) {
            case 'listForms': {
                const params: Record<string, string> = {};
                if (inputs.page) params['page'] = String(inputs.page);
                if (inputs.limit) params['limit'] = String(inputs.limit);
                const data = await paperformRequest('GET', '/api/v1/forms', apiKey, undefined, params);
                return { output: { forms: data.results || data } };
            }

            case 'getForm': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const data = await paperformRequest('GET', `/api/v1/forms/${inputs.formId}`, apiKey);
                return { output: { form: data.results || data } };
            }

            case 'createForm': {
                if (!inputs.title) throw new Error('Missing required input: title');
                const body: Record<string, any> = { title: inputs.title };
                if (inputs.slug) body.slug = inputs.slug;
                if (inputs.description) body.description = inputs.description;
                const data = await paperformRequest('POST', '/api/v1/forms', apiKey, body);
                return { output: { form: data.results || data } };
            }

            case 'updateForm': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const body: Record<string, any> = {};
                if (inputs.title) body.title = inputs.title;
                if (inputs.description) body.description = inputs.description;
                if (inputs.slug) body.slug = inputs.slug;
                const data = await paperformRequest('PATCH', `/api/v1/forms/${inputs.formId}`, apiKey, body);
                return { output: { form: data.results || data } };
            }

            case 'deleteForm': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                await paperformRequest('DELETE', `/api/v1/forms/${inputs.formId}`, apiKey);
                return { output: { success: true, formId: inputs.formId } };
            }

            case 'listSubmissions': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const params: Record<string, string> = {};
                if (inputs.page) params['page'] = String(inputs.page);
                if (inputs.limit) params['limit'] = String(inputs.limit);
                const data = await paperformRequest('GET', `/api/v1/submissions/${inputs.formId}`, apiKey, undefined, params);
                return { output: { submissions: data.results || data } };
            }

            case 'getSubmission': {
                if (!inputs.submissionId) throw new Error('Missing required input: submissionId');
                const data = await paperformRequest('GET', `/api/v1/submissions/${inputs.submissionId}`, apiKey);
                return { output: { submission: data.results || data } };
            }

            case 'searchSubmissions': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const params: Record<string, string> = {};
                if (inputs.search) params['search'] = String(inputs.search);
                if (inputs.page) params['page'] = String(inputs.page);
                if (inputs.limit) params['limit'] = String(inputs.limit);
                const data = await paperformRequest('GET', `/api/v1/submissions/${inputs.formId}`, apiKey, undefined, params);
                return { output: { submissions: data.results || data } };
            }

            case 'deleteSubmission': {
                if (!inputs.submissionId) throw new Error('Missing required input: submissionId');
                await paperformRequest('DELETE', `/api/v1/submissions/${inputs.submissionId}`, apiKey);
                return { output: { success: true, submissionId: inputs.submissionId } };
            }

            case 'listProducts': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const data = await paperformRequest('GET', `/api/v1/forms/${inputs.formId}/products`, apiKey);
                return { output: { products: data.results || data } };
            }

            case 'getProduct': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                if (!inputs.productId) throw new Error('Missing required input: productId');
                const data = await paperformRequest('GET', `/api/v1/forms/${inputs.formId}/products/${inputs.productId}`, apiKey);
                return { output: { product: data.results || data } };
            }

            case 'getFormAnalytics': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const data = await paperformRequest('GET', `/api/v1/forms/${inputs.formId}/analytics`, apiKey);
                return { output: { analytics: data.results || data } };
            }

            case 'listWorkflows': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const data = await paperformRequest('GET', `/api/v1/forms/${inputs.formId}/workflows`, apiKey);
                return { output: { workflows: data.results || data } };
            }

            case 'createWebhook': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                if (!inputs.url) throw new Error('Missing required input: url');
                const body: Record<string, any> = { url: inputs.url };
                if (inputs.event) body.event = inputs.event;
                if (inputs.secret) body.secret = inputs.secret;
                const data = await paperformRequest('POST', `/api/v1/forms/${inputs.formId}/webhooks`, apiKey, body);
                return { output: { webhook: data.results || data } };
            }

            case 'listWebhooks': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const data = await paperformRequest('GET', `/api/v1/forms/${inputs.formId}/webhooks`, apiKey);
                return { output: { webhooks: data.results || data } };
            }

            default:
                throw new Error(`Unknown action: ${actionName}`);
        }
    } catch (err: any) {
        logger.log(`Paperform action error: ${err.message}`);
        return { error: err.message || 'Paperform action failed' };
    }
}

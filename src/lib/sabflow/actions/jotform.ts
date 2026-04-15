
'use server';

const JOTFORM_BASE = 'https://api.jotform.com';

async function jotformRequest(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    apiKey: string,
    body?: Record<string, string>,
    queryParams?: Record<string, string | number | undefined>
): Promise<any> {
    const extraParams: Record<string, string | number | undefined> = {
        apiKey,
        ...queryParams,
    };

    const filtered = Object.entries(extraParams).filter(
        ([, v]) => v !== undefined && v !== null && v !== ''
    );
    const qs = filtered.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');

    const url = `${JOTFORM_BASE}${path}${qs ? '?' + qs : ''}`;

    const fetchOptions: RequestInit = {
        method,
        headers: {},
    };

    if (body && method === 'POST') {
        (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/x-www-form-urlencoded';
        fetchOptions.body = Object.entries(body)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
            .join('&');
    }

    const res = await fetch(url, fetchOptions);

    if (!res.ok) {
        let errMsg = `JotForm API error ${res.status}`;
        try {
            const errBody = await res.json();
            errMsg = errBody.message || JSON.stringify(errBody) || errMsg;
        } catch {
            errMsg = (await res.text()) || errMsg;
        }
        throw new Error(errMsg);
    }

    return res.json();
}

export async function executeJotformAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        switch (actionName) {
            case 'getForms': {
                const params: Record<string, string | number | undefined> = {
                    offset: inputs.offset ?? 0,
                    limit: inputs.limit ?? 20,
                    orderby: inputs.orderby ?? 'id',
                };
                const data = await jotformRequest('GET', '/user/forms', apiKey, undefined, params);
                const forms = (data.content ?? []).map((f: any) => ({
                    id: f.id,
                    title: f.title,
                    url: f.url,
                    created_at: f.created_at,
                    count: f.count,
                }));
                return { output: { content: forms } };
            }

            case 'getForm': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                const data = await jotformRequest('GET', `/form/${formId}`, apiKey);
                const c = data.content ?? {};
                return {
                    output: {
                        content: {
                            id: c.id,
                            title: c.title,
                            created_at: c.created_at,
                            updated_at: c.updated_at,
                            count: c.count,
                            new: c.new,
                            status: c.status,
                        },
                    },
                };
            }

            case 'getFormQuestions': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                const data = await jotformRequest('GET', `/form/${formId}/questions`, apiKey);
                return { output: { content: data.content ?? {} } };
            }

            case 'getFormSubmissions': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                const params: Record<string, string | number | undefined> = {
                    offset: inputs.offset ?? 0,
                    limit: inputs.limit ?? 20,
                    filter: encodeURIComponent(JSON.stringify(inputs.filter ?? {})),
                    orderby: inputs.orderby ?? 'created_at',
                };
                const data = await jotformRequest('GET', `/form/${formId}/submissions`, apiKey, undefined, params);
                return { output: { content: data.content ?? [] } };
            }

            case 'getSubmission': {
                const submissionId = String(inputs.submissionId ?? '').trim();
                if (!submissionId) throw new Error('submissionId is required.');
                const data = await jotformRequest('GET', `/submission/${submissionId}`, apiKey);
                return { output: { content: data.content ?? {} } };
            }

            case 'createFormSubmission': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                const submission = inputs.submission;
                if (!submission || typeof submission !== 'object') throw new Error('submission (object) is required.');
                // Convert submission fields to URL-encoded form fields (submission[fieldId]=value)
                const formBody: Record<string, string> = {};
                for (const [k, v] of Object.entries(submission)) {
                    formBody[`submission[${k}]`] = String(v);
                }
                const data = await jotformRequest('POST', `/form/${formId}/submissions`, apiKey, formBody);
                logger.log(`[JotForm] Created submission for form ${formId}`);
                return { output: { content: data.content ?? {} } };
            }

            case 'deleteSubmission': {
                const submissionId = String(inputs.submissionId ?? '').trim();
                if (!submissionId) throw new Error('submissionId is required.');
                const data = await jotformRequest('DELETE', `/submission/${submissionId}`, apiKey);
                logger.log(`[JotForm] Deleted submission ${submissionId}`);
                return { output: { content: data.content ?? {} } };
            }

            case 'getUser': {
                const data = await jotformRequest('GET', '/user', apiKey);
                const c = data.content ?? {};
                return {
                    output: {
                        content: {
                            username: c.username,
                            email: c.email,
                            name: c.name,
                            plan: c.plan,
                            usage: c.usage ?? {},
                        },
                    },
                };
            }

            case 'getUserUsage': {
                const data = await jotformRequest('GET', '/user/usage', apiKey);
                const c = data.content ?? {};
                return {
                    output: {
                        content: {
                            submissions: c.submissions,
                            subCount: c.subCount,
                            views: c.views,
                            payments: c.payments,
                        },
                    },
                };
            }

            case 'getFormFiles': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                const data = await jotformRequest('GET', `/form/${formId}/files`, apiKey);
                const files = (data.content ?? []).map((f: any) => ({
                    fileName: f.fileName ?? f.file_name,
                    fileUrl: f.fileUrl ?? f.file_url,
                }));
                return { output: { content: files } };
            }

            case 'listWebhooks': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                const data = await jotformRequest('GET', `/form/${formId}/webhooks`, apiKey);
                return { output: { content: data.content ?? {} } };
            }

            case 'createWebhook': {
                const formId = String(inputs.formId ?? '').trim();
                const webhookUrl = String(inputs.webhookUrl ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                if (!webhookUrl) throw new Error('webhookUrl is required.');
                const data = await jotformRequest(
                    'POST',
                    `/form/${formId}/webhooks`,
                    apiKey,
                    { webhookURL: webhookUrl }
                );
                logger.log(`[JotForm] Created webhook for form ${formId}`);
                return { output: { content: data.content ?? {} } };
            }

            case 'deleteWebhook': {
                const formId = String(inputs.formId ?? '').trim();
                const webhookId = String(inputs.webhookId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                if (!webhookId) throw new Error('webhookId is required.');
                const data = await jotformRequest('DELETE', `/form/${formId}/webhooks/${webhookId}`, apiKey);
                logger.log(`[JotForm] Deleted webhook ${webhookId} for form ${formId}`);
                return { output: { content: data.content ?? {} } };
            }

            default:
                return { error: `JotForm action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        logger.log(`[JotForm] Error in action "${actionName}": ${e.message}`);
        return { error: e.message || 'JotForm action failed.' };
    }
}

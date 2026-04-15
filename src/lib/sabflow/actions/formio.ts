
'use server';

async function formioFetch(
    projectUrl: string,
    apiKey: string | undefined,
    jwt: string | undefined,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const base = projectUrl.replace(/\/$/, '');
    const url = `${base}${path}`;
    logger?.log(`[FormIo] ${method} ${path}`);

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };

    if (jwt) {
        headers['Authorization'] = `Bearer ${jwt}`;
    } else if (apiKey) {
        headers['x-token'] = apiKey;
    }

    const options: RequestInit = { method, headers };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);

    if (res.status === 204) return { deleted: true };

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Form.io API error: ${res.status}`);
    }

    return data;
}

export async function executeFormIoAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const projectUrl = String(inputs.projectUrl ?? '').trim();
        if (!projectUrl) throw new Error('projectUrl is required (e.g. https://yourproject.form.io).');

        const apiKey = inputs.apiKey ? String(inputs.apiKey).trim() : undefined;
        const jwt = inputs.jwt ? String(inputs.jwt).trim() : undefined;

        if (!apiKey && !jwt) throw new Error('Either apiKey or jwt is required.');

        const ff = (method: string, path: string, body?: any) =>
            formioFetch(projectUrl, apiKey, jwt, method, path, body, logger);

        switch (actionName) {
            case 'listForms': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.skip) params.set('skip', String(inputs.skip));
                const qs = params.toString();
                const data = await ff('GET', `/form${qs ? `?${qs}` : ''}`);
                return { output: { forms: data } };
            }

            case 'getForm': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                const data = await ff('GET', `/form/${formId}`);
                return { output: { form: data } };
            }

            case 'createForm': {
                const title = String(inputs.title ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                const path = String(inputs.path ?? '').trim();
                if (!title) throw new Error('title is required.');
                if (!name) throw new Error('name is required.');
                if (!path) throw new Error('path is required.');
                const payload: any = { title, name, path, type: inputs.type ?? 'form' };
                if (inputs.components) payload.components = inputs.components;
                const data = await ff('POST', '/form', payload);
                logger.log(`[FormIo] Form created: ${data._id}`);
                return { output: { form: data } };
            }

            case 'updateForm': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                const payload: any = {};
                if (inputs.title) payload.title = String(inputs.title);
                if (inputs.components) payload.components = inputs.components;
                if (inputs.display) payload.display = String(inputs.display);
                const data = await ff('PUT', `/form/${formId}`, payload);
                return { output: { form: data } };
            }

            case 'deleteForm': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                await ff('DELETE', `/form/${formId}`);
                logger.log(`[FormIo] Form deleted: ${formId}`);
                return { output: { deleted: true } };
            }

            case 'listSubmissions': {
                const formPath = String(inputs.formPath ?? '').trim();
                if (!formPath) throw new Error('formPath is required.');
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.skip) params.set('skip', String(inputs.skip));
                const qs = params.toString();
                const data = await ff('GET', `/${formPath}/submission${qs ? `?${qs}` : ''}`);
                return { output: { submissions: data } };
            }

            case 'getSubmission': {
                const formPath = String(inputs.formPath ?? '').trim();
                const submissionId = String(inputs.submissionId ?? '').trim();
                if (!formPath) throw new Error('formPath is required.');
                if (!submissionId) throw new Error('submissionId is required.');
                const data = await ff('GET', `/${formPath}/submission/${submissionId}`);
                return { output: { submission: data } };
            }

            case 'createSubmission': {
                const formPath = String(inputs.formPath ?? '').trim();
                if (!formPath) throw new Error('formPath is required.');
                const submissionData = inputs.data ?? {};
                const data = await ff('POST', `/${formPath}/submission`, { data: submissionData });
                logger.log(`[FormIo] Submission created: ${data._id}`);
                return { output: { submission: data } };
            }

            case 'updateSubmission': {
                const formPath = String(inputs.formPath ?? '').trim();
                const submissionId = String(inputs.submissionId ?? '').trim();
                if (!formPath) throw new Error('formPath is required.');
                if (!submissionId) throw new Error('submissionId is required.');
                const submissionData = inputs.data ?? {};
                const data = await ff('PUT', `/${formPath}/submission/${submissionId}`, { data: submissionData });
                return { output: { submission: data } };
            }

            case 'deleteSubmission': {
                const formPath = String(inputs.formPath ?? '').trim();
                const submissionId = String(inputs.submissionId ?? '').trim();
                if (!formPath) throw new Error('formPath is required.');
                if (!submissionId) throw new Error('submissionId is required.');
                await ff('DELETE', `/${formPath}/submission/${submissionId}`);
                logger.log(`[FormIo] Submission deleted: ${submissionId}`);
                return { output: { deleted: true } };
            }

            case 'listActions': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                const data = await ff('GET', `/form/${formId}/action`);
                return { output: { actions: data } };
            }

            case 'createAction': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                const actionData = inputs.actionData ?? {};
                const data = await ff('POST', `/form/${formId}/action`, actionData);
                logger.log(`[FormIo] Action created: ${data._id}`);
                return { output: { action: data } };
            }

            case 'getRoles': {
                const data = await ff('GET', '/role');
                return { output: { roles: data } };
            }

            case 'getProject': {
                const data = await ff('GET', '/project');
                return { output: { project: data } };
            }

            case 'updateProject': {
                const payload: any = {};
                if (inputs.title) payload.title = String(inputs.title);
                if (inputs.description) payload.description = String(inputs.description);
                if (inputs.settings) payload.settings = inputs.settings;
                const data = await ff('PUT', '/project', payload);
                return { output: { project: data } };
            }

            default:
                return { error: `Form.io action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Form.io action failed.' };
    }
}

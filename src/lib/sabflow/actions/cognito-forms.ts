'use server';

const COGNITO_FORMS_BASE_URL = 'https://services.cognitoforms.com/v1';

async function cognitoFormsRequest(
    method: string,
    path: string,
    apiKey: string,
    body?: any,
    queryParams?: Record<string, string>
): Promise<any> {
    const url = new URL(`${COGNITO_FORMS_BASE_URL}${path}`);
    if (queryParams) {
        for (const [k, v] of Object.entries(queryParams)) {
            url.searchParams.set(k, v);
        }
    }

    const headers: Record<string, string> = {
        'Authorization': `APIKey ${apiKey}`,
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

export async function executeCognitoFormsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey: string = inputs.apiKey;
        if (!apiKey) throw new Error('Missing required input: apiKey');

        logger.log(`Executing CognitoForms action: ${actionName}`);

        switch (actionName) {
            case 'listForms': {
                const data = await cognitoFormsRequest('GET', '/forms', apiKey);
                return { output: { forms: data } };
            }

            case 'getForm': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const data = await cognitoFormsRequest('GET', `/forms/${inputs.formId}`, apiKey);
                return { output: { form: data } };
            }

            case 'listEntries': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const params: Record<string, string> = {};
                if (inputs.page) params['page'] = String(inputs.page);
                if (inputs.pageSize) params['pageSize'] = String(inputs.pageSize);
                const data = await cognitoFormsRequest('GET', `/forms/${inputs.formId}/entries`, apiKey, undefined, params);
                return { output: { entries: data } };
            }

            case 'getEntry': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                if (!inputs.entryId) throw new Error('Missing required input: entryId');
                const data = await cognitoFormsRequest('GET', `/forms/${inputs.formId}/entries/${inputs.entryId}`, apiKey);
                return { output: { entry: data } };
            }

            case 'createEntry': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                if (!inputs.entryData) throw new Error('Missing required input: entryData');
                const entryData = typeof inputs.entryData === 'string' ? JSON.parse(inputs.entryData) : inputs.entryData;
                const data = await cognitoFormsRequest('POST', `/forms/${inputs.formId}/entries`, apiKey, entryData);
                return { output: { entry: data } };
            }

            case 'updateEntry': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                if (!inputs.entryId) throw new Error('Missing required input: entryId');
                if (!inputs.entryData) throw new Error('Missing required input: entryData');
                const entryData = typeof inputs.entryData === 'string' ? JSON.parse(inputs.entryData) : inputs.entryData;
                const data = await cognitoFormsRequest('PUT', `/forms/${inputs.formId}/entries/${inputs.entryId}`, apiKey, entryData);
                return { output: { entry: data } };
            }

            case 'deleteEntry': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                if (!inputs.entryId) throw new Error('Missing required input: entryId');
                await cognitoFormsRequest('DELETE', `/forms/${inputs.formId}/entries/${inputs.entryId}`, apiKey);
                return { output: { success: true, entryId: inputs.entryId } };
            }

            case 'searchEntries': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const params: Record<string, string> = {};
                if (inputs.search) params['search'] = String(inputs.search);
                if (inputs.page) params['page'] = String(inputs.page);
                if (inputs.pageSize) params['pageSize'] = String(inputs.pageSize);
                const data = await cognitoFormsRequest('GET', `/forms/${inputs.formId}/entries`, apiKey, undefined, params);
                return { output: { entries: data } };
            }

            case 'listOrganizations': {
                const data = await cognitoFormsRequest('GET', '/organizations', apiKey);
                return { output: { organizations: data } };
            }

            case 'getOrganization': {
                if (!inputs.organizationId) throw new Error('Missing required input: organizationId');
                const data = await cognitoFormsRequest('GET', `/organizations/${inputs.organizationId}`, apiKey);
                return { output: { organization: data } };
            }

            case 'exportEntries': {
                if (!inputs.formId) throw new Error('Missing required input: formId');
                const params: Record<string, string> = {};
                if (inputs.format) params['format'] = String(inputs.format);
                if (inputs.startDate) params['startDate'] = String(inputs.startDate);
                if (inputs.endDate) params['endDate'] = String(inputs.endDate);
                const data = await cognitoFormsRequest('GET', `/forms/${inputs.formId}/entries/export`, apiKey, undefined, params);
                return { output: { export: data } };
            }

            case 'listDesigns': {
                const data = await cognitoFormsRequest('GET', '/designs', apiKey);
                return { output: { designs: data } };
            }

            case 'getDesign': {
                if (!inputs.designId) throw new Error('Missing required input: designId');
                const data = await cognitoFormsRequest('GET', `/designs/${inputs.designId}`, apiKey);
                return { output: { design: data } };
            }

            case 'listUsers': {
                const data = await cognitoFormsRequest('GET', '/users', apiKey);
                return { output: { users: data } };
            }

            case 'getUser': {
                if (!inputs.userId) throw new Error('Missing required input: userId');
                const data = await cognitoFormsRequest('GET', `/users/${inputs.userId}`, apiKey);
                return { output: { user: data } };
            }

            default:
                throw new Error(`Unknown action: ${actionName}`);
        }
    } catch (err: any) {
        logger.log(`CognitoForms action error: ${err.message}`);
        return { error: err.message || 'CognitoForms action failed' };
    }
}

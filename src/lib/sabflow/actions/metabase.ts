'use server';

async function getMetabaseSession(serverUrl: string, username: string, password: string): Promise<string> {
    const res = await fetch(`${serverUrl}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
        throw new Error(data?.message ?? `Metabase session error ${res.status}: ${text}`);
    }
    return data.id;
}

async function metabaseRequest(
    method: string,
    path: string,
    serverUrl: string,
    sessionToken: string,
    body?: any
): Promise<any> {
    const url = `${serverUrl}${path}`;
    const headers: Record<string, string> = {
        'X-Metabase-Session': sessionToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) {
        throw new Error(data?.message ?? data?.error ?? `Metabase API error ${res.status}: ${text}`);
    }
    return data;
}

async function resolveSession(inputs: any): Promise<{ serverUrl: string; sessionToken: string }> {
    const serverUrl = (inputs.serverUrl as string)?.replace(/\/$/, '');
    if (!serverUrl) throw new Error('Missing required input: serverUrl');

    if (inputs.sessionToken) {
        return { serverUrl, sessionToken: inputs.sessionToken };
    }
    if (!inputs.username) throw new Error('Missing required input: username');
    if (!inputs.password) throw new Error('Missing required input: password');
    const sessionToken = await getMetabaseSession(serverUrl, inputs.username, inputs.password);
    return { serverUrl, sessionToken };
}

export async function executeMetabaseAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output: any } | { error: string }> {
    try {
        logger.log(`Executing Metabase action: ${actionName}`);

        switch (actionName) {

            case 'getSessionToken': {
                const serverUrl = (inputs.serverUrl as string)?.replace(/\/$/, '');
                if (!serverUrl) return { error: 'Missing required input: serverUrl' };
                if (!inputs.username) return { error: 'Missing required input: username' };
                if (!inputs.password) return { error: 'Missing required input: password' };
                const id = await getMetabaseSession(serverUrl, inputs.username, inputs.password);
                return { output: { sessionToken: id, id } };
            }

            case 'listDatabases': {
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                const data = await metabaseRequest('GET', '/api/database', serverUrl, sessionToken);
                const databases = data?.data ?? data ?? [];
                return { output: { databases } };
            }

            case 'getDatabase': {
                if (!inputs.databaseId) return { error: 'Missing required input: databaseId' };
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                const data = await metabaseRequest('GET', `/api/database/${inputs.databaseId}`, serverUrl, sessionToken);
                return { output: { database: data } };
            }

            case 'listCollections': {
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                const data = await metabaseRequest('GET', '/api/collection', serverUrl, sessionToken);
                const collections = Array.isArray(data) ? data : (data?.data ?? []);
                return { output: { collections } };
            }

            case 'listQuestions': {
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                const params = new URLSearchParams();
                if (inputs.collectionId) params.set('collection', String(inputs.collectionId));
                if (inputs.f) params.set('f', inputs.f);
                const path = params.toString() ? `/api/card?${params.toString()}` : '/api/card';
                const data = await metabaseRequest('GET', path, serverUrl, sessionToken);
                const questions = Array.isArray(data) ? data : (data?.data ?? []);
                return { output: { questions } };
            }

            case 'getQuestion': {
                if (!inputs.questionId) return { error: 'Missing required input: questionId' };
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                const data = await metabaseRequest('GET', `/api/card/${inputs.questionId}`, serverUrl, sessionToken);
                return { output: { question: data } };
            }

            case 'createQuestion': {
                if (!inputs.name) return { error: 'Missing required input: name' };
                if (!inputs.databaseId) return { error: 'Missing required input: databaseId' };
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                const body: any = {
                    name: inputs.name,
                    dataset_query: inputs.datasetQuery ?? {
                        database: inputs.databaseId,
                        type: 'native',
                        native: { query: inputs.sql ?? '', template_tags: {} },
                    },
                    display: inputs.display ?? 'table',
                    visualization_settings: inputs.visualizationSettings ?? {},
                };
                if (inputs.collectionId) body.collection_id = inputs.collectionId;
                if (inputs.description) body.description = inputs.description;
                const data = await metabaseRequest('POST', '/api/card', serverUrl, sessionToken, body);
                return { output: { question: data } };
            }

            case 'updateQuestion': {
                if (!inputs.questionId) return { error: 'Missing required input: questionId' };
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.display) body.display = inputs.display;
                if (inputs.datasetQuery) body.dataset_query = inputs.datasetQuery;
                if (inputs.visualizationSettings) body.visualization_settings = inputs.visualizationSettings;
                const data = await metabaseRequest('PUT', `/api/card/${inputs.questionId}`, serverUrl, sessionToken, body);
                return { output: { question: data } };
            }

            case 'deleteQuestion': {
                if (!inputs.questionId) return { error: 'Missing required input: questionId' };
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                await metabaseRequest('DELETE', `/api/card/${inputs.questionId}`, serverUrl, sessionToken);
                return { output: { success: true, questionId: inputs.questionId } };
            }

            case 'listCards': {
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                const collectionId = inputs.collectionId ?? '';
                const path = collectionId ? `/api/card?collection=${collectionId}` : '/api/card';
                const data = await metabaseRequest('GET', path, serverUrl, sessionToken);
                const cards = Array.isArray(data) ? data : (data?.data ?? []);
                return { output: { cards } };
            }

            case 'getCard': {
                if (!inputs.cardId) return { error: 'Missing required input: cardId' };
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                const data = await metabaseRequest('GET', `/api/card/${inputs.cardId}`, serverUrl, sessionToken);
                return { output: { card: data } };
            }

            case 'runCard': {
                if (!inputs.cardId) return { error: 'Missing required input: cardId' };
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                const body = { parameters: inputs.parameters ?? [] };
                const data = await metabaseRequest('POST', `/api/card/${inputs.cardId}/query`, serverUrl, sessionToken, body);
                return { output: { result: data } };
            }

            case 'runQuery': {
                if (!inputs.databaseId) return { error: 'Missing required input: databaseId' };
                if (!inputs.sql) return { error: 'Missing required input: sql' };
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                const body = {
                    database: inputs.databaseId,
                    type: 'native',
                    native: { query: inputs.sql, template_tags: {} },
                    parameters: inputs.nativeParameters ?? [],
                };
                const data = await metabaseRequest('POST', '/api/dataset', serverUrl, sessionToken, body);
                return { output: { result: data } };
            }

            case 'listDashboards': {
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                const data = await metabaseRequest('GET', '/api/dashboard?f=all', serverUrl, sessionToken);
                const dashboards = Array.isArray(data) ? data : (data?.data ?? []);
                return { output: { dashboards } };
            }

            case 'getDashboard': {
                if (!inputs.dashboardId) return { error: 'Missing required input: dashboardId' };
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                const data = await metabaseRequest('GET', `/api/dashboard/${inputs.dashboardId}`, serverUrl, sessionToken);
                return { output: { dashboard: data } };
            }

            case 'createDashboard': {
                if (!inputs.name) return { error: 'Missing required input: name' };
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                const body: any = { name: inputs.name };
                if (inputs.description) body.description = inputs.description;
                if (inputs.collectionId) body.collection_id = inputs.collectionId;
                if (inputs.parameters) body.parameters = inputs.parameters;
                const data = await metabaseRequest('POST', '/api/dashboard', serverUrl, sessionToken, body);
                return { output: { dashboard: data } };
            }

            case 'updateDashboard': {
                if (!inputs.dashboardId) return { error: 'Missing required input: dashboardId' };
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.parameters !== undefined) body.parameters = inputs.parameters;
                if (inputs.archived !== undefined) body.archived = inputs.archived;
                const data = await metabaseRequest('PUT', `/api/dashboard/${inputs.dashboardId}`, serverUrl, sessionToken, body);
                return { output: { dashboard: data } };
            }

            case 'getMetrics': {
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                const params = new URLSearchParams();
                if (inputs.tableId) params.set('table', String(inputs.tableId));
                const path = params.toString() ? `/api/metric?${params.toString()}` : '/api/metric';
                const data = await metabaseRequest('GET', path, serverUrl, sessionToken);
                const metrics = Array.isArray(data) ? data : (data?.data ?? []);
                return { output: { metrics } };
            }

            case 'listUsers': {
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                const data = await metabaseRequest('GET', '/api/user', serverUrl, sessionToken);
                const users = data?.data ?? (Array.isArray(data) ? data : []);
                return { output: { users } };
            }

            case 'createUser': {
                if (!inputs.email) return { error: 'Missing required input: email' };
                if (!inputs.firstName) return { error: 'Missing required input: firstName' };
                if (!inputs.lastName) return { error: 'Missing required input: lastName' };
                const { serverUrl, sessionToken } = await resolveSession(inputs);
                const body = {
                    email: inputs.email,
                    first_name: inputs.firstName,
                    last_name: inputs.lastName,
                    is_superuser: inputs.isSuperuser ?? false,
                };
                const data = await metabaseRequest('POST', '/api/user', serverUrl, sessionToken, body);
                return { output: { user: data } };
            }

            default:
                return { error: `Metabase action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Metabase action error [${actionName}]: ${err?.message}`);
        return { error: err?.message ?? 'Unknown Metabase error' };
    }
}

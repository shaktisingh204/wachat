
'use server';

async function gotifyFetch(
    serverUrl: string,
    method: string,
    path: string,
    authHeader: string,
    body?: any,
    logger?: any
): Promise<any> {
    const base = String(serverUrl).replace(/\/$/, '');
    const url = `${base}${path}`;
    logger?.log(`[Gotify] ${method} ${path}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
        },
    };
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
        throw new Error(data?.errorDescription || data?.error || `Gotify API error: ${res.status}`);
    }
    return data;
}

export async function executeGotifyAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').trim();
        if (!serverUrl) throw new Error('serverUrl is required.');

        const appToken = String(inputs.appToken ?? '').trim();
        const clientToken = String(inputs.clientToken ?? '').trim();

        // Helper factories for each auth type
        const withApp = (method: string, path: string, body?: any) => {
            if (!appToken) throw new Error('appToken is required for this action.');
            return gotifyFetch(serverUrl, method, path, `Bearer ${appToken}`, body, logger);
        };

        const withClient = (method: string, path: string, body?: any) => {
            if (!clientToken) throw new Error('clientToken is required for this action.');
            return gotifyFetch(serverUrl, method, path, `Bearer ${clientToken}`, body, logger);
        };

        const withAdmin = (method: string, path: string, body?: any) => {
            // Admin operations reuse the clientToken supplied with admin privileges
            if (!clientToken) throw new Error('clientToken (admin) is required for this action.');
            return gotifyFetch(serverUrl, method, path, `Bearer ${clientToken}`, body, logger);
        };

        switch (actionName) {
            case 'sendMessage': {
                const title = String(inputs.title ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                if (!title) throw new Error('title is required.');
                if (!message) throw new Error('message is required.');

                const payload: any = { title, message };
                if (inputs.priority !== undefined && inputs.priority !== '')
                    payload.priority = Number(inputs.priority);

                const data = await withApp('POST', '/message', payload);
                logger.log(`[Gotify] Message sent: ${data.id}`);
                return { output: { id: data.id, title: data.title, message: data.message, priority: data.priority } };
            }

            case 'listMessages': {
                const params = new URLSearchParams();
                if (inputs.limit !== undefined && inputs.limit !== '')
                    params.set('limit', String(inputs.limit));
                if (inputs.since !== undefined && inputs.since !== '')
                    params.set('since', String(inputs.since));

                const qs = params.toString();
                const data = await withClient('GET', `/message${qs ? `?${qs}` : ''}`);
                return { output: { messages: data.messages ?? [], paging: data.paging ?? {} } };
            }

            case 'deleteMessage': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required.');

                await withClient('DELETE', `/message/${messageId}`);
                logger.log(`[Gotify] Message deleted: ${messageId}`);
                return { output: { deleted: true } };
            }

            case 'deleteAllMessages': {
                await withClient('DELETE', '/message');
                logger.log('[Gotify] All messages deleted');
                return { output: { deleted: true } };
            }

            case 'listApplications': {
                const data = await withClient('GET', '/application');
                return { output: { apps: Array.isArray(data) ? data : [] } };
            }

            case 'createApplication': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');

                const payload: any = { name };
                if (inputs.description) payload.description = String(inputs.description);

                const data = await withClient('POST', '/application', payload);
                logger.log(`[Gotify] Application created: ${data.id}`);
                return { output: { id: data.id, name: data.name, token: data.token } };
            }

            case 'deleteApplication': {
                const appId = String(inputs.appId ?? '').trim();
                if (!appId) throw new Error('appId is required.');

                await withClient('DELETE', `/application/${appId}`);
                logger.log(`[Gotify] Application deleted: ${appId}`);
                return { output: { deleted: true } };
            }

            case 'listClients': {
                const data = await withClient('GET', '/client');
                return { output: { clients: Array.isArray(data) ? data : [] } };
            }

            case 'createClient': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');

                const data = await withClient('POST', '/client', { name });
                logger.log(`[Gotify] Client created: ${data.id}`);
                return { output: { id: data.id, name: data.name, token: data.token } };
            }

            case 'getHealth': {
                // Health endpoint needs no auth
                const base = String(serverUrl).replace(/\/$/, '');
                const res = await fetch(`${base}/health`);
                const text = await res.text();
                let data: any;
                try { data = JSON.parse(text); } catch { data = text; }
                if (!res.ok) throw new Error(data?.error || `Gotify health check failed: ${res.status}`);
                logger.log('[Gotify] Health check OK');
                return { output: { health: data.health, database: data.database } };
            }

            case 'listUsers': {
                const data = await withAdmin('GET', '/user');
                return { output: { users: Array.isArray(data) ? data : [] } };
            }

            case 'createUser': {
                const name = String(inputs.name ?? '').trim();
                const password = String(inputs.password ?? '').trim();
                if (!name) throw new Error('name is required.');
                if (!password) throw new Error('password is required.');

                const payload: any = { name, pass: password };
                if (inputs.admin !== undefined) payload.admin = Boolean(inputs.admin);

                const data = await withAdmin('POST', '/user', payload);
                logger.log(`[Gotify] User created: ${data.id}`);
                return { output: { id: data.id, name: data.name } };
            }

            default:
                return { error: `Gotify action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Gotify action failed.' };
    }
}

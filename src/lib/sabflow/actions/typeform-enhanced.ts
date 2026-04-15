'use server';

export async function executeTypeformEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const { accessToken, formId, webhookTag, themeId, ...rest } = inputs;
    const baseUrl = 'https://api.typeform.com';

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listForms': {
                const params = new URLSearchParams();
                if (rest.page) params.set('page', String(rest.page));
                if (rest.pageSize) params.set('page_size', String(rest.pageSize));
                if (rest.search) params.set('search', rest.search);
                if (rest.workspaceId) params.set('workspace_id', rest.workspaceId);
                const res = await fetch(`${baseUrl}/forms?${params}`, { headers });
                if (!res.ok) return { error: `Typeform listForms error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getForm': {
                const res = await fetch(`${baseUrl}/forms/${formId}`, { headers });
                if (!res.ok) return { error: `Typeform getForm error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createForm': {
                const body: Record<string, any> = { title: rest.title };
                if (rest.fields) body.fields = rest.fields;
                if (rest.settings) body.settings = rest.settings;
                if (rest.theme) body.theme = rest.theme;
                if (rest.workspace) body.workspace = rest.workspace;
                const res = await fetch(`${baseUrl}/forms`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Typeform createForm error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'updateForm': {
                const body: Record<string, any> = {};
                if (rest.title) body.title = rest.title;
                if (rest.fields) body.fields = rest.fields;
                if (rest.settings) body.settings = rest.settings;
                if (rest.theme) body.theme = rest.theme;
                const res = await fetch(`${baseUrl}/forms/${formId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Typeform updateForm error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'deleteForm': {
                const res = await fetch(`${baseUrl}/forms/${formId}`, { method: 'DELETE', headers });
                if (!res.ok) return { error: `Typeform deleteForm error: ${res.status} ${await res.text()}` };
                return { output: { deleted: true, formId } };
            }

            case 'listResponses': {
                const params = new URLSearchParams();
                if (rest.pageSize) params.set('page_size', String(rest.pageSize));
                if (rest.before) params.set('before', rest.before);
                if (rest.after) params.set('after', rest.after);
                if (rest.since) params.set('since', rest.since);
                if (rest.until) params.set('until', rest.until);
                if (rest.fields) params.set('fields', rest.fields);
                const res = await fetch(`${baseUrl}/forms/${formId}/responses?${params}`, { headers });
                if (!res.ok) return { error: `Typeform listResponses error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getFormInsights': {
                const res = await fetch(`${baseUrl}/forms/${formId}/insights/summary`, { headers });
                if (!res.ok) return { error: `Typeform getFormInsights error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getResponsesCount': {
                const params = new URLSearchParams({ page_size: '1' });
                const res = await fetch(`${baseUrl}/forms/${formId}/responses?${params}`, { headers });
                if (!res.ok) return { error: `Typeform getResponsesCount error: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: { total_items: data.total_items, page_count: data.page_count } };
            }

            case 'listWebhooks': {
                const res = await fetch(`${baseUrl}/forms/${formId}/webhooks`, { headers });
                if (!res.ok) return { error: `Typeform listWebhooks error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createWebhook': {
                const body: Record<string, any> = {
                    url: rest.url,
                    enabled: rest.enabled !== undefined ? rest.enabled : true,
                };
                if (rest.secret) body.secret = rest.secret;
                if (rest.verifySSL !== undefined) body.verify_ssl = rest.verifySSL;
                const res = await fetch(`${baseUrl}/forms/${formId}/webhooks/${rest.tag || webhookTag}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Typeform createWebhook error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'updateWebhook': {
                const body: Record<string, any> = {};
                if (rest.url) body.url = rest.url;
                if (rest.enabled !== undefined) body.enabled = rest.enabled;
                if (rest.secret) body.secret = rest.secret;
                const res = await fetch(`${baseUrl}/forms/${formId}/webhooks/${webhookTag}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Typeform updateWebhook error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'deleteWebhook': {
                const res = await fetch(`${baseUrl}/forms/${formId}/webhooks/${webhookTag}`, { method: 'DELETE', headers });
                if (!res.ok) return { error: `Typeform deleteWebhook error: ${res.status} ${await res.text()}` };
                return { output: { deleted: true, formId, webhookTag } };
            }

            case 'listThemes': {
                const params = new URLSearchParams();
                if (rest.page) params.set('page', String(rest.page));
                if (rest.pageSize) params.set('page_size', String(rest.pageSize));
                const res = await fetch(`${baseUrl}/themes?${params}`, { headers });
                if (!res.ok) return { error: `Typeform listThemes error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createTheme': {
                const body: Record<string, any> = { name: rest.name };
                if (rest.colors) body.colors = rest.colors;
                if (rest.font) body.font = rest.font;
                if (rest.hasTransparentButton !== undefined) body.has_transparent_button = rest.hasTransparentButton;
                const res = await fetch(`${baseUrl}/themes`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Typeform createTheme error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'updateTheme': {
                const body: Record<string, any> = {};
                if (rest.name) body.name = rest.name;
                if (rest.colors) body.colors = rest.colors;
                if (rest.font) body.font = rest.font;
                const res = await fetch(`${baseUrl}/themes/${themeId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Typeform updateTheme error: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            default:
                return { error: `Typeform Enhanced: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}

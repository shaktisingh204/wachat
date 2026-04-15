
'use server';

const HUBSPOT_BASE = 'https://api.hubapi.com';

async function hubspotRequest(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    accessToken?: string,
    apiKey?: string,
    body?: Record<string, any>,
    queryParams?: Record<string, string>
): Promise<any> {
    const params = new URLSearchParams(queryParams || {});
    if (apiKey && !accessToken) {
        params.set('hapikey', apiKey);
    }
    const qs = params.toString();
    const url = `${HUBSPOT_BASE}${path}${qs ? `?${qs}` : ''}`;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const options: RequestInit = { method, headers };
    if (body && method !== 'GET' && method !== 'DELETE') {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    if (res.status === 204) return { success: true };
    const json = await res.json();
    if (!res.ok) {
        throw new Error(json?.message || json?.error || `HubSpot error ${res.status}`);
    }
    return json;
}

export async function executeHubSpotCmsAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken: string | undefined = inputs.accessToken || inputs.access_token;
        const apiKey: string | undefined = inputs.apiKey || inputs.api_key;
        if (!accessToken && !apiKey) throw new Error('Missing HubSpot accessToken or apiKey in inputs');

        const req = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: Record<string, any>, queryParams?: Record<string, string>) =>
            hubspotRequest(method, path, accessToken, apiKey, body, queryParams);

        switch (actionName) {
            case 'listBlogPosts': {
                const query: Record<string, string> = {};
                if (inputs.limit) query.limit = String(inputs.limit);
                if (inputs.offset) query.offset = String(inputs.offset);
                if (inputs.state) query.state = inputs.state;
                const result = await req('GET', '/cms/v3/blogs/posts', undefined, query);
                return { output: result };
            }
            case 'getBlogPost': {
                const result = await req('GET', `/cms/v3/blogs/posts/${inputs.id}`);
                return { output: result };
            }
            case 'createBlogPost': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    htmlTitle: inputs.htmlTitle || inputs.html_title || inputs.title,
                    contentGroupId: inputs.contentGroupId || inputs.content_group_id,
                    postBody: inputs.postBody || inputs.post_body || inputs.body,
                };
                if (inputs.slug) body.slug = inputs.slug;
                if (inputs.metaDescription) body.metaDescription = inputs.metaDescription;
                const result = await req('POST', '/cms/v3/blogs/posts', body);
                return { output: result };
            }
            case 'updateBlogPost': {
                const result = await req('PATCH', `/cms/v3/blogs/posts/${inputs.id}`, inputs.data || inputs.updates || {
                    name: inputs.name,
                    htmlTitle: inputs.htmlTitle,
                    postBody: inputs.postBody,
                });
                return { output: result };
            }
            case 'publishBlogPost': {
                const result = await req('PATCH', `/cms/v3/blogs/posts/${inputs.id}`, { state: 'PUBLISHED' });
                return { output: result };
            }
            case 'deleteBlogPost': {
                const result = await req('DELETE', `/cms/v3/blogs/posts/${inputs.id}`);
                return { output: result };
            }
            case 'listLandingPages': {
                const query: Record<string, string> = {};
                if (inputs.limit) query.limit = String(inputs.limit);
                if (inputs.offset) query.offset = String(inputs.offset);
                const result = await req('GET', '/cms/v3/pages/landing-pages', undefined, query);
                return { output: result };
            }
            case 'getLandingPage': {
                const result = await req('GET', `/cms/v3/pages/landing-pages/${inputs.id}`);
                return { output: result };
            }
            case 'createLandingPage': {
                const result = await req('POST', '/cms/v3/pages/landing-pages', inputs.data || {
                    name: inputs.name,
                    htmlTitle: inputs.htmlTitle || inputs.title,
                    slug: inputs.slug,
                });
                return { output: result };
            }
            case 'listForms': {
                const query: Record<string, string> = {};
                if (inputs.limit) query.limit = String(inputs.limit);
                if (inputs.after) query.after = inputs.after;
                const result = await req('GET', '/marketing/v3/forms', undefined, query);
                return { output: result };
            }
            case 'getForm': {
                const result = await req('GET', `/marketing/v3/forms/${inputs.id}`);
                return { output: result };
            }
            case 'createForm': {
                const result = await req('POST', '/marketing/v3/forms', inputs.data || {
                    name: inputs.name,
                    formType: inputs.formType || 'hubspot',
                    fieldGroups: inputs.fieldGroups || [],
                });
                return { output: result };
            }
            case 'getFormSubmissions': {
                const query: Record<string, string> = {};
                if (inputs.limit) query.limit = String(inputs.limit);
                if (inputs.offset) query.offset = String(inputs.offset);
                const formGuid = inputs.formGuid || inputs.formId || inputs.id;
                const result = await req('GET', `/form-integrations/v1/submissions/forms/${formGuid}`, undefined, query);
                return { output: result };
            }
            case 'listEmails': {
                const query: Record<string, string> = {};
                if (inputs.limit) query.limit = String(inputs.limit);
                if (inputs.offset) query.offset = String(inputs.offset);
                if (inputs.orderBy) query.orderBy = inputs.orderBy;
                const result = await req('GET', '/marketing-emails/v1/emails', undefined, query);
                return { output: result };
            }
            case 'getEmailStats': {
                const query: Record<string, string> = {};
                if (inputs.limit) query.limit = String(inputs.limit);
                if (inputs.offset) query.offset = String(inputs.offset);
                if (inputs.startTimestamp) query.startTimestamp = String(inputs.startTimestamp);
                if (inputs.endTimestamp) query.endTimestamp = String(inputs.endTimestamp);
                const result = await req('GET', '/marketing-emails/v1/emails/statistics', undefined, query);
                return { output: result };
            }
            default:
                throw new Error(`Unknown HubSpot CMS action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.error?.('HubSpotCmsAction error', err);
        return { error: err?.message || String(err) };
    }
}


'use server';

const MEDIUM_BASE = 'https://api.medium.com/v1';

async function mediumFetch(accessToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Medium] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${MEDIUM_BASE}${path}`, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.errors?.[0]?.message || data?.message || `Medium API error: ${res.status}`);
    }
    return data;
}

export async function executeMediumAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const medium = (method: string, path: string, body?: any) => mediumFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'getCurrentUser': {
                const data = await medium('GET', `/me`);
                return { output: { id: data.data?.id, username: data.data?.username, name: data.data?.name, url: data.data?.url, imageUrl: data.data?.imageUrl } };
            }

            case 'getUserPublications': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const data = await medium('GET', `/users/${userId}/publications`);
                return { output: { publications: data.data ?? [] } };
            }

            case 'createPost': {
                const userId = String(inputs.userId ?? '').trim();
                if (!userId) throw new Error('userId is required.');
                const title = String(inputs.title ?? '').trim();
                const contentFormat = String(inputs.contentFormat ?? 'html').trim();
                const content = String(inputs.content ?? '').trim();
                if (!title || !content) throw new Error('title and content are required.');
                const body: Record<string, any> = {
                    title,
                    contentFormat,
                    content,
                };
                if (inputs.tags) body.tags = Array.isArray(inputs.tags) ? inputs.tags : String(inputs.tags).split(',').map((t: string) => t.trim());
                if (inputs.canonicalUrl) body.canonicalUrl = String(inputs.canonicalUrl);
                if (inputs.publishStatus) body.publishStatus = String(inputs.publishStatus);
                const data = await medium('POST', `/users/${userId}/posts`, body);
                return { output: { id: data.data?.id, title: data.data?.title, url: data.data?.url, publishStatus: data.data?.publishStatus } };
            }

            case 'createPostUnderPublication': {
                const publicationId = String(inputs.publicationId ?? '').trim();
                if (!publicationId) throw new Error('publicationId is required.');
                const title = String(inputs.title ?? '').trim();
                const contentFormat = String(inputs.contentFormat ?? 'html').trim();
                const content = String(inputs.content ?? '').trim();
                if (!title || !content) throw new Error('title and content are required.');
                const body: Record<string, any> = {
                    title,
                    contentFormat,
                    content,
                };
                if (inputs.tags) body.tags = Array.isArray(inputs.tags) ? inputs.tags : String(inputs.tags).split(',').map((t: string) => t.trim());
                if (inputs.canonicalUrl) body.canonicalUrl = String(inputs.canonicalUrl);
                if (inputs.publishStatus) body.publishStatus = String(inputs.publishStatus);
                const data = await medium('POST', `/publications/${publicationId}/posts`, body);
                return { output: { id: data.data?.id, title: data.data?.title, url: data.data?.url, publishStatus: data.data?.publishStatus } };
            }

            case 'getPublicationContributors': {
                const publicationId = String(inputs.publicationId ?? '').trim();
                if (!publicationId) throw new Error('publicationId is required.');
                const data = await medium('GET', `/publications/${publicationId}/contributors`);
                return { output: { contributors: data.data ?? [] } };
            }

            default:
                return { error: `Medium action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Medium action failed.' };
    }
}

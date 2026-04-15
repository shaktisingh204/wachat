'use server';

export async function executeZendeskGuideAction(actionName: string, inputs: any, user: any, logger: any) {
    const subdomain = inputs.subdomain;
    const BASE = `https://${subdomain}.zendesk.com/api/v2/help_center`;
    const authHeader = `Basic ${Buffer.from(`${inputs.email}/token:${inputs.apiToken}`).toString('base64')}`;
    const locale = inputs.locale || 'en-us';
    const headers = {
        Authorization: authHeader,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listCategories': {
                const res = await fetch(`${BASE}/${locale}/categories`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to list categories' };
                return { output: data };
            }

            case 'createCategory': {
                const res = await fetch(`${BASE}/categories`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ category: { locale, name: inputs.name, description: inputs.description } }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to create category' };
                return { output: data };
            }

            case 'listSections': {
                const url = inputs.categoryId
                    ? `${BASE}/${locale}/categories/${inputs.categoryId}/sections`
                    : `${BASE}/${locale}/sections`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to list sections' };
                return { output: data };
            }

            case 'createSection': {
                const res = await fetch(`${BASE}/categories/${inputs.categoryId}/sections`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ section: { locale, name: inputs.name, description: inputs.description } }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to create section' };
                return { output: data };
            }

            case 'listArticles': {
                const url = inputs.sectionId
                    ? `${BASE}/${locale}/sections/${inputs.sectionId}/articles`
                    : `${BASE}/${locale}/articles`;
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${url}?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to list articles' };
                return { output: data };
            }

            case 'getArticle': {
                const res = await fetch(`${BASE}/${locale}/articles/${inputs.articleId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to get article' };
                return { output: data };
            }

            case 'createArticle': {
                const res = await fetch(`${BASE}/sections/${inputs.sectionId}/articles`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        article: {
                            locale,
                            title: inputs.title,
                            body: inputs.body,
                            draft: inputs.draft !== undefined ? inputs.draft : false,
                            label_names: inputs.labelNames,
                            promoted: inputs.promoted,
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to create article' };
                return { output: data };
            }

            case 'updateArticle': {
                const res = await fetch(`${BASE}/articles/${inputs.articleId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        article: {
                            title: inputs.title,
                            body: inputs.body,
                            draft: inputs.draft,
                            label_names: inputs.labelNames,
                            promoted: inputs.promoted,
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to update article' };
                return { output: data };
            }

            case 'deleteArticle': {
                const res = await fetch(`${BASE}/articles/${inputs.articleId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.description || 'Failed to delete article' };
                }
                return { output: { success: true } };
            }

            case 'searchArticles': {
                const zBase = `https://${subdomain}.zendesk.com/api/v2/help_center`;
                const params = new URLSearchParams({ query: inputs.query });
                if (locale) params.set('locale', locale);
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${zBase}/articles/search?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to search articles' };
                return { output: data };
            }

            case 'listComments': {
                const res = await fetch(`${BASE}/${locale}/articles/${inputs.articleId}/comments`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to list comments' };
                return { output: data };
            }

            case 'createComment': {
                const res = await fetch(`${BASE}/articles/${inputs.articleId}/comments`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ comment: { locale, body: inputs.body, author_id: inputs.authorId } }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to create comment' };
                return { output: data };
            }

            case 'listLabels': {
                const res = await fetch(`${BASE}/${locale}/labels`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to list labels' };
                return { output: data };
            }

            case 'listSubscriptions': {
                const url = inputs.articleId
                    ? `${BASE}/articles/${inputs.articleId}/subscriptions`
                    : `${BASE}/sections/${inputs.sectionId}/subscriptions`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to list subscriptions' };
                return { output: data };
            }

            case 'translateArticle': {
                const res = await fetch(`${BASE}/articles/${inputs.articleId}/translations`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        translation: {
                            locale: inputs.targetLocale,
                            title: inputs.title,
                            body: inputs.body,
                            draft: inputs.draft !== undefined ? inputs.draft : false,
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to translate article' };
                return { output: data };
            }

            default:
                return { error: `Unknown Zendesk Guide action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Zendesk Guide action error: ${err.message}`);
        return { error: err.message || 'Unexpected error in Zendesk Guide action' };
    }
}

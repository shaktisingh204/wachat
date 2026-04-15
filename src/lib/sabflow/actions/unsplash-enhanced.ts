'use server';

export async function executeUnsplashEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.unsplash.com';
    const headers: Record<string, string> = {
        'Authorization': `Client-ID ${inputs.accessKey}`,
        'Content-Type': 'application/json',
        'Accept-Version': 'v1',
    };

    try {
        switch (actionName) {
            case 'searchPhotos': {
                const params = new URLSearchParams({ query: inputs.query || '' });
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                if (inputs.order_by) params.append('order_by', inputs.order_by);
                if (inputs.collections) params.append('collections', inputs.collections);
                if (inputs.content_filter) params.append('content_filter', inputs.content_filter);
                if (inputs.color) params.append('color', inputs.color);
                if (inputs.orientation) params.append('orientation', inputs.orientation);
                if (inputs.lang) params.append('lang', inputs.lang);
                const res = await fetch(`${BASE_URL}/search/photos?${params}`, { headers });
                if (!res.ok) return { error: `Unsplash searchPhotos failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listPhotos': {
                const params = new URLSearchParams();
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                if (inputs.order_by) params.append('order_by', inputs.order_by);
                const res = await fetch(`${BASE_URL}/photos?${params}`, { headers });
                if (!res.ok) return { error: `Unsplash listPhotos failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getPhoto': {
                const res = await fetch(`${BASE_URL}/photos/${inputs.id}`, { headers });
                if (!res.ok) return { error: `Unsplash getPhoto failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getRandomPhoto': {
                const params = new URLSearchParams();
                if (inputs.collections) params.append('collections', inputs.collections);
                if (inputs.topics) params.append('topics', inputs.topics);
                if (inputs.username) params.append('username', inputs.username);
                if (inputs.query) params.append('query', inputs.query);
                if (inputs.orientation) params.append('orientation', inputs.orientation);
                if (inputs.content_filter) params.append('content_filter', inputs.content_filter);
                if (inputs.count) params.append('count', String(inputs.count));
                const res = await fetch(`${BASE_URL}/photos/random?${params}`, { headers });
                if (!res.ok) return { error: `Unsplash getRandomPhoto failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getPhotoStats': {
                const params = new URLSearchParams();
                if (inputs.resolution) params.append('resolution', inputs.resolution);
                if (inputs.quantity) params.append('quantity', String(inputs.quantity));
                const res = await fetch(`${BASE_URL}/photos/${inputs.id}/statistics?${params}`, { headers });
                if (!res.ok) return { error: `Unsplash getPhotoStats failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listCollections': {
                const params = new URLSearchParams();
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/collections?${params}`, { headers });
                if (!res.ok) return { error: `Unsplash listCollections failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getCollection': {
                const res = await fetch(`${BASE_URL}/collections/${inputs.id}`, { headers });
                if (!res.ok) return { error: `Unsplash getCollection failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getCollectionPhotos': {
                const params = new URLSearchParams();
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                if (inputs.orientation) params.append('orientation', inputs.orientation);
                const res = await fetch(`${BASE_URL}/collections/${inputs.id}/photos?${params}`, { headers });
                if (!res.ok) return { error: `Unsplash getCollectionPhotos failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createCollection': {
                const body: Record<string, any> = { title: inputs.title };
                if (inputs.description) body.description = inputs.description;
                if (inputs.private !== undefined) body.private = inputs.private;
                const res = await fetch(`${BASE_URL}/collections`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Unsplash createCollection failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'updateCollection': {
                const body: Record<string, any> = {};
                if (inputs.title) body.title = inputs.title;
                if (inputs.description) body.description = inputs.description;
                if (inputs.private !== undefined) body.private = inputs.private;
                const res = await fetch(`${BASE_URL}/collections/${inputs.id}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Unsplash updateCollection failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'deleteCollection': {
                const res = await fetch(`${BASE_URL}/collections/${inputs.id}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `Unsplash deleteCollection failed: ${res.status} ${await res.text()}` };
                return { output: { success: true, id: inputs.id } };
            }

            case 'addPhotoToCollection': {
                const res = await fetch(`${BASE_URL}/collections/${inputs.collection_id}/add`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ photo_id: inputs.photo_id }),
                });
                if (!res.ok) return { error: `Unsplash addPhotoToCollection failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'removePhotoFromCollection': {
                const res = await fetch(`${BASE_URL}/collections/${inputs.collection_id}/remove`, {
                    method: 'DELETE',
                    headers,
                    body: JSON.stringify({ photo_id: inputs.photo_id }),
                });
                if (!res.ok) return { error: `Unsplash removePhotoFromCollection failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listTopics': {
                const params = new URLSearchParams();
                if (inputs.ids) params.append('ids', inputs.ids);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                if (inputs.order_by) params.append('order_by', inputs.order_by);
                const res = await fetch(`${BASE_URL}/topics?${params}`, { headers });
                if (!res.ok) return { error: `Unsplash listTopics failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getTopicPhotos': {
                const params = new URLSearchParams();
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                if (inputs.orientation) params.append('orientation', inputs.orientation);
                if (inputs.order_by) params.append('order_by', inputs.order_by);
                const res = await fetch(`${BASE_URL}/topics/${inputs.id_or_slug}/photos?${params}`, { headers });
                if (!res.ok) return { error: `Unsplash getTopicPhotos failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            default:
                return { error: `Unsplash Enhanced action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Unsplash Enhanced action error: ${err.message}`);
        return { error: err.message || 'Unknown error in Unsplash Enhanced action.' };
    }
}

'use server';

export async function executePexelsAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.pexels.com/v1';
    const headers: Record<string, string> = {
        'Authorization': inputs.apiKey,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'searchPhotos': {
                const params = new URLSearchParams({ query: inputs.query || '' });
                if (inputs.orientation) params.append('orientation', inputs.orientation);
                if (inputs.size) params.append('size', inputs.size);
                if (inputs.color) params.append('color', inputs.color);
                if (inputs.locale) params.append('locale', inputs.locale);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/search?${params}`, { headers });
                if (!res.ok) return { error: `Pexels searchPhotos failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getCuratedPhotos': {
                const params = new URLSearchParams();
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/curated?${params}`, { headers });
                if (!res.ok) return { error: `Pexels getCuratedPhotos failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getPhoto': {
                const res = await fetch(`${BASE_URL}/photos/${inputs.id}`, { headers });
                if (!res.ok) return { error: `Pexels getPhoto failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'searchVideos': {
                const params = new URLSearchParams({ query: inputs.query || '' });
                if (inputs.orientation) params.append('orientation', inputs.orientation);
                if (inputs.size) params.append('size', inputs.size);
                if (inputs.locale) params.append('locale', inputs.locale);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`https://api.pexels.com/videos/search?${params}`, { headers });
                if (!res.ok) return { error: `Pexels searchVideos failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getPopularVideos': {
                const params = new URLSearchParams();
                if (inputs.min_width) params.append('min_width', String(inputs.min_width));
                if (inputs.min_height) params.append('min_height', String(inputs.min_height));
                if (inputs.min_duration) params.append('min_duration', String(inputs.min_duration));
                if (inputs.max_duration) params.append('max_duration', String(inputs.max_duration));
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`https://api.pexels.com/videos/popular?${params}`, { headers });
                if (!res.ok) return { error: `Pexels getPopularVideos failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getVideo': {
                const res = await fetch(`https://api.pexels.com/videos/videos/${inputs.id}`, { headers });
                if (!res.ok) return { error: `Pexels getVideo failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getFeaturedCollections': {
                const params = new URLSearchParams();
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/collections/featured?${params}`, { headers });
                if (!res.ok) return { error: `Pexels getFeaturedCollections failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getMyCollections': {
                const params = new URLSearchParams();
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/collections?${params}`, { headers });
                if (!res.ok) return { error: `Pexels getMyCollections failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getCollectionMedia': {
                const params = new URLSearchParams();
                if (inputs.type) params.append('type', inputs.type);
                if (inputs.sort) params.append('sort', inputs.sort);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/collections/${inputs.id}?${params}`, { headers });
                if (!res.ok) return { error: `Pexels getCollectionMedia failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'searchByColor': {
                const params = new URLSearchParams({ query: inputs.query || '' });
                if (inputs.color) params.append('color', inputs.color);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/search?${params}`, { headers });
                if (!res.ok) return { error: `Pexels searchByColor failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'searchByOrientation': {
                const params = new URLSearchParams({ query: inputs.query || '' });
                if (inputs.orientation) params.append('orientation', inputs.orientation);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/search?${params}`, { headers });
                if (!res.ok) return { error: `Pexels searchByOrientation failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'searchBySize': {
                const params = new URLSearchParams({ query: inputs.query || '' });
                if (inputs.size) params.append('size', inputs.size);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/search?${params}`, { headers });
                if (!res.ok) return { error: `Pexels searchBySize failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getPhotoDownload': {
                const res = await fetch(`${BASE_URL}/photos/${inputs.id}`, { headers });
                if (!res.ok) return { error: `Pexels getPhotoDownload failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: { photo: data, downloadUrl: data?.src?.original || null } };
            }

            case 'searchByKeyword': {
                const params = new URLSearchParams({ query: inputs.keyword || inputs.query || '' });
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/search?${params}`, { headers });
                if (!res.ok) return { error: `Pexels searchByKeyword failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getRandomPhoto': {
                const params = new URLSearchParams({ query: inputs.query || 'nature' });
                params.append('per_page', '1');
                const page = Math.floor(Math.random() * 100) + 1;
                params.append('page', String(page));
                const res = await fetch(`${BASE_URL}/search?${params}`, { headers });
                if (!res.ok) return { error: `Pexels getRandomPhoto failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                const photos = data?.photos || [];
                return { output: { photo: photos[0] || null } };
            }

            default:
                return { error: `Pexels action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Pexels action error: ${err.message}`);
        return { error: err.message || 'Unknown error in Pexels action.' };
    }
}

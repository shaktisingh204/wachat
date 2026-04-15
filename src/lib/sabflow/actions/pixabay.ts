'use server';

export async function executePixabayAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://pixabay.com/api';

    try {
        switch (actionName) {
            case 'searchImages': {
                const params = new URLSearchParams({ key: inputs.apiKey });
                if (inputs.q) params.append('q', inputs.q);
                if (inputs.lang) params.append('lang', inputs.lang);
                if (inputs.image_type) params.append('image_type', inputs.image_type);
                if (inputs.orientation) params.append('orientation', inputs.orientation);
                if (inputs.category) params.append('category', inputs.category);
                if (inputs.min_width) params.append('min_width', String(inputs.min_width));
                if (inputs.min_height) params.append('min_height', String(inputs.min_height));
                if (inputs.colors) params.append('colors', inputs.colors);
                if (inputs.editors_choice !== undefined) params.append('editors_choice', String(inputs.editors_choice));
                if (inputs.safesearch !== undefined) params.append('safesearch', String(inputs.safesearch));
                if (inputs.order) params.append('order', inputs.order);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/?${params}`);
                if (!res.ok) return { error: `Pixabay searchImages failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'searchPhotos': {
                const params = new URLSearchParams({ key: inputs.apiKey, image_type: 'photo' });
                if (inputs.q) params.append('q', inputs.q);
                if (inputs.lang) params.append('lang', inputs.lang);
                if (inputs.orientation) params.append('orientation', inputs.orientation);
                if (inputs.category) params.append('category', inputs.category);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/?${params}`);
                if (!res.ok) return { error: `Pixabay searchPhotos failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'searchIllustrations': {
                const params = new URLSearchParams({ key: inputs.apiKey, image_type: 'illustration' });
                if (inputs.q) params.append('q', inputs.q);
                if (inputs.lang) params.append('lang', inputs.lang);
                if (inputs.category) params.append('category', inputs.category);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/?${params}`);
                if (!res.ok) return { error: `Pixabay searchIllustrations failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'searchVectors': {
                const params = new URLSearchParams({ key: inputs.apiKey, image_type: 'vector' });
                if (inputs.q) params.append('q', inputs.q);
                if (inputs.lang) params.append('lang', inputs.lang);
                if (inputs.category) params.append('category', inputs.category);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/?${params}`);
                if (!res.ok) return { error: `Pixabay searchVectors failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'searchVideos': {
                const params = new URLSearchParams({ key: inputs.apiKey });
                if (inputs.q) params.append('q', inputs.q);
                if (inputs.lang) params.append('lang', inputs.lang);
                if (inputs.video_type) params.append('video_type', inputs.video_type);
                if (inputs.category) params.append('category', inputs.category);
                if (inputs.min_width) params.append('min_width', String(inputs.min_width));
                if (inputs.min_height) params.append('min_height', String(inputs.min_height));
                if (inputs.editors_choice !== undefined) params.append('editors_choice', String(inputs.editors_choice));
                if (inputs.safesearch !== undefined) params.append('safesearch', String(inputs.safesearch));
                if (inputs.order) params.append('order', inputs.order);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/videos/?${params}`);
                if (!res.ok) return { error: `Pixabay searchVideos failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'searchMusic': {
                const params = new URLSearchParams({ key: inputs.apiKey });
                if (inputs.q) params.append('q', inputs.q);
                if (inputs.lang) params.append('lang', inputs.lang);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/music/?${params}`);
                if (!res.ok) return { error: `Pixabay searchMusic failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getImage': {
                const params = new URLSearchParams({ key: inputs.apiKey, id: String(inputs.id) });
                const res = await fetch(`${BASE_URL}/?${params}`);
                if (!res.ok) return { error: `Pixabay getImage failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: { image: data?.hits?.[0] || null } };
            }

            case 'getVideo': {
                const params = new URLSearchParams({ key: inputs.apiKey, id: String(inputs.id) });
                const res = await fetch(`${BASE_URL}/videos/?${params}`);
                if (!res.ok) return { error: `Pixabay getVideo failed: ${res.status} ${await res.text()}` };
                const data = await res.json();
                return { output: { video: data?.hits?.[0] || null } };
            }

            case 'getPopularImages': {
                const params = new URLSearchParams({ key: inputs.apiKey, order: 'popular' });
                if (inputs.image_type) params.append('image_type', inputs.image_type);
                if (inputs.category) params.append('category', inputs.category);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/?${params}`);
                if (!res.ok) return { error: `Pixabay getPopularImages failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getPopularVideos': {
                const params = new URLSearchParams({ key: inputs.apiKey, order: 'popular' });
                if (inputs.video_type) params.append('video_type', inputs.video_type);
                if (inputs.category) params.append('category', inputs.category);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/videos/?${params}`);
                if (!res.ok) return { error: `Pixabay getPopularVideos failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getEditorChoiceImages': {
                const params = new URLSearchParams({ key: inputs.apiKey, editors_choice: 'true' });
                if (inputs.image_type) params.append('image_type', inputs.image_type);
                if (inputs.category) params.append('category', inputs.category);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/?${params}`);
                if (!res.ok) return { error: `Pixabay getEditorChoiceImages failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'searchByColor': {
                const params = new URLSearchParams({ key: inputs.apiKey });
                if (inputs.q) params.append('q', inputs.q);
                if (inputs.colors) params.append('colors', inputs.colors);
                if (inputs.image_type) params.append('image_type', inputs.image_type);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/?${params}`);
                if (!res.ok) return { error: `Pixabay searchByColor failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'searchByCategory': {
                const params = new URLSearchParams({ key: inputs.apiKey });
                if (inputs.q) params.append('q', inputs.q);
                if (inputs.category) params.append('category', inputs.category);
                if (inputs.image_type) params.append('image_type', inputs.image_type);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/?${params}`);
                if (!res.ok) return { error: `Pixabay searchByCategory failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'searchByType': {
                const params = new URLSearchParams({ key: inputs.apiKey });
                if (inputs.q) params.append('q', inputs.q);
                if (inputs.image_type) params.append('image_type', inputs.image_type);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/?${params}`);
                if (!res.ok) return { error: `Pixabay searchByType failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'searchByLanguage': {
                const params = new URLSearchParams({ key: inputs.apiKey });
                if (inputs.q) params.append('q', inputs.q);
                if (inputs.lang) params.append('lang', inputs.lang);
                if (inputs.image_type) params.append('image_type', inputs.image_type);
                if (inputs.page) params.append('page', String(inputs.page));
                if (inputs.per_page) params.append('per_page', String(inputs.per_page));
                const res = await fetch(`${BASE_URL}/?${params}`);
                if (!res.ok) return { error: `Pixabay searchByLanguage failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            default:
                return { error: `Pixabay action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Pixabay action error: ${err.message}`);
        return { error: err.message || 'Unknown error in Pixabay action.' };
    }
}

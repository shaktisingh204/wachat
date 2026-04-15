'use server';

export async function executeGiphyAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.giphy.com/v1';

    try {
        switch (actionName) {
            case 'searchGifs': {
                const params = new URLSearchParams({ api_key: inputs.apiKey, q: inputs.q || '' });
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.offset) params.append('offset', String(inputs.offset));
                if (inputs.rating) params.append('rating', inputs.rating);
                if (inputs.lang) params.append('lang', inputs.lang);
                const res = await fetch(`${BASE_URL}/gifs/search?${params}`);
                if (!res.ok) return { error: `Giphy searchGifs failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getTrending': {
                const params = new URLSearchParams({ api_key: inputs.apiKey });
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.offset) params.append('offset', String(inputs.offset));
                if (inputs.rating) params.append('rating', inputs.rating);
                const res = await fetch(`${BASE_URL}/gifs/trending?${params}`);
                if (!res.ok) return { error: `Giphy getTrending failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getById': {
                const params = new URLSearchParams({ api_key: inputs.apiKey });
                const res = await fetch(`${BASE_URL}/gifs/${inputs.id}?${params}`);
                if (!res.ok) return { error: `Giphy getById failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getByIds': {
                const params = new URLSearchParams({ api_key: inputs.apiKey });
                const ids = Array.isArray(inputs.ids) ? inputs.ids.join(',') : inputs.ids;
                params.append('ids', ids);
                const res = await fetch(`${BASE_URL}/gifs?${params}`);
                if (!res.ok) return { error: `Giphy getByIds failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getRandomGif': {
                const params = new URLSearchParams({ api_key: inputs.apiKey });
                if (inputs.tag) params.append('tag', inputs.tag);
                if (inputs.rating) params.append('rating', inputs.rating);
                const res = await fetch(`${BASE_URL}/gifs/random?${params}`);
                if (!res.ok) return { error: `Giphy getRandomGif failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'translateText': {
                const params = new URLSearchParams({ api_key: inputs.apiKey, s: inputs.s || '' });
                if (inputs.weirdness !== undefined) params.append('weirdness', String(inputs.weirdness));
                const res = await fetch(`${BASE_URL}/gifs/translate?${params}`);
                if (!res.ok) return { error: `Giphy translateText failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'searchStickers': {
                const params = new URLSearchParams({ api_key: inputs.apiKey, q: inputs.q || '' });
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.offset) params.append('offset', String(inputs.offset));
                if (inputs.rating) params.append('rating', inputs.rating);
                if (inputs.lang) params.append('lang', inputs.lang);
                const res = await fetch(`${BASE_URL}/stickers/search?${params}`);
                if (!res.ok) return { error: `Giphy searchStickers failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getTrendingStickers': {
                const params = new URLSearchParams({ api_key: inputs.apiKey });
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.offset) params.append('offset', String(inputs.offset));
                if (inputs.rating) params.append('rating', inputs.rating);
                const res = await fetch(`${BASE_URL}/stickers/trending?${params}`);
                if (!res.ok) return { error: `Giphy getTrendingStickers failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getRandomSticker': {
                const params = new URLSearchParams({ api_key: inputs.apiKey });
                if (inputs.tag) params.append('tag', inputs.tag);
                if (inputs.rating) params.append('rating', inputs.rating);
                const res = await fetch(`${BASE_URL}/stickers/random?${params}`);
                if (!res.ok) return { error: `Giphy getRandomSticker failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'searchEmoji': {
                const params = new URLSearchParams({ api_key: inputs.apiKey });
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.offset) params.append('offset', String(inputs.offset));
                const res = await fetch(`${BASE_URL}/emoji?${params}`);
                if (!res.ok) return { error: `Giphy searchEmoji failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getEmojiVariations': {
                const params = new URLSearchParams({ api_key: inputs.apiKey });
                const res = await fetch(`${BASE_URL}/emoji/${inputs.id}/variations?${params}`);
                if (!res.ok) return { error: `Giphy getEmojiVariations failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getCategories': {
                const params = new URLSearchParams({ api_key: inputs.apiKey });
                const res = await fetch(`${BASE_URL}/gifs/categories?${params}`);
                if (!res.ok) return { error: `Giphy getCategories failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getTermSuggestions': {
                const params = new URLSearchParams({ api_key: inputs.apiKey, term: inputs.term || '' });
                const res = await fetch(`${BASE_URL}/gifs/search/tags?${params}`);
                if (!res.ok) return { error: `Giphy getTermSuggestions failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getChannelContent': {
                const params = new URLSearchParams({ api_key: inputs.apiKey });
                if (inputs.channel) params.append('channel', inputs.channel);
                if (inputs.limit) params.append('limit', String(inputs.limit));
                if (inputs.offset) params.append('offset', String(inputs.offset));
                const res = await fetch(`${BASE_URL}/channels/${inputs.channelId}/feed?${params}`);
                if (!res.ok) return { error: `Giphy getChannelContent failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'uploadGif': {
                const params = new URLSearchParams({ api_key: inputs.apiKey });
                if (inputs.username) params.append('username', inputs.username);
                if (inputs.source_image_url) params.append('source_image_url', inputs.source_image_url);
                if (inputs.source_video_url) params.append('source_video_url', inputs.source_video_url);
                if (inputs.tags) params.append('tags', inputs.tags);
                if (inputs.source_post_url) params.append('source_post_url', inputs.source_post_url);
                const res = await fetch(`${BASE_URL}/gifs?${params}`, { method: 'POST' });
                if (!res.ok) return { error: `Giphy uploadGif failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            default:
                return { error: `Giphy action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Giphy action error: ${err.message}`);
        return { error: err.message || 'Unknown error in Giphy action.' };
    }
}

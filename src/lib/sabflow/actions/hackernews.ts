
'use server';

const HN_BASE = 'https://hacker-news.firebaseio.com/v0';
const ALGOLIA_BASE = 'https://hn.algolia.com/api/v1';

async function hnFetch(url: string, logger: any): Promise<any> {
    logger.log(`[HackerNews] GET ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HackerNews API error: ${res.status}`);
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function fetchItem(itemId: number | string, logger: any): Promise<any> {
    return hnFetch(`${HN_BASE}/item/${itemId}.json`, logger);
}

async function fetchStoryList(endpoint: string, limit: number, logger: any): Promise<any[]> {
    const ids: number[] = await hnFetch(`${HN_BASE}/${endpoint}.json`, logger);
    const slice = ids.slice(0, limit);
    const stories = await Promise.all(slice.map((id) => fetchItem(id, logger)));
    return stories.filter(Boolean).map((s: any) => ({
        id: s.id,
        title: s.title,
        url: s.url,
        score: s.score,
        by: s.by,
        descendants: s.descendants,
        time: s.time,
    }));
}

async function fetchCommentsRecursive(
    kids: number[],
    depth: number,
    maxDepth: number,
    logger: any,
): Promise<any[]> {
    if (!kids || kids.length === 0 || depth >= maxDepth) return [];
    const slice = kids.slice(0, 10);
    const items = await Promise.all(slice.map((id) => fetchItem(id, logger)));
    return Promise.all(
        items.filter(Boolean).map(async (item: any) => ({
            id: item.id,
            by: item.by,
            text: item.text,
            time: item.time,
            kids: await fetchCommentsRecursive(item.kids ?? [], depth + 1, maxDepth, logger),
        })),
    );
}

export async function executeHackernewsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        switch (actionName) {
            case 'getItem': {
                const itemId = inputs.itemId;
                if (!itemId && itemId !== 0) throw new Error('itemId is required.');
                const data = await fetchItem(itemId, logger);
                return {
                    output: {
                        id: data.id,
                        type: data.type,
                        by: data.by,
                        title: data.title,
                        url: data.url,
                        score: data.score,
                        descendants: data.descendants,
                        kids: data.kids ?? [],
                        text: data.text,
                        time: data.time,
                        parent: data.parent,
                        deleted: data.deleted ?? false,
                        dead: data.dead ?? false,
                    },
                };
            }

            case 'getTopStories': {
                const limit = Number(inputs.limit ?? 10);
                const stories = await fetchStoryList('topstories', limit, logger);
                return { output: { stories } };
            }

            case 'getNewStories': {
                const limit = Number(inputs.limit ?? 10);
                const stories = await fetchStoryList('newstories', limit, logger);
                return { output: { stories } };
            }

            case 'getBestStories': {
                const limit = Number(inputs.limit ?? 10);
                const stories = await fetchStoryList('beststories', limit, logger);
                return { output: { stories } };
            }

            case 'getAskStories': {
                const limit = Number(inputs.limit ?? 10);
                const stories = await fetchStoryList('askstories', limit, logger);
                return { output: { stories } };
            }

            case 'getShowStories': {
                const limit = Number(inputs.limit ?? 10);
                const stories = await fetchStoryList('showstories', limit, logger);
                return { output: { stories } };
            }

            case 'getJobStories': {
                const limit = Number(inputs.limit ?? 10);
                const stories = await fetchStoryList('jobstories', limit, logger);
                return { output: { stories } };
            }

            case 'getUser': {
                const username = String(inputs.username ?? '').trim();
                if (!username) throw new Error('username is required.');
                const data = await hnFetch(`${HN_BASE}/user/${username}.json`, logger);
                if (!data) throw new Error(`User "${username}" not found.`);
                return {
                    output: {
                        id: data.id,
                        karma: data.karma,
                        about: data.about,
                        submitted: data.submitted ?? [],
                    },
                };
            }

            case 'getMaxItem': {
                const data = await hnFetch(`${HN_BASE}/maxitem.json`, logger);
                return { output: { maxItemId: data } };
            }

            case 'searchStories': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const tags = inputs.tags ?? 'story';
                const numericFilters = inputs.numericFilters ?? '';
                const page = inputs.page ?? 0;
                const url = `${ALGOLIA_BASE}/search?query=${encodeURIComponent(query)}&tags=${encodeURIComponent(tags)}&numericFilters=${encodeURIComponent(numericFilters)}&page=${page}&hitsPerPage=20`;
                const data = await hnFetch(url, logger);
                const hits = (data.hits ?? []).map((h: any) => ({
                    objectID: h.objectID,
                    title: h.title,
                    url: h.url,
                    points: h.points,
                    author: h.author,
                    created_at: h.created_at,
                }));
                return { output: { hits, nbHits: data.nbHits, nbPages: data.nbPages } };
            }

            case 'searchByDate': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const tags = inputs.tags ?? 'story';
                const page = inputs.page ?? 0;
                const url = `${ALGOLIA_BASE}/search_by_date?query=${encodeURIComponent(query)}&tags=${encodeURIComponent(tags)}&page=${page}`;
                const data = await hnFetch(url, logger);
                return { output: { hits: data.hits ?? [], nbHits: data.nbHits } };
            }

            case 'getComments': {
                const storyId = inputs.storyId;
                if (!storyId && storyId !== 0) throw new Error('storyId is required.');
                const story = await fetchItem(storyId, logger);
                if (!story) throw new Error(`Story ${storyId} not found.`);
                const comments = await fetchCommentsRecursive(story.kids ?? [], 0, 3, logger);
                return { output: { comments } };
            }

            default:
                return { error: `HackerNews action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'HackerNews action failed.' };
    }
}

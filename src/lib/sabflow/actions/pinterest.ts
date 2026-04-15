
'use server';

const PINTEREST_BASE = 'https://api.pinterest.com/v5';

async function pinterestFetch(
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    logger?.log(`[Pinterest] ${method} ${path}`);
    const url = path.startsWith('http') ? path : `${PINTEREST_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(
            data?.message || data?.code?.toString() || `Pinterest API error: ${res.status}`
        );
    }
    return data;
}

export async function executePinterestAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const pi = (method: string, path: string, body?: any) =>
            pinterestFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'getUser': {
                const data = await pi('GET', '/user_account');
                return {
                    output: {
                        username: data.username ?? '',
                        id: data.profile_owner?.id ?? data.id ?? '',
                        accountType: data.account_type ?? '',
                        profileImage: data.profile_image ?? '',
                        websiteUrl: data.website_url ?? '',
                    },
                };
            }

            case 'listBoards': {
                const pageSize = Number(inputs.pageSize ?? 25);
                let qs = `/boards?page_size=${pageSize}`;
                if (inputs.bookmark) qs += `&bookmark=${encodeURIComponent(String(inputs.bookmark))}`;
                const data = await pi('GET', qs);
                const items = (data?.items ?? []).map((b: any) => ({
                    id: b.id ?? '',
                    name: b.name ?? '',
                    description: b.description ?? '',
                    pinCount: b.pin_count ?? 0,
                }));
                return { output: { items, bookmark: data?.bookmark ?? null } };
            }

            case 'getBoard': {
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const data = await pi('GET', `/boards/${boardId}`);
                return {
                    output: {
                        id: data.id ?? '',
                        name: data.name ?? '',
                        description: data.description ?? '',
                        pinCount: data.pin_count ?? 0,
                    },
                };
            }

            case 'createBoard': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = {
                    name,
                    privacy: String(inputs.privacy ?? 'PUBLIC'),
                };
                if (inputs.description) body.description = String(inputs.description);
                const data = await pi('POST', '/boards', body);
                logger.log(`[Pinterest] Board created: ${data.id}`);
                return { output: { id: data.id ?? '', name: data.name ?? '' } };
            }

            case 'deleteBoard': {
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                await pi('DELETE', `/boards/${boardId}`);
                return { output: { deleted: true } };
            }

            case 'listPins': {
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const pageSize = Number(inputs.pageSize ?? 25);
                let qs = `/boards/${boardId}/pins?page_size=${pageSize}`;
                if (inputs.bookmark) qs += `&bookmark=${encodeURIComponent(String(inputs.bookmark))}`;
                const data = await pi('GET', qs);
                const items = (data?.items ?? []).map((p: any) => ({
                    id: p.id ?? '',
                    title: p.title ?? '',
                    link: p.link ?? '',
                    media: p.media ?? {},
                }));
                return { output: { items, bookmark: data?.bookmark ?? null } };
            }

            case 'getPin': {
                const pinId = String(inputs.pinId ?? '').trim();
                if (!pinId) throw new Error('pinId is required.');
                const data = await pi('GET', `/pins/${pinId}`);
                return {
                    output: {
                        id: data.id ?? '',
                        title: data.title ?? '',
                        description: data.description ?? '',
                        link: data.link ?? '',
                        media: data.media ?? {},
                        board_id: data.board_id ?? '',
                    },
                };
            }

            case 'createPin': {
                const boardId = String(inputs.boardId ?? '').trim();
                const mediaUrl = String(inputs.mediaUrl ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                if (!mediaUrl) throw new Error('mediaUrl is required.');
                const body: any = {
                    board_id: boardId,
                    media_source: {
                        source_type: 'image_url',
                        url: mediaUrl,
                    },
                };
                if (inputs.title) body.title = String(inputs.title);
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.link) body.link = String(inputs.link);
                if (inputs.altText) body.alt_text = String(inputs.altText);
                const data = await pi('POST', '/pins', body);
                logger.log(`[Pinterest] Pin created: ${data.id}`);
                return { output: { id: data.id ?? '', title: data.title ?? '' } };
            }

            case 'deletePin': {
                const pinId = String(inputs.pinId ?? '').trim();
                if (!pinId) throw new Error('pinId is required.');
                await pi('DELETE', `/pins/${pinId}`);
                return { output: { deleted: true } };
            }

            case 'getAnalytics': {
                const startDate = String(inputs.startDate ?? '').trim();
                const endDate = String(inputs.endDate ?? '').trim();
                if (!startDate) throw new Error('startDate is required.');
                if (!endDate) throw new Error('endDate is required.');
                const metricTypes = String(
                    inputs.metric_types ?? 'IMPRESSION,PIN_CLICK,OUTBOUND_CLICK,SAVE'
                );
                const data = await pi(
                    'GET',
                    `/user_account/analytics?start_date=${startDate}&end_date=${endDate}&metric_types=${metricTypes}`
                );
                return { output: { data: data ?? {} } };
            }

            case 'searchBoards': {
                const query = String(inputs.query ?? '').trim();
                if (!query) throw new Error('query is required.');
                const data = await pi('GET', `/search/boards?query=${encodeURIComponent(query)}`);
                return { output: { items: data?.items ?? [] } };
            }

            case 'listBoardSections': {
                const boardId = String(inputs.boardId ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                const data = await pi('GET', `/boards/${boardId}/sections`);
                const items = (data?.items ?? []).map((s: any) => ({
                    id: s.id ?? '',
                    name: s.name ?? '',
                }));
                return { output: { items } };
            }

            case 'createBoardSection': {
                const boardId = String(inputs.boardId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!boardId) throw new Error('boardId is required.');
                if (!name) throw new Error('name is required.');
                const data = await pi('POST', `/boards/${boardId}/sections`, { name });
                return { output: { id: data.id ?? '', name: data.name ?? '' } };
            }

            default:
                return { error: `Pinterest action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Pinterest action failed.' };
    }
}

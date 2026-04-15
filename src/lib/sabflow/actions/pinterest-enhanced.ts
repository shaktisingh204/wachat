'use server';

export async function executePinterestEnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken: string = inputs.accessToken || inputs.access_token;
        if (!accessToken) throw new Error('Missing Pinterest accessToken in inputs');

        const BASE = 'https://api.pinterest.com/v5';

        async function pinReq(
            method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
            path: string,
            body?: Record<string, any>,
            queryParams?: Record<string, string>
        ): Promise<any> {
            let url = path.startsWith('http') ? path : `${BASE}${path}`;
            if (queryParams && Object.keys(queryParams).length > 0) {
                url += `?${new URLSearchParams(queryParams).toString()}`;
            }
            const headers: Record<string, string> = {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            };
            const options: RequestInit = { method, headers };
            if (body && method !== 'GET' && method !== 'DELETE') {
                options.body = JSON.stringify(body);
            }
            const res = await fetch(url, options);
            if (res.status === 204) return { success: true };
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json?.message || json?.code || `Pinterest API error ${res.status}`);
            }
            return json;
        }

        switch (actionName) {
            case 'getUserAccount': {
                const result = await pinReq('GET', '/user_account');
                return { output: result };
            }

            case 'getBoard': {
                const boardId: string = inputs.boardId || inputs.board_id;
                if (!boardId) throw new Error('Missing boardId');
                const result = await pinReq('GET', `/boards/${boardId}`);
                return { output: result };
            }

            case 'listBoards': {
                const params: Record<string, string> = {};
                if (inputs.pageSize) params.page_size = String(inputs.pageSize);
                if (inputs.bookmark) params.bookmark = inputs.bookmark;
                if (inputs.privacy) params.privacy = inputs.privacy;
                const result = await pinReq('GET', '/boards', undefined, params);
                return { output: result };
            }

            case 'createBoard': {
                const name: string = inputs.name || inputs.boardName;
                if (!name) throw new Error('Missing board name');
                const body: Record<string, any> = { name };
                if (inputs.description) body.description = inputs.description;
                if (inputs.privacy) body.privacy = inputs.privacy;
                const result = await pinReq('POST', '/boards', body);
                return { output: result };
            }

            case 'deleteBoard': {
                const boardId: string = inputs.boardId || inputs.board_id;
                if (!boardId) throw new Error('Missing boardId');
                const result = await pinReq('DELETE', `/boards/${boardId}`);
                return { output: result };
            }

            case 'listPins': {
                const boardId: string = inputs.boardId || inputs.board_id;
                if (!boardId) throw new Error('Missing boardId');
                const params: Record<string, string> = {};
                if (inputs.pageSize) params.page_size = String(inputs.pageSize);
                if (inputs.bookmark) params.bookmark = inputs.bookmark;
                const result = await pinReq('GET', `/boards/${boardId}/pins`, undefined, params);
                return { output: result };
            }

            case 'getPin': {
                const pinId: string = inputs.pinId || inputs.pin_id;
                if (!pinId) throw new Error('Missing pinId');
                const result = await pinReq('GET', `/pins/${pinId}`);
                return { output: result };
            }

            case 'createPin': {
                const boardId: string = inputs.boardId || inputs.board_id;
                if (!boardId) throw new Error('Missing boardId');
                const body: Record<string, any> = {
                    board_id: boardId,
                    title: inputs.title || '',
                    description: inputs.description || '',
                };
                if (inputs.link) body.link = inputs.link;
                if (inputs.dominantColor) body.dominant_color = inputs.dominantColor;
                if (inputs.altText) body.alt_text = inputs.altText;
                if (inputs.boardSectionId) body.board_section_id = inputs.boardSectionId;
                if (inputs.imageUrl) {
                    body.media_source = { source_type: 'image_url', url: inputs.imageUrl };
                } else if (inputs.imageBase64) {
                    body.media_source = {
                        source_type: 'image_base64',
                        content_type: inputs.contentType || 'image/jpeg',
                        data: inputs.imageBase64,
                    };
                } else if (inputs.pinImageUrl) {
                    body.media_source = { source_type: 'pin_url', url: inputs.pinImageUrl };
                }
                const result = await pinReq('POST', '/pins', body);
                return { output: result };
            }

            case 'deletePin': {
                const pinId: string = inputs.pinId || inputs.pin_id;
                if (!pinId) throw new Error('Missing pinId');
                const result = await pinReq('DELETE', `/pins/${pinId}`);
                return { output: result };
            }

            case 'getPinAnalytics': {
                const pinId: string = inputs.pinId || inputs.pin_id;
                const startDate: string = inputs.startDate;
                const endDate: string = inputs.endDate;
                if (!pinId || !startDate || !endDate) throw new Error('Missing pinId, startDate, or endDate');
                const params: Record<string, string> = {
                    start_date: startDate,
                    end_date: endDate,
                    metric_types: inputs.metricTypes || 'IMPRESSION,OUTBOUND_CLICK,PIN_CLICK,SAVE',
                };
                if (inputs.appTypes) params.app_types = inputs.appTypes;
                const result = await pinReq('GET', `/pins/${pinId}/analytics`, undefined, params);
                return { output: result };
            }

            case 'getBoardAnalytics': {
                const boardId: string = inputs.boardId || inputs.board_id;
                const startDate: string = inputs.startDate;
                const endDate: string = inputs.endDate;
                if (!boardId || !startDate || !endDate) throw new Error('Missing boardId, startDate, or endDate');
                const params: Record<string, string> = {
                    start_date: startDate,
                    end_date: endDate,
                    metric_types: inputs.metricTypes || 'IMPRESSION,OUTBOUND_CLICK,PIN_CLICK,SAVE',
                };
                const result = await pinReq('GET', `/boards/${boardId}/analytics`, undefined, params);
                return { output: result };
            }

            case 'searchBoards': {
                const query: string = inputs.query || inputs.keywords;
                if (!query) throw new Error('Missing search query');
                const params: Record<string, string> = { query };
                if (inputs.pageSize) params.page_size = String(inputs.pageSize);
                if (inputs.bookmark) params.bookmark = inputs.bookmark;
                const result = await pinReq('GET', '/search/boards', undefined, params);
                return { output: result };
            }

            case 'searchPins': {
                const query: string = inputs.query || inputs.keywords;
                if (!query) throw new Error('Missing search query');
                const params: Record<string, string> = { query };
                if (inputs.pageSize) params.page_size = String(inputs.pageSize);
                if (inputs.bookmark) params.bookmark = inputs.bookmark;
                const result = await pinReq('GET', '/search/pins', undefined, params);
                return { output: result };
            }

            case 'listAdAccounts': {
                const params: Record<string, string> = {};
                if (inputs.pageSize) params.page_size = String(inputs.pageSize);
                if (inputs.bookmark) params.bookmark = inputs.bookmark;
                if (inputs.includeSharedAccounts !== undefined) params.include_shared_accounts = String(inputs.includeSharedAccounts);
                const result = await pinReq('GET', '/ad_accounts', undefined, params);
                return { output: result };
            }

            case 'getCampaigns': {
                const adAccountId: string = inputs.adAccountId || inputs.ad_account_id;
                if (!adAccountId) throw new Error('Missing adAccountId');
                const params: Record<string, string> = {};
                if (inputs.pageSize) params.page_size = String(inputs.pageSize);
                if (inputs.bookmark) params.bookmark = inputs.bookmark;
                if (inputs.campaignIds) params.campaign_ids = Array.isArray(inputs.campaignIds) ? inputs.campaignIds.join(',') : inputs.campaignIds;
                if (inputs.entityStatuses) params.entity_statuses = Array.isArray(inputs.entityStatuses) ? inputs.entityStatuses.join(',') : inputs.entityStatuses;
                const result = await pinReq('GET', `/ad_accounts/${adAccountId}/campaigns`, undefined, params);
                return { output: result };
            }

            default:
                return { error: `Pinterest Enhanced: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`Pinterest Enhanced action error [${actionName}]: ${err.message}`);
        return { error: err.message || 'Pinterest Enhanced action failed' };
    }
}

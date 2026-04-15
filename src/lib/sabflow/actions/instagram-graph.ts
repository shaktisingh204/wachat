'use server';

export async function executeInstagramGraphAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken: string = inputs.accessToken || inputs.access_token;
        if (!accessToken) throw new Error('Missing Instagram accessToken in inputs');

        const BASE = 'https://graph.facebook.com/v18.0';

        async function igReq(
            method: 'GET' | 'POST' | 'DELETE',
            path: string,
            body?: Record<string, any>,
            queryParams?: Record<string, string>
        ): Promise<any> {
            const params = new URLSearchParams({ access_token: accessToken, ...(queryParams || {}) });
            let url = path.startsWith('http') ? path : `${BASE}${path}`;
            url += `?${params.toString()}`;
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            const options: RequestInit = { method, headers };
            if (body && method !== 'GET' && method !== 'DELETE') {
                options.body = JSON.stringify(body);
            }
            const res = await fetch(url, options);
            const json = await res.json();
            if (!res.ok || json?.error) {
                throw new Error(json?.error?.message || `Instagram Graph API error ${res.status}`);
            }
            return json;
        }

        switch (actionName) {
            case 'getProfile': {
                const igUserId: string = inputs.igUserId || inputs.userId || 'me';
                const fields = inputs.fields || 'id,name,biography,followers_count,follows_count,media_count,profile_picture_url,website';
                const result = await igReq('GET', `/${igUserId}`, undefined, { fields });
                return { output: result };
            }

            case 'getMedia': {
                const igUserId: string = inputs.igUserId || inputs.userId;
                if (!igUserId) throw new Error('Missing igUserId');
                const fields = inputs.fields || 'id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count';
                const limit = inputs.limit || 20;
                const result = await igReq('GET', `/${igUserId}/media`, undefined, { fields, limit: String(limit) });
                return { output: result };
            }

            case 'getMediaInsights': {
                const mediaId: string = inputs.mediaId;
                if (!mediaId) throw new Error('Missing mediaId');
                const metric = inputs.metric || 'impressions,reach,engagement,saved';
                const result = await igReq('GET', `/${mediaId}/insights`, undefined, { metric });
                return { output: result };
            }

            case 'createImagePost': {
                const igUserId: string = inputs.igUserId || inputs.userId;
                const imageUrl: string = inputs.imageUrl;
                if (!igUserId || !imageUrl) throw new Error('Missing igUserId or imageUrl');
                // Step 1: Create container
                const container = await igReq('POST', `/${igUserId}/media`, undefined, {
                    image_url: imageUrl,
                    caption: inputs.caption || '',
                    ...(inputs.locationId ? { location_id: inputs.locationId } : {}),
                });
                // Step 2: Publish
                const result = await igReq('POST', `/${igUserId}/media_publish`, undefined, {
                    creation_id: container.id,
                });
                return { output: { containerId: container.id, publishedId: result.id } };
            }

            case 'createCarouselPost': {
                const igUserId: string = inputs.igUserId || inputs.userId;
                const imageUrls: string[] = inputs.imageUrls;
                if (!igUserId || !imageUrls?.length) throw new Error('Missing igUserId or imageUrls array');
                // Step 1: Create item containers
                const childIds: string[] = [];
                for (const url of imageUrls) {
                    const item = await igReq('POST', `/${igUserId}/media`, undefined, {
                        image_url: url,
                        is_carousel_item: 'true',
                    });
                    childIds.push(item.id);
                }
                // Step 2: Create carousel container
                const carousel = await igReq('POST', `/${igUserId}/media`, undefined, {
                    media_type: 'CAROUSEL',
                    children: childIds.join(','),
                    caption: inputs.caption || '',
                });
                // Step 3: Publish
                const result = await igReq('POST', `/${igUserId}/media_publish`, undefined, {
                    creation_id: carousel.id,
                });
                return { output: { carouselId: carousel.id, publishedId: result.id } };
            }

            case 'createStory': {
                const igUserId: string = inputs.igUserId || inputs.userId;
                const mediaUrl: string = inputs.mediaUrl || inputs.imageUrl;
                if (!igUserId || !mediaUrl) throw new Error('Missing igUserId or mediaUrl');
                const mediaType = inputs.mediaType || 'IMAGE';
                const params: Record<string, string> = {
                    media_type: `${mediaType}_STORIES`,
                };
                if (mediaType === 'VIDEO') {
                    params.video_url = mediaUrl;
                } else {
                    params.image_url = mediaUrl;
                }
                const container = await igReq('POST', `/${igUserId}/media`, undefined, params);
                const result = await igReq('POST', `/${igUserId}/media_publish`, undefined, { creation_id: container.id });
                return { output: { containerId: container.id, publishedId: result.id } };
            }

            case 'getComments': {
                const mediaId: string = inputs.mediaId;
                if (!mediaId) throw new Error('Missing mediaId');
                const fields = inputs.fields || 'id,text,username,timestamp';
                const result = await igReq('GET', `/${mediaId}/comments`, undefined, { fields });
                return { output: result };
            }

            case 'replyToComment': {
                const mediaId: string = inputs.mediaId;
                const message: string = inputs.message || inputs.text;
                if (!mediaId || !message) throw new Error('Missing mediaId or message');
                const result = await igReq('POST', `/${mediaId}/replies`, undefined, { message });
                return { output: result };
            }

            case 'deleteComment': {
                const commentId: string = inputs.commentId;
                if (!commentId) throw new Error('Missing commentId');
                const result = await igReq('DELETE', `/${commentId}`);
                return { output: result };
            }

            case 'getDMConversations': {
                const igUserId: string = inputs.igUserId || inputs.userId;
                if (!igUserId) throw new Error('Missing igUserId');
                const fields = inputs.fields || 'id,participants,updated_time';
                const result = await igReq('GET', `/${igUserId}/conversations`, undefined, { fields, platform: 'instagram' });
                return { output: result };
            }

            case 'getDMMessages': {
                const conversationId: string = inputs.conversationId;
                if (!conversationId) throw new Error('Missing conversationId');
                const fields = inputs.fields || 'id,message,from,created_time';
                const result = await igReq('GET', `/${conversationId}/messages`, undefined, { fields });
                return { output: result };
            }

            case 'sendDM': {
                const igUserId: string = inputs.igUserId || inputs.userId;
                const recipientId: string = inputs.recipientId;
                const message: string = inputs.message || inputs.text;
                if (!igUserId || !recipientId || !message) throw new Error('Missing igUserId, recipientId, or message');
                const result = await igReq('POST', `/${igUserId}/messages`, {
                    recipient: { id: recipientId },
                    message: { text: message },
                });
                return { output: result };
            }

            case 'getHashtagMedia': {
                const igUserId: string = inputs.igUserId || inputs.userId;
                const hashtagId: string = inputs.hashtagId;
                if (!igUserId || !hashtagId) throw new Error('Missing igUserId or hashtagId');
                const mediaType = inputs.mediaType || 'top_media';
                const fields = inputs.fields || 'id,caption,media_url,timestamp';
                const result = await igReq('GET', `/${hashtagId}/${mediaType}`, undefined, {
                    user_id: igUserId,
                    fields,
                });
                return { output: result };
            }

            case 'getAudienceInsights': {
                const igUserId: string = inputs.igUserId || inputs.userId;
                if (!igUserId) throw new Error('Missing igUserId');
                const metric = inputs.metric || 'audience_city,audience_country,audience_gender_age';
                const period = inputs.period || 'lifetime';
                const result = await igReq('GET', `/${igUserId}/insights`, undefined, { metric, period });
                return { output: result };
            }

            case 'schedulePost': {
                const igUserId: string = inputs.igUserId || inputs.userId;
                const imageUrl: string = inputs.imageUrl;
                const publishTime: string = inputs.publishTime;
                if (!igUserId || !imageUrl || !publishTime) throw new Error('Missing igUserId, imageUrl, or publishTime');
                const container = await igReq('POST', `/${igUserId}/media`, undefined, {
                    image_url: imageUrl,
                    caption: inputs.caption || '',
                    scheduled_publish_time: publishTime,
                    published: 'false',
                });
                return { output: { containerId: container.id, scheduledFor: publishTime } };
            }

            default:
                return { error: `Instagram Graph: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`Instagram Graph action error [${actionName}]: ${err.message}`);
        return { error: err.message || 'Instagram Graph action failed' };
    }
}

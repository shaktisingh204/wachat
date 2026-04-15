'use server';

export async function executeLinkedinEnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken: string = inputs.accessToken || inputs.access_token;
        if (!accessToken) throw new Error('Missing LinkedIn accessToken in inputs');

        const BASE = 'https://api.linkedin.com/v2';

        async function liReq(
            method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
            path: string,
            body?: any,
            extraHeaders?: Record<string, string>
        ): Promise<any> {
            const url = path.startsWith('http') ? path : `${BASE}${path}`;
            const headers: Record<string, string> = {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0',
                ...(extraHeaders || {}),
            };
            const options: RequestInit = { method, headers };
            if (body && method !== 'GET' && method !== 'DELETE') {
                options.body = JSON.stringify(body);
            }
            const res = await fetch(url, options);
            if (res.status === 204) return { success: true };
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json?.message || json?.status || `LinkedIn API error ${res.status}`);
            }
            return json;
        }

        switch (actionName) {
            case 'getProfile': {
                const fields = inputs.fields || 'id,firstName,lastName,emailAddress,headline,profilePicture(displayImage~:playableStreams)';
                const result = await liReq('GET', `/me?projection=(${encodeURIComponent(fields)})`);
                return { output: result };
            }

            case 'getOrganization': {
                const orgId: string = inputs.organizationId || inputs.orgId;
                if (!orgId) throw new Error('Missing organizationId');
                const result = await liReq('GET', `/organizations/${orgId}`);
                return { output: result };
            }

            case 'createPost': {
                const authorUrn: string = inputs.authorUrn || inputs.author;
                if (!authorUrn) throw new Error('Missing authorUrn (e.g. urn:li:person:{id})');
                const body = {
                    author: authorUrn,
                    lifecycleState: 'PUBLISHED',
                    specificContent: {
                        'com.linkedin.ugc.ShareContent': {
                            shareCommentary: { text: inputs.text || '' },
                            shareMediaCategory: 'NONE',
                        },
                    },
                    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': inputs.visibility || 'PUBLIC' },
                };
                const result = await liReq('POST', '/ugcPosts', body);
                return { output: result };
            }

            case 'deletePost': {
                const postId: string = inputs.postId || inputs.ugcPostId;
                if (!postId) throw new Error('Missing postId');
                const result = await liReq('DELETE', `/ugcPosts/${encodeURIComponent(postId)}`);
                return { output: result };
            }

            case 'listPosts': {
                const authorUrn: string = inputs.authorUrn || inputs.author;
                if (!authorUrn) throw new Error('Missing authorUrn');
                const count = inputs.count || 10;
                const result = await liReq('GET', `/ugcPosts?q=authors&authors=List(${encodeURIComponent(authorUrn)})&count=${count}`);
                return { output: result };
            }

            case 'getPostAnalytics': {
                const postUrn: string = inputs.postUrn || inputs.ugcPostUrn;
                if (!postUrn) throw new Error('Missing postUrn');
                const result = await liReq('GET', `/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(postUrn)}`);
                return { output: result };
            }

            case 'createImagePost': {
                const authorUrn: string = inputs.authorUrn || inputs.author;
                const imageUrn: string = inputs.imageUrn;
                if (!authorUrn || !imageUrn) throw new Error('Missing authorUrn or imageUrn');
                const body = {
                    author: authorUrn,
                    lifecycleState: 'PUBLISHED',
                    specificContent: {
                        'com.linkedin.ugc.ShareContent': {
                            shareCommentary: { text: inputs.text || '' },
                            shareMediaCategory: 'IMAGE',
                            media: [
                                {
                                    status: 'READY',
                                    media: imageUrn,
                                    title: { text: inputs.title || '' },
                                    description: { text: inputs.description || '' },
                                },
                            ],
                        },
                    },
                    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': inputs.visibility || 'PUBLIC' },
                };
                const result = await liReq('POST', '/ugcPosts', body);
                return { output: result };
            }

            case 'createVideoPost': {
                const authorUrn: string = inputs.authorUrn || inputs.author;
                const videoUrn: string = inputs.videoUrn;
                if (!authorUrn || !videoUrn) throw new Error('Missing authorUrn or videoUrn');
                const body = {
                    author: authorUrn,
                    lifecycleState: 'PUBLISHED',
                    specificContent: {
                        'com.linkedin.ugc.ShareContent': {
                            shareCommentary: { text: inputs.text || '' },
                            shareMediaCategory: 'VIDEO',
                            media: [
                                {
                                    status: 'READY',
                                    media: videoUrn,
                                    title: { text: inputs.title || '' },
                                },
                            ],
                        },
                    },
                    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': inputs.visibility || 'PUBLIC' },
                };
                const result = await liReq('POST', '/ugcPosts', body);
                return { output: result };
            }

            case 'searchPeople': {
                const keywords: string = inputs.keywords || inputs.query;
                if (!keywords) throw new Error('Missing keywords for people search');
                const count = inputs.count || 10;
                const result = await liReq('GET', `/people?q=blended&keywords=${encodeURIComponent(keywords)}&count=${count}`);
                return { output: result };
            }

            case 'searchCompanies': {
                const keywords: string = inputs.keywords || inputs.query;
                if (!keywords) throw new Error('Missing keywords for company search');
                const count = inputs.count || 10;
                const result = await liReq('GET', `/organizations?q=search&keywords=${encodeURIComponent(keywords)}&count=${count}`);
                return { output: result };
            }

            case 'sendMessage': {
                const recipientUrn: string = inputs.recipientUrn;
                const messageText: string = inputs.messageText || inputs.text;
                if (!recipientUrn || !messageText) throw new Error('Missing recipientUrn or messageText');
                const body = {
                    recipients: [recipientUrn],
                    subject: inputs.subject || '',
                    body: messageText,
                };
                const result = await liReq('POST', '/messages', body);
                return { output: result };
            }

            case 'getConnections': {
                const count = inputs.count || 50;
                const start = inputs.start || 0;
                const result = await liReq('GET', `/connections?q=viewer&start=${start}&count=${count}`);
                return { output: result };
            }

            case 'getFollowers': {
                const memberUrn: string = inputs.memberUrn;
                if (!memberUrn) throw new Error('Missing memberUrn');
                const result = await liReq('GET', `/socialActions/${encodeURIComponent(memberUrn)}/followers`);
                return { output: result };
            }

            case 'getOrganizationFollowers': {
                const orgUrn: string = inputs.organizationUrn || inputs.orgUrn;
                if (!orgUrn) throw new Error('Missing organizationUrn');
                const result = await liReq('GET', `/organizationFollowerStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}`);
                return { output: result };
            }

            case 'createArticle': {
                const authorUrn: string = inputs.authorUrn || inputs.author;
                const articleUrl: string = inputs.articleUrl;
                if (!authorUrn || !articleUrl) throw new Error('Missing authorUrn or articleUrl');
                const body = {
                    author: authorUrn,
                    lifecycleState: 'PUBLISHED',
                    specificContent: {
                        'com.linkedin.ugc.ShareContent': {
                            shareCommentary: { text: inputs.commentary || '' },
                            shareMediaCategory: 'ARTICLE',
                            media: [
                                {
                                    status: 'READY',
                                    originalUrl: articleUrl,
                                    title: { text: inputs.title || '' },
                                    description: { text: inputs.description || '' },
                                },
                            ],
                        },
                    },
                    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': inputs.visibility || 'PUBLIC' },
                };
                const result = await liReq('POST', '/ugcPosts', body);
                return { output: result };
            }

            default:
                return { error: `LinkedIn Enhanced: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`LinkedIn Enhanced action error [${actionName}]: ${err.message}`);
        return { error: err.message || 'LinkedIn Enhanced action failed' };
    }
}

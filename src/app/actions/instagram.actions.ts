

import { getProjectById } from '@/app/actions';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';

const API_VERSION = 'v23.0';

export async function getInstagramAccountForPage(projectId: string): Promise<{ instagramAccount?: any; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.facebookPageId || !project.accessToken) {
        return { error: 'Project not found or is not configured for Facebook.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${project.facebookPageId}`, {
            params: {
                fields: 'instagram_business_account{id,username,profile_picture_url,followers_count,media_count,account_type}',
                access_token: project.accessToken,
            }
        });

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        const instagramAccount = response.data.instagram_business_account;
        return { instagramAccount };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getInstagramMedia(projectId: string): Promise<{ media?: any[]; error?: string }> {
    const { instagramAccount, error: accountError } = await getInstagramAccountForPage(projectId);
    if (accountError || !instagramAccount?.id) {
        return { error: accountError || 'Instagram account not found.' };
    }
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found' };

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${instagramAccount.id}/media`, {
            params: {
                fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count',
                access_token: project.accessToken
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({response}));
        return { media: response.data.data || [] };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getInstagramMediaDetails(projectId: string, mediaId: string): Promise<{ media?: any; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or is missing access token.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${mediaId}`, {
            params: {
                fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count,comments{id,text,timestamp,username,from,replies}',
                access_token: project.accessToken
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { media: response.data };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getInstagramComments(mediaId: string, projectId: string): Promise<{ comments?: any[]; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project access denied or misconfigured.' };
    }
    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${mediaId}/comments`, {
            params: {
                fields: 'id,username,text,timestamp,from',
                access_token: project.accessToken
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({response}));
        return { comments: response.data.data || [] };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getInstagramStories(projectId: string): Promise<{ stories?: any[]; error?: string }> {
    const { instagramAccount, error: accountError } = await getInstagramAccountForPage(projectId);
    if (accountError || !instagramAccount?.id) {
        return { error: accountError || 'Instagram account not found.' };
    }
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found' };

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${instagramAccount.id}/stories`, {
            params: {
                access_token: project.accessToken
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({response}));
        return { stories: response.data.data || [] };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function discoverInstagramAccount(username: string, projectId: string): Promise<{ account?: any; error?: string }> {
    const { instagramAccount, error: accountError } = await getInstagramAccountForPage(projectId);
    if (accountError || !instagramAccount?.id) {
        return { error: accountError || 'Could not find your own Instagram account to perform the discovery.' };
    }
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found' };

    try {
        const fields = `business_discovery.username(${username}){followers_count,media_count,name,profile_picture_url,media{caption,media_url}}`;
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${instagramAccount.id}`, {
            params: {
                fields: fields,
                access_token: project.accessToken
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));

        return { account: response.data.business_discovery };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function createInstagramImagePost(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const imageUrl = formData.get('imageUrl') as string;
    const caption = formData.get('caption') as string;

    if (!projectId || !imageUrl) {
        return { error: "Project ID and Image URL are required." };
    }

    const { instagramAccount, error: accountError } = await getInstagramAccountForPage(projectId);
    if (accountError || !instagramAccount?.id) {
        return { error: accountError || 'Could not find your Instagram account.' };
    }

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project access token is missing.' };
    }
    
    try {
        // Step 1: Create media container
        const containerResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/${instagramAccount.id}/media`, {
            image_url: imageUrl,
            caption: caption,
            access_token: project.accessToken,
        });

        const creationId = containerResponse.data?.id;
        if (!creationId) {
            throw new Error("Failed to create media container.");
        }

        // Step 2: Publish the container
        const publishResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/${instagramAccount.id}/media_publish`, {
            creation_id: creationId,
            access_token: project.accessToken,
        });
        
        if (publishResponse.data.id) {
            return { message: "Instagram post published successfully!" };
        } else {
            throw new Error("Publishing failed after container creation.");
        }
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function searchHashtagId(hashtag: string, projectId: string): Promise<{ hashtagId?: string; error?: string }> {
    const { instagramAccount, error: accountError } = await getInstagramAccountForPage(projectId);
    if (accountError || !instagramAccount?.id) {
        return { error: accountError || 'Could not find your own Instagram account to perform the search.' };
    }
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found' };

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/ig_hashtag_search`, {
            params: {
                user_id: instagramAccount.id,
                q: hashtag,
                access_token: project.accessToken
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        
        const hashtagId = response.data.data?.[0]?.id;
        return { hashtagId };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getHashtagRecentMedia(hashtagId: string, projectId: string): Promise<{ media?: any[]; error?: string }> {
    const { instagramAccount, error: accountError } = await getInstagramAccountForPage(projectId);
    if (accountError || !instagramAccount?.id) {
        return { error: accountError || 'Could not find your own Instagram account.' };
    }
    const project = await getProjectById(projectId);
    if (!project) return { error: 'Project not found' };
    
    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${hashtagId}/recent_media`, {
            params: {
                user_id: instagramAccount.id,
                fields: 'id,caption,media_type,media_url,permalink,timestamp',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { media: response.data.data || [] };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

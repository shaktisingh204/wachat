
'use client';

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
                fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count',
                access_token: project.accessToken
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { media: response.data };
    } catch (e) {
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
        const fields = `business_discovery.username(${username}){followers_count,media_count,name,profile_picture_url,media{id,caption,media_type,media_url,permalink}}`;
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

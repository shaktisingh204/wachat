

'use server';

import { revalidatePath } from 'next/cache';
import axios from 'axios';
import { ObjectId, type WithId } from 'mongodb';
import FormData from 'form-data';

import { getErrorMessage } from '@/lib/utils';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById, getSession } from '@/app/actions/index.ts';
import { getEcommShopById } from './custom-ecommerce.actions';
import type { Project, FacebookPage, FacebookPost, FacebookPageDetails, PageInsights, FacebookConversation, FacebookMessage, FacebookCommentAutoReplySettings, PostRandomizerSettings, RandomizerPost, FacebookBroadcast, FacebookLiveStream, FacebookSubscriber, FacebookWelcomeMessageSettings, FacebookOrder, User, MetaWabasResponse } from '@/lib/definitions';
import { processMessengerWebhook } from '@/lib/webhook-processor';
import { _createProjectFromWaba } from './whatsapp.actions';


async function handleSubscribeFacebookPageWebhook(pageId: string, pageAccessToken: string): Promise<{ success: boolean, error?: string }> {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    if (!appId) {
        console.warn(`Could not subscribe page ${pageId}: NEXT_PUBLIC_FACEBOOK_APP_ID is not set.`);
        return { success: false, error: "Server APP_ID not configured." };
    }
    try {
        const subscribedFields = 'messages,messaging_postbacks,feed,ratings,videos,live_videos,message_reactions';
        const response = await axios.post(`https://graph.facebook.com/v23.0/${pageId}/subscribed_apps`, {
            subscribed_fields: subscribedFields,
            access_token: pageAccessToken
        });
        
        if (response.data.success) {
            console.log(`Successfully subscribed page ${pageId} to webhooks.`);
            return { success: true };
        } else {
            console.warn(`Failed to subscribe page ${pageId} to webhooks.`, response.data.error);
            return { success: false, error: getErrorMessage({response}) };
        }
    } catch (e: any) {
        console.error(`Error subscribing page ${pageId} to webhooks:`, getErrorMessage(e));
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function handleFacebookPageSetup(data: {
    projectId: string;
    facebookPageId: string;
    accessToken: string;
}): Promise<{ success?: boolean; error?: string }> {
    const { projectId, facebookPageId, accessToken } = data;

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };

    if (!facebookPageId || !accessToken) {
        return { error: 'Required information (Page ID, Token) was not received from Facebook.' };
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { facebookPageId, accessToken } }
        );
        revalidatePath('/dashboard/facebook');
        revalidatePath('/dashboard/facebook/settings');
        revalidatePath('/dashboard/facebook/all-projects');
        return { success: true };
    } catch (e: any) {
        return { error: 'Failed to save marketing settings.' };
    }
}

export async function handleFacebookOAuthCallback(code: string, state: string): Promise<{ success: boolean; error?: string, redirectPath?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied." };
    
    let appId, appSecret;
    if (state === 'whatsapp') {
        appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
        appSecret = process.env.META_ONBOARDING_APP_SECRET;
    } else if (state === 'instagram') {
        appId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID;
        appSecret = process.env.INSTAGRAM_APP_SECRET;
    } else { // 'facebook' and 'ad_manager'
        appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
        appSecret = process.env.FACEBOOK_APP_SECRET;
    }
    
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
        return { success: false, error: 'Server is not configured for authentication. NEXT_PUBLIC_APP_URL is not set.' };
    }
    const redirectUri = new URL('/auth/facebook/callback', appUrl).toString();

    if (!appId || !appSecret) {
        return { success: false, error: `Server is not configured for ${state} authentication. Please ensure credentials are set in your environment variables.` };
    }

    try {
        const tokenResponse = await axios.get('https://graph.facebook.com/v23.0/oauth/access_token', {
            params: { client_id: appId, redirect_uri: redirectUri, client_secret: appSecret, code: code }
        });
        const shortLivedToken = tokenResponse.data.access_token;
        if (!shortLivedToken) return { success: false, error: 'Failed to obtain access token from Facebook.' };
        
        const longLivedResponse = await axios.get('https://graph.facebook.com/v23.0/oauth/access_token', {
            params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: shortLivedToken }
        });
        const longLivedToken = longLivedResponse.data.access_token;
        if (!longLivedToken) return { success: false, error: 'Could not obtain a long-lived token from Facebook.' };

        const { db } = await connectToDatabase();

        if (state === 'whatsapp') {
            await db.collection('users').updateOne(
                { _id: new ObjectId(session.user._id) },
                { $set: { metaSuiteAccessToken: longLivedToken } }
            );
            const businessesResponse = await axios.get(`https://graph.facebook.com/v23.0/me/businesses`, {
                params: { access_token: longLivedToken }
            });
            const businesses = businessesResponse.data.data;
            
            if (!businesses || businesses.length === 0) {
                 return { success: false, error: "No Meta Business Accounts found for your user. Please ensure your account is connected to a business in Meta Business Suite." };
            }

            let allWabas: any[] = [];
            for (const business of businesses) {
                try {
                    const wabasResponse = await axios.get<{data: any[]}>(`https://graph.facebook.com/v23.0/${business.id}/owned_whatsapp_business_accounts`, {
                        params: { access_token: longLivedToken }
                    });
                    if (wabasResponse.data.data) {
                        allWabas.push(...wabasResponse.data.data);
                    }
                } catch (e: any) {
                    console.warn(`Could not fetch WABAs for business ${business.id}: ${getErrorMessage(e)}`);
                }
            }
            
            if (allWabas.length === 0) {
                return { success: false, error: "No WhatsApp Business Accounts found for your user. Please ensure you have a WABA connected to your account in Meta Business Suite and have granted the necessary permissions." };
            }

            await Promise.all(
                allWabas.map(async (waba) => {
                    await _createProjectFromWaba({
                        wabaId: waba.id,
                        appId,
                        accessToken: longLivedToken,
                        userId: session.user._id.toString(),
                    });
                })
            );

            revalidatePath('/dashboard');
            return { success: true, redirectPath: '/dashboard' };

        } else if (state === 'facebook' || state === 'instagram') {
             const pagesResponse = await axios.get('https://graph.facebook.com/v23.0/me/accounts', { 
                params: { fields: 'id,name,access_token', access_token: longLivedToken }
            });
            const userPagesWithShortTokens = pagesResponse.data?.data;
            if (!userPagesWithShortTokens || userPagesWithShortTokens.length === 0) {
                 return { success: false, error: 'No manageable Facebook Pages found. Please ensure you granted access to at least one page.' };
            }
            
            const pagesWithTokens = (await Promise.all(
                userPagesWithShortTokens.map(async (page: any) => {
                    try {
                        const pageTokenResponse = await axios.get('https://graph.facebook.com/v23.0/oauth/access_token', {
                            params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: page.access_token }
                        });
                        return { ...page, access_token: pageTokenResponse.data.access_token };
                    } catch (e) {
                        return null;
                    }
                })
            )).filter(Boolean);

             await db.collection('users').updateOne(
                { _id: new ObjectId(session.user._id) },
                { $set: { metaSuiteAccessToken: longLivedToken } }
            );

            const bulkOps = pagesWithTokens.map((page: any) => ({
                updateOne: {
                    filter: { userId: new ObjectId(session.user._id), facebookPageId: page.id },
                    update: {
                        $set: { name: page.name, accessToken: page.access_token },
                        $setOnInsert: { userId: new ObjectId(session.user._id), facebookPageId: page.id, createdAt: new Date() }
                    },
                    upsert: true,
                },
            }));
            if (bulkOps.length > 0) {
                await db.collection('projects').bulkWrite(bulkOps);
            }
            for (const page of pagesWithTokens) {
                await handleSubscribeFacebookPageWebhook(page.id, page.access_token);
            }
            
            let redirectPath = state === 'instagram' ? '/dashboard/instagram/connections' : '/dashboard/facebook/all-projects';
            revalidatePath('/dashboard/facebook/all-projects');
            revalidatePath('/dashboard/instagram/connections');
            return { success: true, redirectPath };
            
        } else if (state === 'ad_manager') {
            const userUpdateData: any = {
                adManagerAccessToken: longLivedToken,
            };
            const adAccountsResponse = await axios.get(`https://graph.facebook.com/v23.0/me/adaccounts`, { params: { access_token: longLivedToken, fields: 'id,name,account_id' }});
            const adAccounts = adAccountsResponse.data?.data || [];
            if (adAccounts.length > 0) {
                userUpdateData.metaAdAccounts = adAccounts.map((acc: any) => ({ id: acc.id, name: acc.name, account_id: acc.account_id }));
            }

             await db.collection('users').updateOne(
               { _id: new ObjectId(session.user._id) },
               { $set: userUpdateData }
           );
           revalidatePath('/dashboard/ad-manager/ad-accounts');
           return { success: true, redirectPath: '/dashboard/ad-manager/ad-accounts' };
        }
        
        return { success: false, error: 'Invalid state received during authentication.' };

    } catch(e) {
        console.error("Facebook OAuth Callback failed:", getErrorMessage(e));
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function handleManualFacebookPageSetup(prevState: any, formData: FormData): Promise<{ success?: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied." };

    const projectName = formData.get('projectName') as string;
    const facebookPageId = formData.get('facebookPageId') as string;
    const accessToken = formData.get('accessToken') as string;

    if (!projectName || !facebookPageId || !accessToken) {
        return { error: 'All fields are required for manual setup.' };
    }

    try {
        const { db } = await connectToDatabase();
        
        const existingProject = await db.collection('projects').findOne({
            userId: new ObjectId(session.user._id),
            facebookPageId: facebookPageId
        });

        if (existingProject) {
            return { error: 'You have already connected this Facebook Page.' };
        }

        const newProject: Omit<Project, '_id' | 'adAccountId'> = {
            userId: new ObjectId(session.user._id),
            name: projectName,
            facebookPageId: facebookPageId,
            accessToken: accessToken,
            phoneNumbers: [],
            createdAt: new Date(),
            messagesPerSecond: 80,
        };

        const result = await db.collection('projects').insertOne(newProject as any);
        
        if (result.insertedId) {
            await handleSubscribeFacebookPageWebhook(facebookPageId, accessToken);
        }

        revalidatePath('/dashboard/facebook/all-projects');
        return { success: true };

    } catch (e: any) {
        return { error: 'Failed to save manual project settings.' };
    }
}


export async function getFacebookPages(): Promise<{ pages?: FacebookPage[], error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'User not logged in.' };
    
    const { db } = await connectToDatabase();
    const user = await db.collection<User>('users').findOne({ _id: new ObjectId(session.user._id) });

    if (!user || !user.metaSuiteAccessToken) {
        return { error: 'Facebook account not connected or user access token is missing. Please go to Project Connections and reconnect.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/me/accounts`, {
            params: {
                fields: 'id,name,category,tasks',
                access_token: user.metaSuiteAccessToken,
            }
        });

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }
        
        return { pages: response.data.data || [] };

    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        if (errorMessage.includes('Session has expired') || errorMessage.includes('invalid') || errorMessage.includes('token')) {
             return { error: 'Your Facebook connection has expired or is invalid. Please go to Project Connections and reconnect.' };
        }
        return { error: errorMessage };
    }
}

export async function getPageDetails(projectId: string): Promise<{ page?: FacebookPageDetails, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or is missing Facebook Page ID or access token.' };
    }

    try {
        const fields = 'id,name,about,category,fan_count,followers_count,link,location,phone,website,picture.width(100).height(100)';
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}`, {
            params: {
                fields: fields,
                access_token: project.accessToken,
            }
        });

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }
        
        return { page: response.data };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getFacebookPosts(projectId: string): Promise<{ posts?: FacebookPost[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or is missing Facebook Page ID or access token.' };
    }

    try {
        const fields = 'id,message,permalink_url,created_time,full_picture,reactions.summary(true),comments.summary(true),shares';
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/posts`, {
            params: {
                fields: fields,
                access_token: project.accessToken,
                limit: 25,
            }
        });
        
        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        return { posts: response.data.data || [] };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function handleCreateFacebookPost(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const postType = formData.get('postType') as 'text' | 'image' | 'video';
    const message = formData.get('message') as string;
    const mediaUrl = formData.get('mediaUrl') as string;
    const mediaFile = formData.get('mediaFile') as File;
    const isScheduled = formData.get('isScheduled') === 'on';
    const scheduledDate = formData.get('scheduledDate') as string;
    const scheduledTime = formData.get('scheduledTime') as string;
    const tags = formData.get('tags') as string;


    if (!projectId || !postType) {
        return { error: 'Project ID and post type are required.' };
    }

    const project = await getProjectById(projectId);
    if (!project || !project.facebookPageId || !project.accessToken) {
        return { error: 'Project is not fully configured for Facebook posting.' };
    }

    const { facebookPageId, accessToken } = project;
    const apiVersion = 'v23.0';
    let endpoint = '';
    const form = new FormData();
    form.append('access_token', accessToken);

    if (isScheduled) {
        if (!scheduledDate || !scheduledTime) {
            return { error: 'A date and time are required for scheduling.' };
        }
        const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
        if (isNaN(scheduledDateTime.getTime())) {
            return { error: 'Invalid date or time format.' };
        }
        form.append('scheduled_publish_time', String(Math.floor(scheduledDateTime.getTime() / 1000)));
        form.append('published', 'false');
    }
    
    try {
        if (postType === 'text') {
            if (!message) return { error: 'Message is required for a text post.' };
            form.append('message', message);
            endpoint = `/${facebookPageId}/feed`;
        } else if (postType === 'image') {
            if (!mediaUrl && (!mediaFile || mediaFile.size === 0)) return { error: 'An image URL or file is required.' };
            endpoint = `/${facebookPageId}/photos`;
            if (message) form.append('caption', message);
            
            if (tags) {
                const tagObjects = tags.split(',').map(id => ({ tag_uid: id.trim() }));
                form.append('tags', JSON.stringify(tagObjects));
            }
            
            if (mediaUrl) {
                form.append('url', mediaUrl);
            } else {
                 form.append('source', Buffer.from(await mediaFile.arrayBuffer()), { filename: mediaFile.name, contentType: mediaFile.type });
            }
        } else if (postType === 'video') {
             if (!mediaUrl && (!mediaFile || mediaFile.size === 0)) return { error: 'A video URL or file is required.' };
            endpoint = `/${facebookPageId}/videos`;
             if (message) form.append('description', message);
             if (mediaUrl) {
                form.append('file_url', mediaUrl);
            } else { 
                form.append('source', Buffer.from(await mediaFile.arrayBuffer()), { filename: mediaFile.name, contentType: mediaFile.type });
            }
        }
        
        await axios.post(`https://graph.facebook.com/${apiVersion}${endpoint}`, form, {
            headers: { 
                ...form.getHeaders() 
            },
        });

        revalidatePath('/dashboard/facebook/posts');
        revalidatePath('/dashboard/facebook/scheduled');
        const successMessage = isScheduled ? 'Post scheduled successfully!' : 'Post created successfully!';
        return { message: successMessage };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleUpdatePost(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const postId = formData.get('postId') as string;
    const message = formData.get('message') as string;

    if (!projectId || !postId || !message) {
        return { success: false, error: 'Missing required information.' };
    }

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied or project not configured.' };
    }

    try {
        await axios.post(`https://graph.facebook.com/v23.0/${postId}`, {
            message: message,
            access_token: project.accessToken
        });
        revalidatePath('/dashboard/facebook/posts');
        revalidatePath('/dashboard/facebook/scheduled');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function handleDeletePost(postId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
     if (!projectId || !postId) {
        return { success: false, error: 'Missing required information.' };
    }

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied or project not configured.' };
    }

    try {
        await axios.delete(`https://graph.facebook.com/v23.0/${postId}`, {
            params: { access_token: project.accessToken }
        });
        revalidatePath('/dashboard/facebook/posts');
        revalidatePath('/dashboard/facebook/scheduled');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function handleAddVideoThumbnail(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const videoId = formData.get('videoId') as string;
    const thumbnailFile = formData.get('thumbnailFile') as File;
    
    if (!projectId || !videoId || !thumbnailFile || thumbnailFile.size === 0) {
        return { success: false, error: 'Missing required fields.' };
    }

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied or project not configured.' };
    }
    
    try {
        const form = new FormData();
        form.append('source', Buffer.from(await thumbnailFile.arrayBuffer()), { filename: thumbnailFile.name, contentType: thumbnailFile.type });
        form.append('access_token', project.accessToken);

        await axios.post(`https://graph.facebook.com/v23.0/${videoId}/thumbnails`, form, {
            headers: { ...form.getHeaders() },
        });

        revalidatePath('/dashboard/facebook/posts');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getEligibleCrosspostPages(postId: string, projectId: string): Promise<{pages: FacebookPage[], error?: string}> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { pages: [], error: 'Access denied or project not configured.' };
    }
    
    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${postId}/crosspost_eligible_pages`, {
            params: { access_token: project.accessToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({response}));
        return { pages: response.data.data || [] };
    } catch (e: any) {
        return { pages: [], error: getErrorMessage(e) };
    }
}


export async function handleCrosspostVideo(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const postId = formData.get('postId') as string;
    const targetPageIds = formData.getAll('targetPageIds') as string[];

    if (!projectId || !postId || targetPageIds.length === 0) {
        return { success: false, error: 'Missing required information.' };
    }
    
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied or project not configured.' };
    }
    
    try {
        await axios.post(`https://graph.facebook.com/v23.0/${postId}/crosspost`, {
            crossposted_pages: targetPageIds,
            access_token: project.accessToken
        });

        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function handleUpdatePageDetails(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const pageId = formData.get('pageId') as string;
    
    if (!projectId || !pageId) {
        return { success: false, error: 'Missing required IDs.' };
    }

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied or project not configured.' };
    }
    
    const payload: any = { access_token: project.accessToken };
    const fieldsToUpdate = ['about', 'phone', 'website'];
    
    fieldsToUpdate.forEach(field => {
        const value = formData.get(field) as string | null;
        if (value !== null) { 
            payload[field] = value;
        }
    });

    try {
        await axios.post(`https://graph.facebook.com/v23.0/${pageId}`, payload);
        revalidatePath('/dashboard/facebook');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getPageInsights(projectId: string): Promise<{ insights?: PageInsights, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or is missing Facebook Page ID or access token.' };
    }

    try {
        const metrics = 'page_impressions_unique,page_post_engagements';
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/insights`, {
            params: {
                metric: metrics,
                period: 'day',
                access_token: project.accessToken,
            }
        });

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        const insightsData = response.data.data;
        const pageReach = insightsData.find((m: any) => m.name === 'page_impressions_unique')?.values?.[0]?.value || 0;
        const postEngagement = insightsData.find((m: any) => m.name === 'page_post_engagements')?.values?.[0]?.value || 0;

        return { insights: { pageReach, postEngagement } };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handlePostComment(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const objectId = formData.get('objectId') as string; // Post or Video or Comment ID
    const message = formData.get('message') as string;

    if (!projectId || !objectId || !message) {
        return { success: false, error: 'Missing required information.' };
    }

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied or project not configured.' };
    }

    try {
        await axios.post(`https://graph.facebook.com/v23.0/${objectId}/comments`, {
            message,
            access_token: project.accessToken
        });
        revalidatePath('/dashboard/facebook/posts');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function handleDeleteComment(commentId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
     if (!projectId || !commentId) {
        return { success: false, error: 'Missing required information.' };
    }

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied or project not configured.' };
    }

    try {
        await axios.delete(`https://graph.facebook.com/v23.0/${commentId}`, {
            params: { access_token: project.accessToken }
        });
        revalidatePath('/dashboard/facebook/posts');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function handleLikeObject(objectId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    if (!projectId || !objectId) {
        return { success: false, error: 'Missing required information.' };
    }
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied or project not configured.' };
    }

    try {
        await axios.post(`https://graph.facebook.com/v23.0/${objectId}/likes`, {
            access_token: project.accessToken
        });
        revalidatePath('/dashboard/facebook/posts');
        return { success: true };
    } catch (e: any) {
        // Facebook returns an error if you try to like something twice, so we can ignore that specific error.
        if (getErrorMessage(e).includes('already liked')) {
             return { success: true }; // Already liked
        }
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getScheduledPosts(projectId: string): Promise<{ posts?: FacebookPost[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or is missing Facebook Page ID or access token.' };
    }

    try {
        // full_picture and permalink_url are not available for unpublished posts
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/scheduled_posts`, {
            params: {
                fields: 'id,message,created_time,scheduled_publish_time',
                access_token: project.accessToken,
                limit: 100,
            }
        });
        
        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        return { posts: response.data.data || [] };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function publishScheduledPost(postId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    if (!projectId || !postId) {
        return { success: false, error: 'Missing required information.' };
    }

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied or project not configured.' };
    }

    try {
        await axios.post(`https://graph.facebook.com/v23.0/${postId}`, {
            is_published: true,
            access_token: project.accessToken
        });
        revalidatePath('/dashboard/facebook/posts');
        revalidatePath('/dashboard/facebook/scheduled');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getFacebookConversations(projectId: string): Promise<{ conversations?: FacebookConversation[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or is missing Facebook Page ID or access token.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/conversations`, {
            params: {
                fields: 'id,snippet,unread_count,updated_time,participants,can_reply',
                access_token: project.accessToken,
                platform: 'messenger',
            }
        });

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }
        
        return { conversations: response.data.data || [] };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getFacebookConversationMessages(conversationId: string, projectId: string): Promise<{ messages?: FacebookMessage[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or is missing access token.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${conversationId}/messages`, {
            params: {
                fields: 'id,created_time,from,to,message',
                access_token: project.accessToken,
            }
        });

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }
        
        // Return messages in chronological order
        return { messages: (response.data.data || []).reverse() };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function sendFacebookMessage(prevState: any, formData: FormData): Promise<{ success?: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const recipientId = formData.get('recipientId') as string; // PSID
    const messageText = formData.get('messageText') as string;

    if (!projectId || !recipientId || !messageText) {
        return { error: 'Missing required information to send message.' };
    }
    
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token missing.' };
    }

    try {
        const response = await axios.post(`https://graph.facebook.com/v23.0/me/messages`, 
            {
                recipient: { id: recipientId },
                messaging_type: "RESPONSE",
                message: { text: messageText },
            },
            {
                params: { access_token: project.accessToken }
            }
        );

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        revalidatePath('/dashboard/facebook/messages');
        return { success: true };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function getFacebookChatInitialData(projectId: string): Promise<{
    project: WithId<Project> | null,
    conversations: FacebookConversation[],
    error?: string
}> {
    const project = await getProjectById(projectId);
    if (!project) {
        return { project: null, conversations: [], error: "Project not found." };
    }
    
    const { conversations, error } = await getFacebookConversations(projectId);
    
    if (error) {
        return { project, conversations: [], error };
    }
    
    return {
        project: JSON.parse(JSON.stringify(project)),
        conversations: conversations || [],
    };
}

export async function handleUpdateFacebookAutomationSettings(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    if (!projectId) return { success: false, error: 'Project ID is missing.' };

    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Access denied or project not found.' };

    const automationType = formData.get('automationType') as 'comment' | 'welcome';

    try {
        const { db } = await connectToDatabase();
        let settingsUpdate: any = {};

        if (automationType === 'comment') {
            const settings: FacebookCommentAutoReplySettings = {
                enabled: formData.get('enabled') === 'on',
                replyMode: formData.get('replyMode') as 'static' | 'ai',
                staticReplyText: formData.get('staticReplyText') as string,
                aiReplyPrompt: formData.get('aiReplyPrompt') as string,
                moderationEnabled: formData.get('moderationEnabled') === 'on',
                moderationPrompt: formData.get('moderationPrompt') as string,
            };
            settingsUpdate = { facebookCommentAutoReply: settings };
        } else if (automationType === 'welcome') {
             const quickRepliesJSON = formData.get('quickReplies') as string;
             const quickReplies = quickRepliesJSON ? JSON.parse(quickRepliesJSON) : [];
            
             const settings: FacebookWelcomeMessageSettings = {
                enabled: formData.get('enabled') === 'on',
                message: formData.get('message') as string,
                quickReplies: quickReplies,
            };
             settingsUpdate = { facebookWelcomeMessage: settings };
        } else {
            return { success: false, error: 'Invalid automation type specified.' };
        }
        
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: settingsUpdate }
        );

        revalidatePath('/dashboard/facebook/auto-reply');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// --- Post Randomizer Actions ---

export async function saveRandomizerSettings(prevState: any, formData: FormData): Promise<{ success: boolean, error?: string }> {
    const projectId = formData.get('projectId') as string;
    if (!projectId) return { success: false, error: 'Project ID is required.' };
    
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { success: false, error: 'Access denied.' };

    try {
        const settings: PostRandomizerSettings = {
            enabled: formData.get('enabled') === 'on',
            frequencyHours: Number(formData.get('frequencyHours')),
        };

        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { postRandomizer: settings } }
        );
        revalidatePath('/dashboard/facebook/post-randomizer');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getRandomizerPosts(projectId: string): Promise<WithId<RandomizerPost>[]> {
    if (!ObjectId.isValid(projectId)) return [];
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const posts = await db.collection<RandomizerPost>('randomizer_posts')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(posts));
    } catch (e) {
        console.error('Failed to get randomizer posts:', e);
        return [];
    }
}

export async function addRandomizerPost(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const message = formData.get('message') as string;
    const imageUrl = formData.get('imageUrl') as string;

    if (!projectId || !message) {
        return { success: false, error: 'Project and message are required.' };
    }
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { success: false, error: 'Access denied.' };

    try {
        const newPost: Omit<RandomizerPost, '_id'> = {
            projectId: new ObjectId(projectId),
            message,
            ...(imageUrl && { imageUrl }),
            createdAt: new Date(),
        };
        const { db } = await connectToDatabase();
        await db.collection('randomizer_posts').insertOne(newPost as any);
        revalidatePath('/dashboard/facebook/post-randomizer');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteRandomizerPost(postId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(postId) || !ObjectId.isValid(projectId)) {
        return { success: false, error: 'Invalid ID provided.' };
    }

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('randomizer_posts').deleteOne({ _id: new ObjectId(postId), projectId: new ObjectId(projectId) });
        revalidatePath('/dashboard/facebook/post-randomizer');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// --- Facebook Broadcast Actions ---
export async function getFacebookBroadcasts(projectId: string): Promise<WithId<FacebookBroadcast>[]> {
    if (!ObjectId.isValid(projectId)) return [];
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const broadcasts = await db.collection<FacebookBroadcast>('facebook_broadcasts')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();
        return JSON.parse(JSON.stringify(broadcasts));
    } catch (e) {
        console.error("Failed to fetch Facebook broadcasts:", e);
        return [];
    }
}

export async function handleSendFacebookBroadcast(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const message = formData.get('message') as string;

    const project = await getProjectById(projectId);
    if (!project || !project.facebookPageId || !project.accessToken) {
        return { error: 'Project not found or is not configured for Facebook.' };
    }

    if (!message) {
        return { error: 'Message cannot be empty.' };
    }

    try {
        const { db } = await connectToDatabase();
        
        const subscribers = await db.collection<FacebookSubscriber>('facebook_subscribers')
            .find({ projectId: project._id })
            .project({ psid: 1 })
            .toArray();

        const recipientIds = subscribers.map(s => s.psid);
        
        if (recipientIds.length === 0) {
            return { error: "No contacts found to broadcast to. A user must message your page first." };
        }
        
        const newBroadcast: Omit<FacebookBroadcast, '_id'> = {
            projectId: project._id,
            message,
            status: 'QUEUED',
            createdAt: new Date(),
            totalRecipients: recipientIds.length,
            successCount: 0,
            failedCount: 0,
        };

        const result = await db.collection('facebook_broadcasts').insertOne(newBroadcast as any);
        const broadcastId = result.insertedId;

        await db.collection('facebook_broadcasts').updateOne({ _id: broadcastId }, { $set: { status: 'PROCESSING', startedAt: new Date() }});

        let successCount = 0;
        let failedCount = 0;
        const BATCH_SIZE = 10;

        for (let i = 0; i < recipientIds.length; i += BATCH_SIZE) {
            const batch = recipientIds.slice(i, i + BATCH_SIZE);
            
            const promises = batch.map(recipientId => (
                axios.post(
                    `https://graph.facebook.com/v23.0/me/messages`,
                    {
                        recipient: { id: recipientId },
                        messaging_type: "MESSAGE_TAG",
                        message: { text: message },
                        tag: "POST_PURCHASE_UPDATE"
                    },
                    { params: { access_token: project.accessToken } }
                ).then(() => {
                    successCount++;
                }).catch(err => {
                    console.error(`Failed to send broadcast message to ${recipientId}:`, getErrorMessage(err));
                    failedCount++;
                })
            ));

            await Promise.all(promises);
            await new Promise(res => setTimeout(res, 1000));
        }
        
        await db.collection('facebook_broadcasts').updateOne(
            { _id: broadcastId },
            { $set: { 
                status: failedCount > 0 ? 'PARTIAL_FAILURE' : 'COMPLETED',
                completedAt: new Date(),
                successCount,
                failedCount,
            }}
        );

        revalidatePath('/dashboard/facebook/broadcasts');
        return { message: `Broadcast sent to ${successCount} users. ${failedCount} failed.` };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

// --- Live Stream Actions ---

export async function getScheduledLiveStreams(projectId: string): Promise<WithId<FacebookLiveStream>[]> {
    if (!ObjectId.isValid(projectId)) return [];
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const streams = await db.collection<FacebookLiveStream>('facebook_live_streams')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ scheduledTime: -1 })
            .limit(50)
            .toArray();
        return JSON.parse(JSON.stringify(streams));
    } catch (e) {
        console.error("Failed to fetch scheduled streams:", e);
        return [];
    }
}

export async function handleScheduleLiveStream(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const scheduledDate = formData.get('scheduledDate') as string;
    const scheduledTime = formData.get('scheduledTime') as string;
    const videoFile = formData.get('videoFile') as File;

    if (!projectId || !title || !scheduledDate || !scheduledTime || !videoFile || videoFile.size === 0) {
        return { error: 'All fields, including a video file, are required.' };
    }

    const project = await getProjectById(projectId);
    if (!project || !project.facebookPageId || !project.accessToken) {
        return { error: 'Project is not fully configured for Facebook posting.' };
    }

    const scheduledPublishTime = new Date(`${scheduledDate}T${scheduledTime}`);
    if (isNaN(scheduledPublishTime.getTime()) || scheduledPublishTime < new Date()) {
        return { error: 'Invalid or past schedule date/time.' };
    }

    try {
        const { db } = await connectToDatabase();
        const { facebookPageId, accessToken } = project;
        const apiVersion = 'v23.0';

        const form = new FormData();
        form.append('access_token', accessToken);
        form.append('title', title);
        form.append('description', description);
        form.append('live_status', 'SCHEDULED_LIVE');
        form.append('scheduled_publish_time', String(Math.floor(scheduledPublishTime.getTime() / 1000)));
        form.append('source', Buffer.from(await videoFile.arrayBuffer()), {
            filename: videoFile.name,
            contentType: videoFile.type,
        });
        
        const response = await fetch(`https://graph-video.facebook.com/${apiVersion}/${facebookPageId}/videos`, {
            method: 'POST',
            body: form as any,
        });

        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData.error?.message || 'Failed to upload video.');
        }

        const facebookVideoId = responseData.id;
        if (!facebookVideoId) {
            throw new Error('Facebook did not return a video ID after upload.');
        }

        const newStream: Omit<FacebookLiveStream, '_id'> = {
            projectId: new ObjectId(projectId),
            title,
            description,
            scheduledTime: scheduledPublishTime,
            facebookVideoId,
            status: 'SCHEDULED_LIVE',
            createdAt: new Date(),
        };

        await db.collection('facebook_live_streams').insertOne(newStream as any);

        revalidatePath('/dashboard/facebook/live-studio');
        return { message: 'Video successfully scheduled as a live premiere!' };

    } catch (e: any) {
        console.error("Failed to schedule live stream:", getErrorMessage(e));
        return { error: getErrorMessage(e) };
    }
}

// --- Subscriber Actions ---

export async function getFacebookSubscribers(projectId: string): Promise<{ subscribers?: WithId<FacebookSubscriber>[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.facebookPageId || !project.accessToken) {
        return { error: 'Project not found or is not configured for Facebook.' };
    }

    try {
        const { db } = await connectToDatabase();
        const subscribers = await db.collection<FacebookSubscriber>('facebook_subscribers')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ createdAt: -1 })
            .toArray();
            
        return { subscribers: JSON.parse(JSON.stringify(subscribers)) };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

// --- Comment Auto-Reply ---
export async function handleUpdateCommentAutoReply(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    if (!projectId) return { success: false, error: 'Project ID is missing.' };

    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: 'Access denied or project not found.' };
    
    try {
        const { db } = await connectToDatabase();
        const settings: FacebookCommentAutoReplySettings = {
            enabled: formData.get('enabled') === 'on',
            replyMode: formData.get('replyMode') as 'static' | 'ai',
            staticReplyText: formData.get('staticReplyText') as string,
            aiReplyPrompt: formData.get('aiReplyPrompt') as string,
            moderationEnabled: false, // This feature is now part of the main automation settings.
            moderationPrompt: '',     // This feature is now part of the main automation settings.
        };

        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { facebookCommentAutoReply: settings } }
        );

        revalidatePath('/dashboard/facebook/auto-reply');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function markFacebookConversationAsRead(conversationId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied or project not configured.' };
    }

    try {
        await axios.post(
            `https://graph.facebook.com/v23.0/${conversationId}?state=read`, 
            {}, // Empty body
            { params: { access_token: project.accessToken } }
        );
        revalidatePath('/dashboard/facebook/messages');
        return { success: true };
    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        if (!errorMessage.includes("This message has already been read")) {
            console.error("Failed to mark conversation as read:", errorMessage);
            return { success: false, error: errorMessage };
        }
        return { success: true };
    }
}


// --- Kanban Actions ---

export async function getFacebookKanbanData(projectId: string): Promise<{ project: WithId<Project> | null, columns: { name: string, conversations: WithId<FacebookSubscriber>[] }[] }> {
    const defaultData = { project: null, columns: [] };
    const project = await getProjectById(projectId);
    if (!project) return defaultData;
    
    try {
        const { db } = await connectToDatabase();
        const conversations = await db.collection<FacebookSubscriber>('facebook_subscribers')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ updated_time: -1 })
            .toArray();

        const defaultStatuses = ['new', 'open', 'resolved'];
        const customStatuses = project.facebookKanbanStatuses || [];
        const allStatuses = [...new Set([...defaultStatuses, ...customStatuses])];

        const columns = allStatuses.map(status => ({
            name: status,
            conversations: conversations.filter(c => (c.status || 'new') === status),
        }));

        return {
            project: JSON.parse(JSON.stringify(project)),
            columns: JSON.parse(JSON.stringify(columns))
        };
    } catch (e) {
        console.error("Failed to get Facebook Kanban data:", e);
        return defaultData;
    }
}

export async function handleUpdateFacebookSubscriberStatus(subscriberId: string, status: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(subscriberId)) {
        return { success: false, error: 'Invalid subscriber ID.' };
    }
    
    const { db } = await connectToDatabase();
    const subscriber = await db.collection('facebook_subscribers').findOne({ _id: new ObjectId(subscriberId) });
    if (!subscriber) {
        return { success: false, error: 'Subscriber not found.' };
    }

    const hasAccess = await getProjectById(subscriber.projectId.toString());
    if (!hasAccess) return { success: false, error: 'Access denied' };

    try {
        await db.collection('facebook_subscribers').updateOne(
            { _id: new ObjectId(subscriberId) },
            { $set: { status } }
        );
        
        revalidatePath('/dashboard/facebook/kanban');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to update conversation status.' };
    }
}

export async function saveFacebookKanbanStatuses(projectId: string, statuses: string[]): Promise<{ success: boolean; error?: string }> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const defaultStatuses = ['new', 'open', 'resolved'];
        const customStatuses = statuses.filter(s => !defaultStatuses.includes(s));
        
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { facebookKanbanStatuses: customStatuses } }
        );
        revalidatePath('/dashboard/facebook/kanban');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to save Kanban lists.' };
    }
}

export async function getInstagramAccountForPage(projectId: string): Promise<{ instagramId?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.facebookPageId || !project.accessToken) {
        return { error: 'Project not found or is not configured for Facebook.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}`, {
            params: {
                fields: 'instagram_business_account',
                access_token: project.accessToken,
            }
        });

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        const instagramId = response.data.instagram_business_account?.id;
        return { instagramId };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getCommerceMerchantSettings(projectId: string): Promise<{ settings?: any, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.facebookPageId || !project.accessToken) {
        return { error: 'Project not found or is not configured for Facebook.' };
    }
    
    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}`, {
            params: {
                fields: 'commerce_merchant_settings{id,commerce_manager_url,display_name,shops}',
                access_token: project.accessToken,
            }
        });
        
        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        const settings = response.data.commerce_merchant_settings;
        if (!settings) {
            return { error: 'No Commerce Merchant Settings found for this Page. Please set up a shop in Meta Commerce Manager.' };
        }
        
        return { settings };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getFacebookOrders(projectId: string): Promise<{ orders?: FacebookOrder[], error?: string }> {
    const { settings: commerceSettings, error: settingsError } = await getCommerceMerchantSettings(projectId);
    if (settingsError) {
        return { error: `Could not retrieve commerce settings: ${settingsError}` };
    }

    const commerceAccountId = commerceSettings?.id;
    if (!commerceAccountId) {
        return { error: 'Commerce Account ID not found. Ensure a shop is set up and connected.' };
    }

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token missing.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${commerceAccountId}/orders`, {
            params: {
                fields: 'id,buyer_details,order_status,estimated_payment_details,created,updated',
                access_token: project.accessToken,
            }
        });

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        return { orders: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function savePersistentMenu(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const shopId = formData.get('shopId') as string;
    const menuItemsJson = formData.get('menuItems') as string;

    if (!shopId) {
        return { success: false, error: 'Shop ID is missing.' };
    }
    const shop = await getEcommShopById(shopId);
    if (!shop) {
        return { success: false, error: 'Shop not found or access denied.' };
    }
    const project = await getProjectById(shop.projectId.toString());
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { success: false, error: 'Access denied or project not configured.' };
    }

    let menuItems = [];
    try {
        menuItems = JSON.parse(menuItemsJson);
    } catch (e) {
        return { success: false, error: 'Invalid menu items format.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        let apiPayload;

        if (menuItems.length === 0) {
            apiPayload = {
                platform: 'messenger',
                psid: project.facebookPageId, 
                fields: ['persistent_menu']
            };
             await axios.delete(`https://graph.facebook.com/v23.0/me/messenger_profile`, {
                params: { ...apiPayload, access_token: project.accessToken }
            });
        } else {
             apiPayload = {
                persistent_menu: [
                    {
                        locale: 'default',
                        composer_input_disabled: false,
                        call_to_actions: menuItems.map((item: any) => {
                            if (item.type === 'web_url') {
                                return { type: 'web_url', title: item.title, url: item.url };
                            }
                            return { type: 'postback', title: item.title, payload: item.payload };
                        }),
                    },
                ],
            };
             await axios.post(`https://graph.facebook.com/v23.0/me/messenger_profile`, {
                ...apiPayload,
                access_token: project.accessToken,
            });
        }

        await db.collection('ecomm_shops').updateOne(
            { _id: shop._id },
            { $set: { persistentMenu: menuItems } }
        );
        
        revalidatePath(`/dashboard/facebook/custom-ecommerce/manage/${shopId}/settings`);
        return { success: true, error: undefined };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

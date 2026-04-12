

'use server';

import { revalidatePath } from 'next/cache';
import axios from 'axios';
import { ObjectId, type WithId } from 'mongodb';
import NodeFormData from 'form-data';
import { cookies } from 'next/headers';

import { getErrorMessage } from '@/lib/utils';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/project.actions';
import { getSession } from '@/app/actions/user.actions';
import { getEcommShopById } from './custom-ecommerce.actions';
import type { Project, FacebookPage, FacebookPost, FacebookPageDetails, PageInsights, FacebookConversation, FacebookMessage, FacebookCommentAutoReplySettings, PostRandomizerSettings, RandomizerPost, FacebookBroadcast, FacebookLiveStream, FacebookSubscriber, FacebookWelcomeMessageSettings, FacebookOrder, User, MetaWabasResponse, FacebookEvent, FacebookLeadGenForm, FacebookLead } from '@/lib/definitions';
import { processMessengerWebhook } from '@/lib/webhook-processor';
import { _createProjectFromWaba } from './whatsapp.actions';
import { getInstagramAccountForPage as _getInstagramAccountForPage } from './instagram.actions';


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
            return { success: false, error: getErrorMessage({ response }) };
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

    const cookieStore = await cookies();
    const stateCookieJSON = cookieStore.get('onboarding_state')?.value;
    if (!stateCookieJSON) {
        return { success: false, error: "Onboarding session expired or cookies are disabled. Please try again." };
    }

    let stateCookie: { state?: string; userId?: string; includeCatalog?: boolean };
    try {
        stateCookie = JSON.parse(stateCookieJSON);
    } catch (e) {
        console.error('[OAuth Callback] Corrupted onboarding_state cookie:', e);
        return { success: false, error: 'Onboarding session is corrupted. Please try again.' };
    }

    if (state !== stateCookie.state) {
        console.error(`[OAuth Callback] State mismatch. URL: ${state}, Cookie: ${stateCookie.state}`);
        return { success: false, error: 'Invalid state received during authentication.' };
    }

    // includeCatalog is set by /api/auth/facebook/login when the user opts into
    // catalog scopes. The WhatsApp branch needs it to (a) decide whether to
    // resolve a Meta business id, and (b) flip hasCatalogManagement on the
    // project doc so the catalog UI unlocks.
    const includeCatalog = stateCookie.includeCatalog === true;

    cookieStore.delete('onboarding_state');

    let appId, appSecret;
    let tokenTargetField: 'metaSuiteAccessToken' | 'adManagerAccessToken';

    if (state === 'whatsapp') {
        appId = process.env.NEXT_PUBLIC_META_ONBOARDING_APP_ID;
        appSecret = process.env.META_ONBOARDING_APP_SECRET;
        tokenTargetField = 'metaSuiteAccessToken';
    } else if (state === 'instagram') {
        appId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID;
        appSecret = process.env.INSTAGRAM_APP_SECRET;
        tokenTargetField = 'metaSuiteAccessToken';
    } else if (state === 'ad_manager') {
        appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
        appSecret = process.env.FACEBOOK_APP_SECRET;
        tokenTargetField = 'adManagerAccessToken';
    } else { // 'facebook' and 'facebook_reauth'
        appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
        appSecret = process.env.FACEBOOK_APP_SECRET;
        tokenTargetField = 'metaSuiteAccessToken';
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
        const tokenResponse = await axios.get('https://graph.facebook.com/v24.0/oauth/access_token', {
            params: { client_id: appId, redirect_uri: redirectUri, client_secret: appSecret, code: code }
        });
        const shortLivedToken = tokenResponse.data.access_token;
        if (!shortLivedToken) return { success: false, error: 'Failed to obtain access token from Facebook.' };

        const longLivedResponse = await axios.get('https://graph.facebook.com/v24.0/oauth/access_token', {
            params: { grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: shortLivedToken }
        });
        const longLivedToken = longLivedResponse.data.access_token;
        if (!longLivedToken) return { success: false, error: 'Could not obtain a long-lived token from Facebook.' };

        const { db } = await connectToDatabase();
        const userUpdate: any = {};
        userUpdate[tokenTargetField] = longLivedToken;

        if (state === 'whatsapp') {
            await db.collection('users').updateOne({ _id: new ObjectId(session.user._id) }, { $set: userUpdate });

            let allWabas: any[] = [];

            // Strategy 1: Discover WABAs via me/businesses → owned_whatsapp_business_accounts
            try {
                const businessesResponse = await axios.get(`https://graph.facebook.com/v24.0/me/businesses`, {
                    params: { access_token: longLivedToken }
                });
                const businesses = businessesResponse.data?.data || [];

                for (const business of businesses) {
                    try {
                        const wabasResponse = await axios.get<{ data: any[] }>(`https://graph.facebook.com/v24.0/${business.id}/owned_whatsapp_business_accounts`, {
                            params: { access_token: longLivedToken, fields: 'id,name' }
                        });
                        if (wabasResponse.data?.data) {
                            allWabas.push(...wabasResponse.data.data);
                        }
                    } catch (e: any) {
                        console.warn(`[WhatsApp OAuth] Could not fetch WABAs for business ${business.id}: ${getErrorMessage(e)}`);
                    }
                }
            } catch (e) {
                console.warn("[WhatsApp OAuth] me/businesses failed, trying fallback via debug_token:", getErrorMessage(e));
            }

            // Strategy 2 (fallback): Discover WABA IDs from the granted scopes via debug_token
            if (allWabas.length === 0) {
                try {
                    const debugResponse = await axios.get(`https://graph.facebook.com/v24.0/debug_token`, {
                        params: {
                            input_token: longLivedToken,
                            access_token: `${appId}|${appSecret}`,
                        }
                    });
                    const granularScopes = debugResponse.data?.data?.granular_scopes || [];
                    const wabaScope = granularScopes.find((s: any) => s.scope === 'whatsapp_business_management');
                    const wabaIds = wabaScope?.target_ids || [];

                    for (const wabaId of wabaIds) {
                        try {
                            const wabaData = await axios.get(`https://graph.facebook.com/v24.0/${wabaId}`, {
                                params: { fields: 'id,name', access_token: longLivedToken }
                            });
                            allWabas.push({ id: wabaData.data.id, name: wabaData.data.name });
                        } catch (e) {
                            // Still add with just the ID so the project can be created
                            allWabas.push({ id: wabaId });
                        }
                    }
                } catch (e) {
                    console.error("[WhatsApp OAuth] debug_token fallback also failed:", getErrorMessage(e));
                }
            }

            if (allWabas.length === 0) {
                return { success: false, error: "No WhatsApp Business Accounts found. Please ensure you have a WABA connected to your Meta Business Suite account and granted all requested permissions during login." };
            }

            // Deduplicate by WABA ID
            const uniqueWabas = Array.from(new Map(allWabas.map(w => [w.id, w])).values());

            await Promise.all(
                uniqueWabas.map(async (waba) => {
                    await _createProjectFromWaba({
                        wabaId: waba.id,
                        appId: appId!,
                        accessToken: longLivedToken,
                        includeCatalog,
                        userId: session.user._id.toString(),
                    });
                })
            );

            revalidatePath('/dashboard');
            return { success: true, redirectPath: '/dashboard' };

        } else if (state === 'facebook' || state === 'instagram' || state === 'facebook_reauth') {
            await db.collection('users').updateOne({ _id: new ObjectId(session.user._id) }, { $set: userUpdate });
            const pagesResponse = await axios.get('https://graph.facebook.com/v24.0/me/accounts', {
                params: { fields: 'id,name,access_token,tasks', access_token: longLivedToken }
            });
            const userPagesWithTokens = pagesResponse.data?.data;
            if (!userPagesWithTokens || userPagesWithTokens.length === 0) {
                return { success: false, error: 'No manageable Facebook Pages found. Please ensure you granted access to at least one page.' };
            }

            const bulkOps = userPagesWithTokens.map((page: any) => ({
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
            for (const page of userPagesWithTokens) {
                await handleSubscribeFacebookPageWebhook(page.id, page.access_token);
            }

            let redirectPath = state === 'instagram' ? '/dashboard/instagram/connections' : '/dashboard/facebook/all-projects';
            revalidatePath('/dashboard/facebook/all-projects');
            revalidatePath('/dashboard/instagram/connections');
            return { success: true, redirectPath };

        } else if (state === 'ad_manager') {
            const adAccountsResponse = await axios.get(`https://graph.facebook.com/v24.0/me/adaccounts`, { params: { access_token: longLivedToken, fields: 'id,name,account_id' } });
            const adAccounts = adAccountsResponse.data?.data || [];
            if (adAccounts.length > 0) {
                userUpdate.metaAdAccounts = adAccounts.map((acc: any) => ({ id: acc.id, name: acc.name, account_id: acc.account_id }));
            }
            await db.collection('users').updateOne(
                { _id: new ObjectId(session.user._id) },
                { $set: userUpdate }
            );
            revalidatePath('/dashboard/ad-manager/ad-accounts');
            return { success: true, redirectPath: '/dashboard/ad-manager/ad-accounts' };
        }

        return { success: false, error: 'Invalid state received during authentication.' };

    } catch (e) {
        console.error("Facebook OAuth Callback failed:", getErrorMessage(e));
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function handleManualFacebookPageSetup(prevState: { success?: boolean; error?: string }, formData: FormData): Promise<{ success?: boolean; error?: string }> {
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

export async function getFacebookPosts(projectId: string): Promise<{ posts?: FacebookPost[], totalCount?: number, error?: string }> {
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

        // Facebook Graph API doesn't provide total count for /posts endpoint
        // Return the count of posts we actually fetched
        const posts = response.data.data || [];
        return { posts, totalCount: posts.length };

    } catch (e: any) {
        return { error: getErrorMessage(e), posts: [], totalCount: 0 };
    }
}


export async function handleCreateFacebookPost(prevState: { message?: string; error?: string }, formData: FormData): Promise<{ message?: string; error?: string }> {
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
    const form = new NodeFormData();
    form.append('access_token', accessToken);

    if (isScheduled) {
        if (!scheduledDate || !scheduledTime) {
            return { error: 'A date and time are required for scheduling.' };
        }

        // Parse the date-time string (user input is in their local timezone)
        const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
        if (isNaN(scheduledDateTime.getTime())) {
            return { error: 'Invalid date or time format.' };
        }

        // Get current time and add 10 minutes (both in same timezone context)
        const now = new Date();
        const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

        if (scheduledDateTime < tenMinutesFromNow) {
            // Calculate the actual difference to provide helpful error message
            const diffMinutes = Math.round((scheduledDateTime.getTime() - now.getTime()) / 60000);
            return {
                error: `Scheduled time must be at least 10 minutes in the future. The selected time is ${Math.abs(diffMinutes)} minutes ${diffMinutes < 0 ? 'in the past' : 'from now'}.`
            };
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

export async function handleUpdatePost(prevState: { success: boolean; error?: string }, formData: FormData): Promise<{ success: boolean; error?: string }> {
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

export async function handleAddVideoThumbnail(prevState: { success: boolean; error?: string }, formData: FormData): Promise<{ success: boolean; error?: string }> {
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
        const form = new NodeFormData();
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

export async function getEligibleCrosspostPages(postId: string, projectId: string): Promise<{ pages: FacebookPage[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { pages: [], error: 'Access denied or project not configured.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${postId}/crosspost_eligible_pages`, {
            params: { access_token: project.accessToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { pages: response.data.data || [] };
    } catch (e: any) {
        return { pages: [], error: getErrorMessage(e) };
    }
}


export async function handleCrosspostVideo(prevState: { success: boolean; error?: string }, formData: FormData): Promise<{ success: boolean; error?: string }> {
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

export async function handleUpdatePageDetails(prevState: { success: boolean; error?: string }, formData: FormData): Promise<{ success: boolean; error?: string }> {
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
                period: 'days_28',
                access_token: project.accessToken,
            }
        });

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }

        const insightsData = response.data.data;

        // Find metrics with better error handling
        const pageReachMetric = insightsData.find((m: any) => m.name === 'page_impressions_unique');
        const postEngagementMetric = insightsData.find((m: any) => m.name === 'page_post_engagements');

        // Extract values with multiple fallbacks
        let pageReach = 0;
        if (pageReachMetric?.values && pageReachMetric.values.length > 0) {
            // Try to get the most recent value (last in array) or first value
            const lastValue = pageReachMetric.values[pageReachMetric.values.length - 1]?.value;
            const firstValue = pageReachMetric.values[0]?.value;
            pageReach = lastValue ?? firstValue ?? 0;
        }

        let postEngagement = 0;
        if (postEngagementMetric?.values && postEngagementMetric.values.length > 0) {
            const lastValue = postEngagementMetric.values[postEngagementMetric.values.length - 1]?.value;
            const firstValue = postEngagementMetric.values[0]?.value;
            postEngagement = lastValue ?? firstValue ?? 0;
        }

        return { insights: { pageReach, postEngagement } };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handlePostComment(prevState: { success: boolean; error?: string }, formData: FormData): Promise<{ success: boolean; error?: string }> {
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
    } catch (e: any) {
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
    } catch (e: any) {
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

        await db.collection('facebook_broadcasts').updateOne({ _id: broadcastId }, { $set: { status: 'PROCESSING', startedAt: new Date() } });

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
            {
                $set: {
                    status: failedCount > 0 ? 'PARTIAL_FAILURE' : 'COMPLETED',
                    completedAt: new Date(),
                    successCount,
                    failedCount,
                }
            }
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

        const form = new NodeFormData();
        form.append('access_token', accessToken);
        form.append('title', title);
        form.append('description', description);
        form.append('live_status', 'SCHEDULED_LIVE');
        form.append('scheduled_publish_time', String(Math.floor(scheduledPublishTime.getTime() / 1000)));
        form.append('source', Buffer.from(await videoFile.arrayBuffer()), {
            filename: videoFile.name,
            contentType: videoFile.type,
        });

        const response = await axios.post(`https://graph-video.facebook.com/${apiVersion}/${facebookPageId}/videos`, form);

        const responseData = response.data;
        if (responseData.error) {
            throw new Error(responseData.error.message || 'Failed to upload video.');
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

// Re-exported from instagram.actions.ts to avoid duplication
export const getInstagramAccountForPage = _getInstagramAccountForPage;

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


// =================================================================
//  EVENTS
// =================================================================

export async function getFacebookEvents(projectId: string): Promise<{ events?: FacebookEvent[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or is missing Facebook Page ID or access token.' };
    }

    try {
        const fields = 'id,name,description,start_time,end_time,place,cover,attending_count,interested_count,maybe_count,is_online,ticket_uri,category';
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/events`, {
            params: { fields, access_token: project.accessToken, limit: 50 }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { events: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getEventDetails(eventId: string, projectId: string): Promise<{ event?: FacebookEvent, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Access denied or project not configured.' };
    }

    try {
        const fields = 'id,name,description,start_time,end_time,place,cover,attending_count,interested_count,maybe_count,is_online,event_times,ticket_uri,category';
        const response = await axios.get(`https://graph.facebook.com/v23.0/${eventId}`, {
            params: { fields, access_token: project.accessToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { event: response.data };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleCreateFacebookEvent(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const startDate = formData.get('startDate') as string;
    const startTime = formData.get('startTime') as string;
    const endDate = formData.get('endDate') as string;
    const endTime = formData.get('endTime') as string;
    const placeName = formData.get('placeName') as string;
    const isOnline = formData.get('isOnline') === 'on';
    const ticketUri = formData.get('ticketUri') as string;

    if (!projectId || !name || !startDate || !startTime) {
        return { error: 'Event name, start date, and start time are required.' };
    }

    const project = await getProjectById(projectId);
    if (!project || !project.facebookPageId || !project.accessToken) {
        return { error: 'Project is not fully configured for Facebook.' };
    }

    const startDateTime = new Date(`${startDate}T${startTime}`);
    if (isNaN(startDateTime.getTime())) return { error: 'Invalid start date/time.' };

    try {
        const payload: any = {
            name,
            start_time: startDateTime.toISOString(),
            access_token: project.accessToken,
        };

        if (description) payload.description = description;
        if (endDate && endTime) {
            const endDateTime = new Date(`${endDate}T${endTime}`);
            if (!isNaN(endDateTime.getTime())) payload.end_time = endDateTime.toISOString();
        }
        if (placeName) payload.place = JSON.stringify({ name: placeName });
        if (isOnline) payload.is_online = true;
        if (ticketUri) payload.ticket_uri = ticketUri;

        const response = await axios.post(`https://graph.facebook.com/v23.0/${project.facebookPageId}/events`, payload);
        if (response.data.error) throw new Error(getErrorMessage({ response }));

        revalidatePath('/dashboard/facebook/events');
        return { message: `Event "${name}" created successfully!` };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleUpdateFacebookEvent(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const eventId = formData.get('eventId') as string;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const startDate = formData.get('startDate') as string;
    const startTime = formData.get('startTime') as string;
    const endDate = formData.get('endDate') as string;
    const endTime = formData.get('endTime') as string;

    if (!projectId || !eventId) return { success: false, error: 'Missing event or project ID.' };

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Access denied or project not configured.' };

    try {
        const payload: any = { access_token: project.accessToken };
        if (name) payload.name = name;
        if (description) payload.description = description;
        if (startDate && startTime) {
            const dt = new Date(`${startDate}T${startTime}`);
            if (!isNaN(dt.getTime())) payload.start_time = dt.toISOString();
        }
        if (endDate && endTime) {
            const dt = new Date(`${endDate}T${endTime}`);
            if (!isNaN(dt.getTime())) payload.end_time = dt.toISOString();
        }

        await axios.post(`https://graph.facebook.com/v23.0/${eventId}`, payload);
        revalidatePath('/dashboard/facebook/events');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteFacebookEvent(eventId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Access denied.' };

    try {
        await axios.delete(`https://graph.facebook.com/v23.0/${eventId}`, {
            params: { access_token: project.accessToken }
        });
        revalidatePath('/dashboard/facebook/events');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getEventAttendees(eventId: string, projectId: string, rsvpStatus: 'attending' | 'maybe' | 'declined' = 'attending'): Promise<{ attendees?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Access denied.' };

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${eventId}/${rsvpStatus}`, {
            params: { fields: 'id,name,picture', access_token: project.accessToken, limit: 100 }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { attendees: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  PAGE RATINGS / REVIEWS
// =================================================================

export async function getPageRatings(projectId: string): Promise<{ ratings?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or is missing Facebook Page ID or access token.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/ratings`, {
            params: {
                fields: 'created_time,has_rating,has_review,rating,review_text,reviewer{id,name,picture}',
                access_token: project.accessToken,
                limit: 50,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { ratings: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  LEAD GENERATION FORMS & LEADS
// =================================================================

export async function getLeadGenForms(projectId: string): Promise<{ forms?: FacebookLeadGenForm[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or is missing Facebook Page ID or access token.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/leadgen_forms`, {
            params: {
                fields: 'id,name,status,leads_count,created_time,expired_leads_count',
                access_token: project.accessToken,
                limit: 50,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { forms: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getLeadsForForm(formId: string, projectId: string): Promise<{ leads?: FacebookLead[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Access denied or project not configured.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${formId}/leads`, {
            params: {
                fields: 'id,created_time,field_data',
                access_token: project.accessToken,
                limit: 100,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { leads: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getLeadById(leadId: string, projectId: string): Promise<{ lead?: FacebookLead, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Access denied.' };

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${leadId}`, {
            params: { fields: 'id,created_time,field_data,form_id', access_token: project.accessToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { lead: response.data };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  MESSENGER PROFILE (Greeting, Get Started, Ice Breakers)
// =================================================================

export async function getMessengerProfile(projectId: string): Promise<{ profile?: any, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or is missing Facebook Page ID or access token.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/me/messenger_profile`, {
            params: {
                fields: 'greeting,get_started,persistent_menu,ice_breakers,whitelisted_domains',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { profile: response.data.data?.[0] || {} };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function setMessengerGreeting(projectId: string, greetingText: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Access denied.' };

    try {
        await axios.post(`https://graph.facebook.com/v23.0/me/messenger_profile`, {
            greeting: [{ locale: 'default', text: greetingText }],
            access_token: project.accessToken,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function setMessengerGetStarted(projectId: string, payload: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Access denied.' };

    try {
        await axios.post(`https://graph.facebook.com/v23.0/me/messenger_profile`, {
            get_started: { payload },
            access_token: project.accessToken,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function setMessengerIceBreakers(projectId: string, iceBreakers: { question: string; payload: string }[]): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Access denied.' };

    try {
        await axios.post(`https://graph.facebook.com/v23.0/me/messenger_profile`, {
            ice_breakers: iceBreakers.map(ib => ({ call_to_actions: [{ question: ib.question, payload: ib.payload }] })),
            access_token: project.accessToken,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function setWhitelistedDomains(projectId: string, domains: string[]): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Access denied.' };

    try {
        await axios.post(`https://graph.facebook.com/v23.0/me/messenger_profile`, {
            whitelisted_domains: domains,
            access_token: project.accessToken,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteMessengerProfileFields(projectId: string, fields: string[]): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Access denied.' };

    try {
        await axios.delete(`https://graph.facebook.com/v23.0/me/messenger_profile`, {
            params: { access_token: project.accessToken },
            data: { fields },
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


// =================================================================
//  CUSTOM LABELS (Conversation Labels for Messenger)
// =================================================================

export async function getCustomLabels(projectId: string): Promise<{ labels?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/custom_labels`, {
            params: { fields: 'name', access_token: project.accessToken, limit: 100 }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { labels: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function createCustomLabel(projectId: string, name: string): Promise<{ labelId?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.post(`https://graph.facebook.com/v23.0/${project.facebookPageId}/custom_labels`, {
            name,
            access_token: project.accessToken,
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { labelId: response.data.id };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCustomLabel(labelId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Access denied.' };

    try {
        await axios.delete(`https://graph.facebook.com/v23.0/${labelId}`, {
            params: { access_token: project.accessToken }
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function assignLabelToUser(labelId: string, psid: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Access denied.' };

    try {
        await axios.post(`https://graph.facebook.com/v23.0/${labelId}/label`, {
            user: psid,
            access_token: project.accessToken,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function removeLabelFromUser(labelId: string, psid: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Access denied.' };

    try {
        await axios.delete(`https://graph.facebook.com/v23.0/${labelId}/label`, {
            params: { access_token: project.accessToken },
            data: { user: psid },
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getLabelsForUser(psid: string, projectId: string): Promise<{ labels?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Access denied.' };

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${psid}/custom_labels`, {
            params: { fields: 'name', access_token: project.accessToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { labels: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  PRIVATE REPLIES TO COMMENTS
// =================================================================

export async function sendPrivateReply(commentId: string, message: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Access denied.' };

    try {
        await axios.post(`https://graph.facebook.com/v23.0/${commentId}/private_replies`, {
            message,
            access_token: project.accessToken,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


// =================================================================
//  COMMENT & POST REACTIONS
// =================================================================

export async function getObjectReactions(objectId: string, projectId: string): Promise<{ reactions?: any, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Access denied.' };

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${objectId}/reactions`, {
            params: {
                summary: 'total_count',
                access_token: project.accessToken,
                limit: 100,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { reactions: response.data };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  PAGE PHOTOS & ALBUMS
// =================================================================

export async function getPageAlbums(projectId: string): Promise<{ albums?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/albums`, {
            params: {
                fields: 'id,name,count,cover_photo{source},created_time,description,type',
                access_token: project.accessToken,
                limit: 50,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { albums: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getAlbumPhotos(albumId: string, projectId: string): Promise<{ photos?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Access denied.' };

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${albumId}/photos`, {
            params: {
                fields: 'id,name,source,images,created_time,likes.summary(true),comments.summary(true)',
                access_token: project.accessToken,
                limit: 50,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { photos: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function createPhotoAlbum(projectId: string, name: string, description?: string): Promise<{ albumId?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const payload: any = { name, access_token: project.accessToken };
        if (description) payload.message = description;

        const response = await axios.post(`https://graph.facebook.com/v23.0/${project.facebookPageId}/albums`, payload);
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        revalidatePath('/dashboard/facebook/albums');
        return { albumId: response.data.id };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getPagePhotos(projectId: string): Promise<{ photos?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/photos`, {
            params: {
                type: 'uploaded',
                fields: 'id,name,source,images,created_time,album,likes.summary(true),comments.summary(true)',
                access_token: project.accessToken,
                limit: 50,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { photos: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getPhotoDetails(photoId: string, projectId: string): Promise<{ photo?: any, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Access denied.' };

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${photoId}`, {
            params: {
                fields: 'id,name,source,images,created_time,album,likes.summary(true),comments.summary(true),reactions.summary(true)',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { photo: response.data };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getPhotoInsights(photoId: string, projectId: string): Promise<{ insights?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Access denied.' };

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${photoId}/insights`, {
            params: {
                metric: 'post_impressions,post_impressions_unique,post_engaged_users,post_clicks',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { insights: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  PAGE VIDEOS & VIDEO PLAYLISTS
// =================================================================

export async function getPageVideos(projectId: string): Promise<{ videos?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/videos`, {
            params: {
                fields: 'id,title,description,source,picture,length,created_time,views,likes.summary(true),comments.summary(true)',
                access_token: project.accessToken,
                limit: 50,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { videos: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getVideoDetails(videoId: string, projectId: string): Promise<{ video?: any, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Access denied.' };

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${videoId}`, {
            params: {
                fields: 'id,title,description,source,picture,length,created_time,views,likes.summary(true),comments.summary(true),reactions.summary(true)',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { video: response.data };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getVideoInsights(videoId: string, projectId: string): Promise<{ insights?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Access denied.' };

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${videoId}/video_insights`, {
            params: {
                metric: 'total_video_views,total_video_views_unique,total_video_impressions,total_video_impressions_unique,total_video_avg_time_watched,total_video_view_total_time',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { insights: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getVideoPlaylists(projectId: string): Promise<{ playlists?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/video_lists`, {
            params: {
                fields: 'id,title,description,creation_time,videos_count',
                access_token: project.accessToken,
                limit: 50,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { playlists: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getPlaylistVideos(playlistId: string, projectId: string): Promise<{ videos?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Access denied.' };

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${playlistId}/videos`, {
            params: {
                fields: 'id,title,description,source,picture,length,created_time',
                access_token: project.accessToken,
                limit: 50,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { videos: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  PAGE ROLES / ASSIGNED USERS
// =================================================================

export async function getPageRoles(projectId: string): Promise<{ roles?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/roles`, {
            params: {
                fields: 'name,role,perms',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { roles: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  BLOCKED PROFILES
// =================================================================

export async function getBlockedProfiles(projectId: string): Promise<{ profiles?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/blocked`, {
            params: { access_token: project.accessToken, limit: 100 }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { profiles: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function blockProfile(profileId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { success: false, error: 'Access denied.' };
    }

    try {
        await axios.post(`https://graph.facebook.com/v23.0/${project.facebookPageId}/blocked`, {
            user: profileId,
            access_token: project.accessToken,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function unblockProfile(profileId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { success: false, error: 'Access denied.' };
    }

    try {
        await axios.delete(`https://graph.facebook.com/v23.0/${project.facebookPageId}/blocked`, {
            params: { access_token: project.accessToken },
            data: { user: profileId },
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


// =================================================================
//  VISITOR POSTS & TAGGED POSTS
// =================================================================

export async function getVisitorPosts(projectId: string): Promise<{ posts?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/visitor_posts`, {
            params: {
                fields: 'id,message,from{id,name,picture},created_time,full_picture,permalink_url,comments.summary(true),reactions.summary(true)',
                access_token: project.accessToken,
                limit: 50,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { posts: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getTaggedPosts(projectId: string): Promise<{ posts?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/tagged`, {
            params: {
                fields: 'id,message,from{id,name,picture},created_time,full_picture,permalink_url',
                access_token: project.accessToken,
                limit: 50,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { posts: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  POST INSIGHTS (Individual Post Analytics)
// =================================================================

export async function getPostInsights(postId: string, projectId: string): Promise<{ insights?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Access denied.' };

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${postId}/insights`, {
            params: {
                metric: 'post_impressions,post_impressions_unique,post_engaged_users,post_clicks,post_clicks_unique,post_reactions_by_type_total,post_activity_by_action_type',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { insights: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getPostComments(postId: string, projectId: string): Promise<{ comments?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Access denied.' };

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${postId}/comments`, {
            params: {
                fields: 'id,message,from{id,name,picture},created_time,like_count,comment_count,attachment,parent',
                access_token: project.accessToken,
                limit: 100,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { comments: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getCommentReplies(commentId: string, projectId: string): Promise<{ replies?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Access denied.' };

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${commentId}/comments`, {
            params: {
                fields: 'id,message,from{id,name,picture},created_time,like_count',
                access_token: project.accessToken,
                limit: 100,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { replies: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  ENHANCED PAGE INSIGHTS (All Metrics)
// =================================================================

export async function getDetailedPageInsights(
    projectId: string,
    opts?: { metrics?: string; period?: 'day' | 'week' | 'days_28' | 'month' | 'lifetime'; since?: string; until?: string }
): Promise<{ insights?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    const defaultMetrics = [
        'page_impressions', 'page_impressions_unique',
        'page_engaged_users', 'page_post_engagements',
        'page_fan_adds', 'page_fan_removes', 'page_fans',
        'page_views_total', 'page_actions_post_reactions_total',
        'page_video_views',
    ].join(',');

    try {
        const params: any = {
            metric: opts?.metrics || defaultMetrics,
            period: opts?.period || 'days_28',
            access_token: project.accessToken,
        };
        if (opts?.since) params.since = opts.since;
        if (opts?.until) params.until = opts.until;

        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/insights`, { params });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { insights: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getPageFanDemographics(projectId: string): Promise<{ demographics?: any, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/insights`, {
            params: {
                metric: 'page_fans_city,page_fans_country,page_fans_gender_age',
                period: 'lifetime',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));

        const data = response.data.data || [];
        const demographics: any = {};
        for (const metric of data) {
            const lastValue = metric.values?.[metric.values.length - 1]?.value;
            demographics[metric.name] = lastValue || {};
        }
        return { demographics };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  LIVE VIDEOS (Direct Graph API)
// =================================================================

export async function getPageLiveVideos(projectId: string): Promise<{ liveVideos?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/live_videos`, {
            params: {
                fields: 'id,title,description,status,embed_html,creation_time,live_views,permalink_url,video{source,picture,length}',
                access_token: project.accessToken,
                limit: 25,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { liveVideos: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function createLiveVideo(projectId: string, title: string, description?: string): Promise<{ liveVideo?: any, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const payload: any = {
            title,
            status: 'LIVE_NOW',
            access_token: project.accessToken,
        };
        if (description) payload.description = description;

        const response = await axios.post(`https://graph.facebook.com/v23.0/${project.facebookPageId}/live_videos`, payload);
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { liveVideo: response.data };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function endLiveVideo(liveVideoId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Access denied.' };

    try {
        await axios.post(`https://graph.facebook.com/v23.0/${liveVideoId}`, {
            end_live_video: true,
            access_token: project.accessToken,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getLiveVideoComments(liveVideoId: string, projectId: string): Promise<{ comments?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Access denied.' };

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${liveVideoId}/comments`, {
            params: {
                fields: 'id,message,from{id,name,picture},created_time',
                access_token: project.accessToken,
                limit: 100,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { comments: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  PAGE SETTINGS & LOCATIONS
// =================================================================

export async function getPageSettings(projectId: string): Promise<{ settings?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/settings`, {
            params: { access_token: project.accessToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { settings: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getPageLocations(projectId: string): Promise<{ locations?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/locations`, {
            params: {
                fields: 'id,name,location{city,country,latitude,longitude,street,zip},phone,website',
                access_token: project.accessToken,
                limit: 100,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { locations: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  PAGE TABS
// =================================================================

export async function getPageTabs(projectId: string): Promise<{ tabs?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/tabs`, {
            params: {
                fields: 'id,name,link,position,is_permanent,image_url,application',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { tabs: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  TOKEN MANAGEMENT (Debug / Inspect / Refresh)
// =================================================================

export async function debugAccessToken(projectId: string): Promise<{ tokenInfo?: any, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Access denied.' };

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) return { error: 'Server credentials not configured.' };

    try {
        const appToken = `${appId}|${appSecret}`;
        const response = await axios.get(`https://graph.facebook.com/v23.0/debug_token`, {
            params: { input_token: project.accessToken, access_token: appToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { tokenInfo: response.data.data };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function refreshLongLivedToken(projectId: string): Promise<{ success: boolean; newExpiry?: number; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Access denied.' };

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) return { success: false, error: 'Server credentials not configured.' };

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/oauth/access_token`, {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: appId,
                client_secret: appSecret,
                fb_exchange_token: project.accessToken,
            }
        });

        const newToken = response.data.access_token;
        const expiresIn = response.data.expires_in;
        if (!newToken) return { success: false, error: 'Failed to refresh token.' };

        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: project._id },
            { $set: { accessToken: newToken, tokenRefreshedAt: new Date() } }
        );

        return { success: true, newExpiry: expiresIn };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


// =================================================================
//  BUSINESS MANAGER UTILITIES
// =================================================================

export async function getBusinessDetails(projectId: string): Promise<{ business?: any, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.businessId) {
        return { error: 'Project not found or business ID not linked.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.businessId}`, {
            params: {
                fields: 'id,name,primary_page,link,created_time,timezone_id,verification_status,profile_picture_uri',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { business: response.data };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getBusinessOwnedPages(projectId: string): Promise<{ pages?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.businessId) {
        return { error: 'Project not found or business ID not linked.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.businessId}/owned_pages`, {
            params: {
                fields: 'id,name,category,picture{url},fan_count,link',
                access_token: project.accessToken,
                limit: 100,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { pages: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getBusinessOwnedAdAccounts(projectId: string): Promise<{ adAccounts?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.businessId) {
        return { error: 'Project not found or business ID not linked.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.businessId}/owned_ad_accounts`, {
            params: {
                fields: 'id,name,account_id,account_status,currency,amount_spent,balance',
                access_token: project.accessToken,
                limit: 100,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { adAccounts: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getBusinessOwnedInstagramAccounts(projectId: string): Promise<{ accounts?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.businessId) {
        return { error: 'Project not found or business ID not linked.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.businessId}/owned_instagram_accounts`, {
            params: {
                fields: 'id,username,profile_picture_url,followers_count',
                access_token: project.accessToken,
                limit: 100,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { accounts: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getBusinessSystemUsers(projectId: string): Promise<{ systemUsers?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.businessId) {
        return { error: 'Project not found or business ID not linked.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.businessId}/system_users`, {
            params: {
                fields: 'id,name,role,created_by',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { systemUsers: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getBusinessUsers(projectId: string): Promise<{ users?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.businessId) {
        return { error: 'Project not found or business ID not linked.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.businessId}/business_users`, {
            params: {
                fields: 'id,name,email,role,created_time',
                access_token: project.accessToken,
                limit: 100,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { users: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getBusinessPendingUsers(projectId: string): Promise<{ pendingUsers?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.businessId) {
        return { error: 'Project not found or business ID not linked.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.businessId}/pending_users`, {
            params: {
                fields: 'id,email,role,status,created_time',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { pendingUsers: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function inviteBusinessUser(projectId: string, email: string, role: 'ADMIN' | 'EMPLOYEE' | 'FINANCE_EDITOR' | 'FINANCE_ANALYST'): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.businessId) {
        return { success: false, error: 'Project not found or business ID not linked.' };
    }

    try {
        await axios.post(`https://graph.facebook.com/v23.0/${project.businessId}/business_users`, {
            email,
            role,
            access_token: project.accessToken,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


// =================================================================
//  SEND MEDIA MESSAGES (Messenger - Image, Video, File, Audio)
// =================================================================

export async function sendFacebookMediaMessage(projectId: string, recipientId: string, mediaType: 'image' | 'video' | 'audio' | 'file', mediaUrl: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Access denied.' };

    try {
        await axios.post(`https://graph.facebook.com/v23.0/me/messages`, {
            recipient: { id: recipientId },
            messaging_type: 'RESPONSE',
            message: {
                attachment: {
                    type: mediaType,
                    payload: { url: mediaUrl, is_reusable: true },
                },
            },
        }, {
            params: { access_token: project.accessToken },
        });
        revalidatePath('/dashboard/facebook/messages');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function sendFacebookButtonTemplate(
    projectId: string,
    recipientId: string,
    text: string,
    buttons: { type: 'web_url' | 'postback'; title: string; url?: string; payload?: string }[]
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Access denied.' };

    try {
        await axios.post(`https://graph.facebook.com/v23.0/me/messages`, {
            recipient: { id: recipientId },
            messaging_type: 'RESPONSE',
            message: {
                attachment: {
                    type: 'template',
                    payload: { template_type: 'button', text, buttons },
                },
            },
        }, {
            params: { access_token: project.accessToken },
        });
        revalidatePath('/dashboard/facebook/messages');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function sendFacebookGenericTemplate(
    projectId: string,
    recipientId: string,
    elements: { title: string; subtitle?: string; image_url?: string; default_action?: any; buttons?: any[] }[]
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Access denied.' };

    try {
        await axios.post(`https://graph.facebook.com/v23.0/me/messages`, {
            recipient: { id: recipientId },
            messaging_type: 'RESPONSE',
            message: {
                attachment: {
                    type: 'template',
                    payload: { template_type: 'generic', elements },
                },
            },
        }, {
            params: { access_token: project.accessToken },
        });
        revalidatePath('/dashboard/facebook/messages');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function sendFacebookQuickReplies(
    projectId: string,
    recipientId: string,
    text: string,
    quickReplies: { content_type: 'text' | 'user_phone_number' | 'user_email'; title?: string; payload?: string; image_url?: string }[]
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Access denied.' };

    try {
        await axios.post(`https://graph.facebook.com/v23.0/me/messages`, {
            recipient: { id: recipientId },
            messaging_type: 'RESPONSE',
            message: { text, quick_replies: quickReplies },
        }, {
            params: { access_token: project.accessToken },
        });
        revalidatePath('/dashboard/facebook/messages');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


// =================================================================
//  PERSONAS (Messenger Bot Personas)
// =================================================================

export async function getPersonas(projectId: string): Promise<{ personas?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/me/personas`, {
            params: { access_token: project.accessToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { personas: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function createPersona(projectId: string, name: string, profilePictureUrl: string): Promise<{ personaId?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { error: 'Access denied.' };

    try {
        const response = await axios.post(`https://graph.facebook.com/v23.0/me/personas`, {
            name,
            profile_picture_url: profilePictureUrl,
            access_token: project.accessToken,
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { personaId: response.data.id };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deletePersona(personaId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) return { success: false, error: 'Access denied.' };

    try {
        await axios.delete(`https://graph.facebook.com/v23.0/${personaId}`, {
            params: { access_token: project.accessToken }
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


// =================================================================
//  SEARCH CONVERSATIONS (Messenger)
// =================================================================

export async function searchFacebookConversations(projectId: string, query: string): Promise<{ conversations?: FacebookConversation[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        // Facebook doesn't have a direct search endpoint for conversations,
        // so we fetch all and filter by participant name or snippet
        const { conversations, error } = await getFacebookConversations(projectId);
        if (error) return { error };

        const lowerQuery = query.toLowerCase();
        const filtered = (conversations || []).filter(c => {
            const participantMatch = c.participants?.data?.some(
                (p: any) => p.name?.toLowerCase().includes(lowerQuery)
            );
            const snippetMatch = c.snippet?.toLowerCase().includes(lowerQuery);
            return participantMatch || snippetMatch;
        });

        return { conversations: filtered };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  PAGE PUBLISHED POSTS (with pagination)
// =================================================================

export async function getPublishedPosts(projectId: string, limit: number = 25, after?: string): Promise<{ posts?: FacebookPost[], paging?: any, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or is missing Facebook Page ID or access token.' };
    }

    try {
        const params: any = {
            fields: 'id,message,permalink_url,created_time,full_picture,type,status_type,attachments{media,media_type,url,title,description},reactions.summary(true),comments.summary(true),shares',
            access_token: project.accessToken,
            limit,
        };
        if (after) params.after = after;

        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/published_posts`, { params });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { posts: response.data.data || [], paging: response.data.paging };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  WEBHOOK SUBSCRIPTION MANAGEMENT
// =================================================================

export async function getSubscribedApps(projectId: string): Promise<{ apps?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/subscribed_apps`, {
            params: { access_token: project.accessToken }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { apps: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateWebhookSubscription(projectId: string, subscribedFields: string[]): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { success: false, error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.post(`https://graph.facebook.com/v23.0/${project.facebookPageId}/subscribed_apps`, {
            subscribed_fields: subscribedFields.join(','),
            access_token: project.accessToken,
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { success: response.data.success === true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function unsubscribeApp(projectId: string): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { success: false, error: 'Project not found or missing configuration.' };
    }

    try {
        await axios.delete(`https://graph.facebook.com/v23.0/${project.facebookPageId}/subscribed_apps`, {
            params: { access_token: project.accessToken }
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


// =================================================================
//  PAGE CALL-TO-ACTION BUTTON
// =================================================================

export async function getPageCallToAction(projectId: string): Promise<{ cta?: any, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}`, {
            params: {
                fields: 'call_to_actions',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { cta: response.data.call_to_actions?.data?.[0] || null };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function setPageCallToAction(
    projectId: string,
    type: 'BOOK_NOW' | 'CALL_NOW' | 'CONTACT_US' | 'GET_QUOTE' | 'MESSAGE_PAGE' | 'ORDER_FOOD' | 'SHOP_NOW' | 'SIGN_UP' | 'WATCH_VIDEO' | 'SEND_EMAIL' | 'LEARN_MORE',
    webUrl?: string,
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { success: false, error: 'Project not found or missing configuration.' };
    }

    try {
        const payload: any = {
            type,
            access_token: project.accessToken,
        };
        if (webUrl) payload.web_url = webUrl;

        await axios.post(`https://graph.facebook.com/v23.0/${project.facebookPageId}/call_to_actions`, payload);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


// =================================================================
//  SAVED RESPONSES (Messenger Quick Replies)
// =================================================================

export async function getSavedResponses(projectId: string): Promise<{ responses?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/me/saved_message_responses`, {
            params: {
                fields: 'id,title,message,is_enabled,image',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { responses: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function createSavedResponse(
    prevState: { message?: string; error?: string },
    formData: FormData
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const title = formData.get('title') as string;
    const message = formData.get('message') as string;
    const image = formData.get('image') as string;

    if (!projectId || !title || !message) {
        return { error: 'Project ID, title, and message are required.' };
    }

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project is not fully configured for Facebook.' };
    }

    try {
        const payload: any = {
            title,
            message,
            access_token: project.accessToken,
        };
        if (image) payload.image = image;

        await axios.post(`https://graph.facebook.com/v23.0/${project.facebookPageId}/saved_message_responses`, payload);
        return { message: 'Saved response created successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateSavedResponse(
    responseId: string,
    projectId: string,
    title: string,
    message: string
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied.' };
    }

    try {
        await axios.post(`https://graph.facebook.com/v23.0/${responseId}`, {
            title,
            message,
            access_token: project.accessToken,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteSavedResponse(
    responseId: string,
    projectId: string
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied.' };
    }

    try {
        await axios.delete(`https://graph.facebook.com/v23.0/${responseId}`, {
            params: { access_token: project.accessToken }
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


// =================================================================
//  REUSABLE MESSAGE ATTACHMENTS
// =================================================================

export async function uploadReusableAttachment(
    projectId: string,
    type: 'image' | 'video' | 'audio' | 'file',
    url: string
): Promise<{ attachmentId?: string; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.post(`https://graph.facebook.com/v23.0/me/message_attachments`, {
            message: {
                attachment: {
                    type,
                    payload: {
                        is_reusable: true,
                        url,
                    }
                }
            },
            access_token: project.accessToken,
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { attachmentId: response.data.attachment_id };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  HANDOVER PROTOCOL (Bot ↔ Human Agent)
// =================================================================

export async function passThreadControl(
    projectId: string,
    psid: string,
    targetAppId: string,
    metadata?: string
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied.' };
    }

    try {
        const payload: any = {
            recipient: { id: psid },
            target_app_id: targetAppId,
            access_token: project.accessToken,
        };
        if (metadata) payload.metadata = metadata;

        await axios.post(`https://graph.facebook.com/v23.0/me/pass_thread_control`, payload);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function takeThreadControl(
    projectId: string,
    psid: string,
    metadata?: string
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied.' };
    }

    try {
        const payload: any = {
            recipient: { id: psid },
            access_token: project.accessToken,
        };
        if (metadata) payload.metadata = metadata;

        await axios.post(`https://graph.facebook.com/v23.0/me/take_thread_control`, payload);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function requestThreadControl(
    projectId: string,
    psid: string,
    metadata?: string
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied.' };
    }

    try {
        const payload: any = {
            recipient: { id: psid },
            access_token: project.accessToken,
        };
        if (metadata) payload.metadata = metadata;

        await axios.post(`https://graph.facebook.com/v23.0/me/request_thread_control`, payload);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getSecondaryReceivers(projectId: string): Promise<{ receivers?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Access denied.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/me/secondary_receivers`, {
            params: {
                fields: 'id,name',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { receivers: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  ONE-TIME NOTIFICATION
// =================================================================

export async function sendOneTimeNotifRequest(
    projectId: string,
    psid: string,
    title: string,
    payload: string
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied.' };
    }

    try {
        await axios.post(`https://graph.facebook.com/v23.0/me/messages`, {
            recipient: { id: psid },
            message: {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'one_time_notif_req',
                        title,
                        payload,
                    }
                }
            },
            access_token: project.accessToken,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function sendOneTimeNotification(
    projectId: string,
    token: string,
    messageText: string
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied.' };
    }

    try {
        await axios.post(`https://graph.facebook.com/v23.0/me/messages`, {
            recipient: { one_time_notif_token: token },
            message: { text: messageText },
            access_token: project.accessToken,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


// =================================================================
//  RECURRING NOTIFICATIONS
// =================================================================

export async function sendRecurringNotifOptIn(
    projectId: string,
    psid: string,
    title: string,
    imageUrl: string,
    payload: string,
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied.' };
    }

    try {
        await axios.post(`https://graph.facebook.com/v23.0/me/messages`, {
            recipient: { id: psid },
            message: {
                attachment: {
                    type: 'template',
                    payload: {
                        template_type: 'notification_messages',
                        title,
                        image_url: imageUrl,
                        payload,
                        notification_messages_frequency: frequency,
                    }
                }
            },
            access_token: project.accessToken,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function sendRecurringNotification(
    projectId: string,
    token: string,
    messageText: string
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied.' };
    }

    try {
        await axios.post(`https://graph.facebook.com/v23.0/me/messages`, {
            recipient: { notification_messages_token: token },
            message: { text: messageText },
            access_token: project.accessToken,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


// =================================================================
//  PAGE REELS
// =================================================================

export async function getPageReels(projectId: string): Promise<{ reels?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/video_reels`, {
            params: {
                fields: 'id,description,created_time,updated_time,length,permalink_url,picture,source',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { reels: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function publishPageReel(
    prevState: { message?: string; error?: string },
    formData: FormData
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const description = formData.get('description') as string;
    const videoFile = formData.get('videoFile') as File;

    if (!projectId || !videoFile || videoFile.size === 0) {
        return { error: 'Project ID and a video file are required.' };
    }

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project is not fully configured for Facebook.' };
    }

    const { facebookPageId, accessToken } = project;

    try {
        // Phase 1: Start upload session
        const startResponse = await axios.post(`https://graph.facebook.com/v23.0/${facebookPageId}/video_reels`, {
            upload_phase: 'start',
            access_token: accessToken,
        });
        if (startResponse.data.error) throw new Error(getErrorMessage({ response: startResponse }));
        const videoId = startResponse.data.video_id;

        // Phase 2: Upload binary to rupload endpoint
        const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
        const uploadForm = new NodeFormData();
        uploadForm.append('access_token', accessToken);
        uploadForm.append('source', videoBuffer, { filename: videoFile.name, contentType: videoFile.type });

        await axios.post(`https://rupload.facebook.com/video-upload/v23.0/${videoId}`, uploadForm, {
            headers: {
                ...uploadForm.getHeaders(),
                'offset': '0',
                'file_size': String(videoBuffer.length),
            }
        });

        // Phase 3: Finish and publish
        const finishPayload: any = {
            upload_phase: 'finish',
            video_id: videoId,
            access_token: accessToken,
        };
        if (description) finishPayload.description = description;

        await axios.post(`https://graph.facebook.com/v23.0/${facebookPageId}/video_reels`, finishPayload);
        revalidatePath('/dashboard/facebook');
        return { message: 'Reel published successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  PAGE STORIES
// =================================================================

export async function getPageStories(projectId: string): Promise<{ stories?: any[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}/stories`, {
            params: {
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { stories: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function publishPhotoStory(
    projectId: string,
    photoUrl: string
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { success: false, error: 'Project not found or missing configuration.' };
    }

    const { facebookPageId, accessToken } = project;

    try {
        // Step 1: Upload photo as unpublished
        const photoResponse = await axios.post(`https://graph.facebook.com/v23.0/${facebookPageId}/photos`, {
            url: photoUrl,
            published: false,
            access_token: accessToken,
        });
        if (photoResponse.data.error) throw new Error(getErrorMessage({ response: photoResponse }));
        const photoId = photoResponse.data.id;

        // Step 2: Create photo story
        await axios.post(`https://graph.facebook.com/v23.0/${facebookPageId}/photo_stories`, {
            photo_id: photoId,
            access_token: accessToken,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function publishVideoStory(
    projectId: string,
    videoUrl: string
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { success: false, error: 'Project not found or missing configuration.' };
    }

    const { facebookPageId, accessToken } = project;

    try {
        // Phase 1: Start upload session
        const startResponse = await axios.post(`https://graph.facebook.com/v23.0/${facebookPageId}/video_stories`, {
            upload_phase: 'start',
            access_token: accessToken,
        });
        if (startResponse.data.error) throw new Error(getErrorMessage({ response: startResponse }));
        const videoId = startResponse.data.video_id;

        // Phase 2: Upload video by URL
        await axios.post(`https://rupload.facebook.com/video-upload/v23.0/${videoId}`, null, {
            params: {
                access_token: accessToken,
                file_url: videoUrl,
            }
        });

        // Phase 3: Finish and publish
        await axios.post(`https://graph.facebook.com/v23.0/${facebookPageId}/video_stories`, {
            upload_phase: 'finish',
            video_id: videoId,
            access_token: accessToken,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


// =================================================================
//  MESSAGING FEATURE REVIEW
// =================================================================

export async function getMessagingFeatureReview(projectId: string): Promise<{ features?: { feature: string; status: string }[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Access denied.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/me/messaging_feature_review`, {
            params: {
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { features: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  PUBLISHING AUTHORIZATION
// =================================================================

export async function getPublishingAuthStatus(projectId: string): Promise<{ data?: any, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or missing configuration.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${project.facebookPageId}`, {
            params: {
                fields: 'publishing_authorization_status,is_published,verification_status',
                access_token: project.accessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { data: response.data };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


// =================================================================
//  COMMERCE — ORDER MANAGEMENT
// =================================================================

export async function fulfillOrder(
    orderId: string,
    projectId: string,
    trackingInfo: { carrier: string; tracking_number: string }
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied.' };
    }

    try {
        await axios.post(`https://graph.facebook.com/v23.0/${orderId}/shipments`, {
            tracking: trackingInfo,
            access_token: project.accessToken,
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function cancelOrder(
    orderId: string,
    projectId: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied.' };
    }

    try {
        const payload: any = {
            access_token: project.accessToken,
        };
        if (reason) payload.reason = reason;

        await axios.post(`https://graph.facebook.com/v23.0/${orderId}/cancellations`, payload);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function refundOrder(
    orderId: string,
    projectId: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied.' };
    }

    try {
        const payload: any = {
            access_token: project.accessToken,
        };
        if (reason) payload.reason = reason;

        await axios.post(`https://graph.facebook.com/v23.0/${orderId}/refunds`, payload);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

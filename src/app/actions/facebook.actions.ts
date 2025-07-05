

'use server';

import { revalidatePath } from 'next/cache';
import axios from 'axios';
import { ObjectId, type WithId } from 'mongodb';
import FormData from 'form-data';

import { getErrorMessage } from '@/lib/utils';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById, getSession } from '@/app/actions';
import type { AdCampaign, Project, FacebookPage, CustomAudience, FacebookPost, FacebookPageDetails, PageInsights, FacebookConversation, FacebookMessage } from '@/lib/definitions';


export async function handleFacebookPageSetup(data: {
    projectId: string;
    adAccountId: string;
    facebookPageId: string;
    accessToken: string;
}): Promise<{ success?: boolean; error?: string }> {
    const { projectId, adAccountId, facebookPageId, accessToken } = data;

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };

    if (!adAccountId || !facebookPageId || !accessToken) {
        return { error: 'Required information (Ad Account, Page ID, Token) was not received from Facebook.' };
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { adAccountId, facebookPageId, accessToken } } // Also update the token to be the latest one
        );
        revalidatePath('/dashboard/facebook');
        revalidatePath('/dashboard/facebook/settings');
        revalidatePath('/dashboard/facebook/all-projects');
        return { success: true };
    } catch (e: any) {
        return { error: 'Failed to save marketing settings.' };
    }
}

export async function handleFacebookOAuthCallback(code: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied." };

    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
        return { success: false, error: 'Server is not configured for Facebook authentication. NEXT_PUBLIC_APP_URL is not set.' };
    }
    const redirectUri = new URL('/auth/facebook/callback', appUrl).toString();

    if (!appId || !appSecret) {
        return { success: false, error: 'Server is not configured for Facebook authentication. Please ensure NEXT_PUBLIC_FACEBOOK_APP_ID and FACEBOOK_APP_SECRET are set in your environment variables.' };
    }

    try {
        // 1. Exchange code for a short-lived access token
        const tokenResponse = await axios.get('https://graph.facebook.com/v22.0/oauth/access_token', {
            params: {
                client_id: appId,
                redirect_uri: redirectUri,
                client_secret: appSecret,
                code: code,
            }
        });
        const shortLivedToken = tokenResponse.data.access_token;
        if (!shortLivedToken) return { success: false, error: 'Failed to obtain access token from Facebook.' };
        
        // 2. Exchange for a long-lived token
        const longLivedResponse = await axios.get('https://graph.facebook.com/v22.0/oauth/access_token', {
            params: {
                grant_type: 'fb_exchange_token',
                client_id: appId,
                client_secret: appSecret,
                fb_exchange_token: shortLivedToken,
            }
        });
        const longLivedToken = longLivedResponse.data.access_token;
        if (!longLivedToken) return { success: false, error: 'Could not obtain a long-lived token from Facebook.' };

        // 3. Fetch user's ad account (optional)
        let adAccountId: string | undefined;
        try {
            const adAccountsResponse = await axios.get('https://graph.facebook.com/v22.0/me/adaccounts', { params: { access_token: longLivedToken }});
            if (adAccountsResponse.data?.data?.[0]?.id) {
                adAccountId = adAccountsResponse.data.data[0].id;
            }
        } catch (e) {
            console.warn("Could not retrieve ad account for user:", getErrorMessage(e));
        }

        // 4. Fetch all pages the user has access to, including their individual page access tokens
        const pagesResponse = await axios.get('https://graph.facebook.com/v22.0/me/accounts', { params: { fields: 'id,name,access_token', access_token: longLivedToken }});
        const userPages = pagesResponse.data?.data;

        if (!userPages || userPages.length === 0) {
             return { success: false, error: 'No manageable Facebook Pages found for your account. Please ensure you have granted access to at least one page during the authorization process.' };
        }

        // 5. For each page, create or update a project
        const { db } = await connectToDatabase();
        const bulkOps = userPages.map((page: any) => ({
            updateOne: {
                filter: { userId: new ObjectId(session.user._id), facebookPageId: page.id },
                update: {
                    $set: {
                        name: page.name,
                        accessToken: page.access_token, // Use the page-specific access token
                        adAccountId: adAccountId,
                    },
                    $setOnInsert: {
                        userId: new ObjectId(session.user._id),
                        facebookPageId: page.id,
                        phoneNumbers: [],
                        createdAt: new Date(),
                        messagesPerSecond: 10000,
                    },
                },
                upsert: true,
            },
        }));

        if (bulkOps.length > 0) {
            await db.collection('projects').bulkWrite(bulkOps);
        }

        revalidatePath('/dashboard/facebook/all-projects');
        return { success: true };
    } catch(e) {
        console.error("Facebook OAuth Callback failed:", e);
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function handleManualFacebookPageSetup(prevState: any, formData: FormData): Promise<{ success?: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied." };

    const projectName = formData.get('projectName') as string;
    const facebookPageId = formData.get('facebookPageId') as string;
    const adAccountId = formData.get('adAccountId') as string;
    const accessToken = formData.get('accessToken') as string;

    if (!projectName || !facebookPageId || !adAccountId || !accessToken) {
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

        const newProject: Omit<Project, '_id'> = {
            userId: new ObjectId(session.user._id),
            name: projectName,
            facebookPageId: facebookPageId,
            adAccountId: adAccountId,
            accessToken: accessToken,
            phoneNumbers: [],
            createdAt: new Date(),
            messagesPerSecond: 10000,
        };

        await db.collection('projects').insertOne(newProject as any);
        revalidatePath('/dashboard/facebook/all-projects');
        return { success: true };

    } catch (e: any) {
        return { error: 'Failed to save manual project settings.' };
    }
}


export async function getAdCampaigns(projectId: string): Promise<WithId<AdCampaign>[]> {
    if (!ObjectId.isValid(projectId)) return [];
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const ads = await db.collection<AdCampaign>('ad_campaigns')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(ads));
    } catch (e) {
        return [];
    }
}

export async function handleCreateWhatsAppAd(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };

    const { adAccountId, facebookPageId, accessToken } = hasAccess;
    if (!adAccountId || !facebookPageId || !accessToken) {
        return { error: 'Project is missing Ad Account ID, Facebook Page ID, or Access Token. Please configure these in Project Settings > Marketing.' };
    }

    const campaignName = formData.get('campaignName') as string;
    const dailyBudget = Number(formData.get('dailyBudget')) * 100; 
    const adMessage = formData.get('adMessage') as string;
    const adPhoneNumberId = formData.get('adPhoneNumber') as string;

    if (!campaignName || isNaN(dailyBudget) || !adMessage || !adPhoneNumberId) {
        return { error: 'All fields are required to create an ad.' };
    }

    const { db } = await connectToDatabase();
    const phoneNumber = hasAccess.phoneNumbers.find(p => p.id === adPhoneNumberId);
    if (!phoneNumber) {
        return { error: 'Selected phone number not found in project.' };
    }
    const waId = phoneNumber.display_phone_number.replace(/\D/g, '');


    try {
        const apiVersion = 'v22.0';

        const campaignResponse = await axios.post(
            `https://graph.facebook.com/${apiVersion}/act_${adAccountId}/campaigns`,
            {
                name: campaignName,
                objective: 'MESSAGES',
                status: 'PAUSED',
                special_ad_categories: [],
                access_token: accessToken,
            }
        );
        const campaignId = campaignResponse.data.id;
        if (!campaignId) throw new Error('Failed to create campaign, no ID returned.');

        const adSetResponse = await axios.post(
            `https://graph.facebook.com/${apiVersion}/act_${adAccountId}/adsets`,
            {
                name: `${campaignName} Ad Set`,
                campaign_id: campaignId,
                daily_budget: dailyBudget,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'REPLIES', 
                promoted_object: {
                    page_id: facebookPageId,
                },
                targeting: {
                    geo_locations: { countries: ['IN'] },
                    age_min: 18,
                },
                status: 'PAUSED',
                access_token: accessToken,
            }
        );
        const adSetId = adSetResponse.data.id;
        if (!adSetId) throw new Error('Failed to create ad set, no ID returned.');

        const creativeResponse = await axios.post(
            `https://graph.facebook.com/${apiVersion}/act_${adAccountId}/adcreatives`,
            {
                name: `${campaignName} Ad Creative`,
                object_story_spec: {
                    page_id: facebookPageId,
                    link_data: {
                        message: adMessage,
                        link: `https://wa.me/${waId}`,
                        call_to_action: {
                            type: 'MESSAGE_PAGE',
                        },
                    },
                },
                access_token: accessToken,
            }
        );
        const creativeId = creativeResponse.data.id;
        if (!creativeId) throw new Error('Failed to create ad creative, no ID returned.');

        const adResponse = await axios.post(
            `https://graph.facebook.com/${apiVersion}/act_${adAccountId}/ads`,
            {
                name: `${campaignName} Ad`,
                adset_id: adSetId,
                creative: { creative_id: creativeId },
                status: 'PAUSED',
                access_token: accessToken,
            }
        );
        const adId = adResponse.data.id;
        if (!adId) throw new Error('Failed to create ad, no ID returned.');

        const newAdCampaign: Omit<AdCampaign, '_id'> = {
            projectId: new ObjectId(projectId),
            name: campaignName,
            status: 'PAUSED',
            dailyBudget: dailyBudget / 100, 
            metaCampaignId: campaignId,
            metaAdSetId: adSetId,
            metaAdCreativeId: creativeId,
            metaAdId: adId,
            createdAt: new Date(),
        };
        await db.collection('ad_campaigns').insertOne(newAdCampaign as any);

        revalidatePath('/dashboard/facebook/ads');
        return { message: `Ad campaign "${campaignName}" created successfully! It is currently paused.` };

    } catch (e: any) {
        console.error('Failed to create WhatsApp Ad:', getErrorMessage(e));
        return { error: getErrorMessage(e) || 'An unexpected error occurred during ad creation.' };
    }
}

export async function getFacebookPages(projectId: string): Promise<{ pages?: FacebookPage[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token is missing.' };
    }

    try {
        const response = await axios.get(`https://graph.facebook.com/v22.0/me/accounts`, {
            params: {
                fields: 'id,name,category,tasks',
                access_token: project.accessToken,
            }
        });

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }
        
        return { pages: response.data.data || [] };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getPageDetails(projectId: string): Promise<{ page?: FacebookPageDetails, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.facebookPageId) {
        return { error: 'Project not found or is missing Facebook Page ID or access token.' };
    }

    try {
        const fields = 'id,name,about,category,fan_count,followers_count,link,location,phone,website,picture.width(100).height(100)';
        const response = await axios.get(`https://graph.facebook.com/v22.0/${project.facebookPageId}`, {
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


export async function getCustomAudiences(projectId: string): Promise<{ audiences?: CustomAudience[], error?: string }> {
     const project = await getProjectById(projectId);
    if (!project || !project.accessToken || !project.adAccountId) {
        return { error: 'Project not found or is missing Ad Account ID or access token.' };
    }
    
    try {
        const response = await axios.get(`https://graph.facebook.com/v22.0/act_${project.adAccountId}/customaudiences`, {
             params: {
                fields: 'id,name,description,approximate_count_lower_bound,delivery_status,operation_status,time_updated',
                access_token: project.accessToken,
            }
        });

        if (response.data.error) {
            throw new Error(getErrorMessage({ response }));
        }
        
        return { audiences: response.data.data || [] };

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
        const response = await axios.get(`https://graph.facebook.com/v22.0/${project.facebookPageId}/posts`, {
            params: {
                fields: 'id,message,full_picture,permalink_url,created_time,object_id,shares,reactions.summary(true),comments.summary(true){id,message,from,created_time,comments{id,message,from,created_time}}',
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
    const apiVersion = 'v22.0';
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
        await axios.post(`https://graph.facebook.com/v22.0/${postId}`, {
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
        await axios.delete(`https://graph.facebook.com/v22.0/${postId}`, {
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

        await axios.post(`https://graph.facebook.com/v22.0/${videoId}/thumbnails`, form, {
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
        const response = await axios.get(`https://graph.facebook.com/v22.0/${postId}/crosspost_eligible_pages`, {
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
        await axios.post(`https://graph.facebook.com/v22.0/${postId}/crosspost`, {
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
        await axios.post(`https://graph.facebook.com/v22.0/${pageId}`, payload);
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
        const response = await axios.get(`https://graph.facebook.com/v22.0/${project.facebookPageId}/insights`, {
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
    const objectId = formData.get('objectId') as string; // Post or Video ID
    const message = formData.get('message') as string;

    if (!projectId || !objectId || !message) {
        return { success: false, error: 'Missing required information.' };
    }

    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { success: false, error: 'Access denied or project not configured.' };
    }

    try {
        await axios.post(`https://graph.facebook.com/v22.0/${objectId}/comments`, {
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
        await axios.delete(`https://graph.facebook.com/v22.0/${commentId}`, {
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
        await axios.post(`https://graph.facebook.com/v22.0/${objectId}/likes`, {
            access_token: project.accessToken
        });
        revalidatePath('/dashboard/facebook/posts');
        return { success: true };
    } catch (e: any) {
        // Facebook returns an error if you try to like something twice, so we can ignore that specific error.
        if (e.response?.data?.error?.code === 1705) {
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
        const response = await axios.get(`https://graph.facebook.com/v22.0/${project.facebookPageId}/promotable_posts`, {
            params: {
                is_published: false,
                fields: 'id,message,full_picture,permalink_url,created_time,scheduled_publish_time',
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
        await axios.post(`https://graph.facebook.com/v22.0/${postId}`, {
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
        const response = await axios.get(`https://graph.facebook.com/v22.0/${project.facebookPageId}/conversations`, {
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
        const response = await axios.get(`https://graph.facebook.com/v22.0/${conversationId}/messages`, {
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
        const response = await axios.post(`https://graph.facebook.com/v22.0/me/messages`, 
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
    

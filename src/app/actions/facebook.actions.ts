

'use server';

import { revalidatePath } from 'next/cache';
import axios from 'axios';
import { ObjectId, type WithId } from 'mongodb';
import FormData from 'form-data';

import { getErrorMessage } from '@/lib/utils';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import type { AdCampaign, Project, FacebookPage, CustomAudience, FacebookPost } from '@/lib/definitions';


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
        return { success: true };
    } catch (e: any) {
        return { error: 'Failed to save marketing settings.' };
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
                fields: 'id,message,full_picture,permalink_url,created_time',
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
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

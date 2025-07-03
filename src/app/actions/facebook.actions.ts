
'use server';

import { revalidatePath } from 'next/cache';
import axios from 'axios';
import { ObjectId, type WithId } from 'mongodb';

import { getErrorMessage } from '@/lib/utils';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import type { AdCampaign, Project } from '@/lib/definitions';


export async function handleUpdateMarketingSettings(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const adAccountId = formData.get('adAccountId') as string;
    const facebookPageId = formData.get('facebookPageId') as string;

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };

    if (!adAccountId || !facebookPageId) {
        return { error: 'Both Ad Account ID and Facebook Page ID are required.' };
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { adAccountId, facebookPageId } }
        );
        revalidatePath('/dashboard/settings');
        return { message: 'Marketing settings updated successfully!' };
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

        revalidatePath('/dashboard/whatsapp-ads');
        return { message: `Ad campaign "${campaignName}" created successfully! It is currently paused.` };

    } catch (e: any) {
        console.error('Failed to create WhatsApp Ad:', getErrorMessage(e));
        return { error: getErrorMessage(e) || 'An unexpected error occurred during ad creation.' };
    }
}

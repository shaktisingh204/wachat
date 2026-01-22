
'use server';

import { revalidatePath } from 'next/cache';
import axios from 'axios';
import { ObjectId, type WithId } from 'mongodb';

import { getErrorMessage } from '@/lib/utils';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { AdCampaign, Project, CustomAudience, User, FacebookPage } from '@/lib/definitions';

const API_VERSION = 'v23.0';

export async function getAdAccounts(): Promise<{ accounts: any[], error?: string }> {
    const session = await getSession();
    if (!session?.user) return { accounts: [], error: 'Authentication required.' };
    
    // Ad accounts are now stored on the user object
    return { accounts: session.user.metaAdAccounts || [] };
}


export async function getAdCampaigns(adAccountId: string): Promise<{ campaigns?: WithId<AdCampaign>[], error?: string }> {
    const session = await getSession();
    if (!session?.user?.facebookUserAccessToken) return { campaigns: [], error: 'Facebook account not connected.' };
    
    if (!adAccountId) return { campaigns: [] };

    try {
        const { db } = await connectToDatabase();
        const localCampaigns = await db.collection<AdCampaign>('ad_campaigns')
            .find({ adAccountId: adAccountId, userId: new ObjectId(session.user._id) })
            .sort({ createdAt: -1 })
            .toArray();
            
        if (localCampaigns.length === 0) {
            return { campaigns: [] };
        }

        const adIds = localCampaigns.map(c => c.metaAdId);
        
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}`, {
            params: {
                ids: adIds.join(','),
                fields: 'status,insights{impressions, clicks, spend, ctr}',
                access_token: session.user.facebookUserAccessToken
            }
        });
        
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        
        const metaData = response.data;

        const combinedData = localCampaigns.map(campaign => {
            const metaAd = metaData[campaign.metaAdId];
            return metaAd ? { ...campaign, status: metaAd.status || campaign.status, insights: metaAd.insights?.data?.[0] || {} } : campaign;
        });

        return { campaigns: JSON.parse(JSON.stringify(combinedData)) };
    } catch (e) {
        console.error("Failed to fetch ad campaigns with insights:", getErrorMessage(e));
        return { error: getErrorMessage(e) };
    }
}

export async function getFacebookPagesForAdCreation(): Promise<{ pages?: FacebookPage[], error?: string }> {
    const session = await getSession();
    if (!session?.user?.facebookUserAccessToken) return { error: 'Facebook account not connected.' };
    
    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/me/accounts`, {
            params: {
                fields: 'id,name',
                access_token: session.user.facebookUserAccessToken,
            }
        });
        if (response.data.error) throw new Error(getErrorMessage({ response }));
        return { pages: response.data.data || [] };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function handleCreateAdCampaign(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user?.facebookUserAccessToken) return { error: 'Authentication required.' };

    const adAccountId = formData.get('adAccountId') as string;
    const facebookPageId = formData.get('facebookPageId') as string;
    const campaignName = formData.get('campaignName') as string;
    const dailyBudget = Number(formData.get('dailyBudget')) * 100;
    const adMessage = formData.get('adMessage') as string;
    const destinationUrl = formData.get('destinationUrl') as string;

    if (!adAccountId || !facebookPageId || !campaignName || isNaN(dailyBudget) || !adMessage || !destinationUrl) {
        return { error: 'All fields are required.' };
    }

    const { db } = await connectToDatabase();

    try {
        // Step 1: Create Campaign
        const campaignResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/act_${adAccountId}/campaigns`, {
            name: campaignName, objective: 'LINK_CLICKS', status: 'PAUSED', special_ad_categories: [], access_token: session.user.facebookUserAccessToken,
        });
        const campaignId = campaignResponse.data.id;
        if (!campaignId) throw new Error('Failed to create campaign.');

        // Step 2: Create Ad Set
        const adSetResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/act_${adAccountId}/adsets`, {
            name: `${campaignName} Ad Set`, campaign_id: campaignId, daily_budget: dailyBudget, billing_event: 'IMPRESSIONS', optimization_goal: 'LINK_CLICKS',
            targeting: { geo_locations: { countries: ['IN'] }, age_min: 18 }, status: 'PAUSED', access_token: session.user.facebookUserAccessToken,
        });
        const adSetId = adSetResponse.data.id;
        if (!adSetId) throw new Error('Failed to create ad set.');
        
        // Step 3: Create Ad Creative
        const creativeResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/act_${adAccountId}/adcreatives`, {
            name: `${campaignName} Ad Creative`,
            object_story_spec: {
                page_id: facebookPageId,
                link_data: { message: adMessage, link: destinationUrl, image_url: 'https://placehold.co/1200x628.png', call_to_action: { type: 'LEARN_MORE' } },
            },
            access_token: session.user.facebookUserAccessToken,
        });
        const creativeId = creativeResponse.data.id;
        if (!creativeId) throw new Error('Failed to create ad creative.');

        // Step 4: Create Ad
        const adResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/act_${adAccountId}/ads`, {
            name: `${campaignName} Ad`, adset_id: adSetId, creative: { creative_id: creativeId }, status: 'PAUSED', access_token: session.user.facebookUserAccessToken,
        });
        const adId = adResponse.data.id;
        if (!adId) throw new Error('Failed to create ad.');

        const newAdCampaign: Omit<AdCampaign, '_id'> = {
            userId: new ObjectId(session.user._id),
            adAccountId: adAccountId,
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

        revalidatePath('/dashboard/ad-manager/campaigns');
        return { message: `Ad campaign "${campaignName}" created successfully! It is currently paused.` };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getCustomAudiences(adAccountId: string): Promise<{ audiences?: CustomAudience[], error?: string }> {
     const session = await getSession();
    if (!session?.user?.facebookUserAccessToken) return { error: 'Facebook account not connected.' };
    
    if (!adAccountId) return { audiences: [] };
    
    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/act_${adAccountId}/customaudiences`, {
             params: {
                fields: 'id,name,description,approximate_count_lower_bound,delivery_status,operation_status,time_updated',
                access_token: session.user.facebookUserAccessToken,
            }
        });

        if (response.data.error) throw new Error(getErrorMessage({ response }));
        
        return { audiences: response.data.data || [] };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

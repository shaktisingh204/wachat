
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import axios from 'axios';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/index';
import type { Project, Template, CallingSettings } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { premadeTemplates } from '@/lib/premade-templates';

const API_VERSION = 'v23.0';

// --- TEMPLATE ACTIONS ---
export async function getTemplates(projectId: string): Promise<WithId<Template>[]> {
    if (!ObjectId.isValid(projectId)) {
        return [];
    }
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const projection = {
            name: 1,
            category: 1,
            components: 1,
            metaId: 1,
            language: 1,
            body: 1,
            status: 1,
            headerSampleUrl: 1,
            qualityScore: 1,
            type: 1,
        };
        const templates = await db.collection('templates')
            .find({ projectId: new ObjectId(projectId) })
            .project(projection)
            .sort({ name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(templates));
    } catch (error) {
        console.error('Failed to fetch templates:', error);
        return [];
    }
}

export async function getLibraryTemplates() {
    try {
        const { db } = await connectToDatabase();
        const customTemplates = await db.collection('library_templates').find({}).sort({ name: 1 }).toArray();
        const allTemplates = [...premadeTemplates, ...customTemplates];
        return JSON.parse(JSON.stringify(allTemplates));
    } catch (e) {
        console.error("Failed to fetch library templates:", e);
        return premadeTemplates; 
    }
}


// --- WEBHOOK ACTIONS ---

export async function getWebhookSubscriptionStatus(wabaId: string, accessToken: string): Promise<{ isActive: boolean; error?: string }> {
    if (!wabaId || !accessToken) {
        return { isActive: false, error: 'WABA ID or Access Token not provided.' };
    }
    
    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${wabaId}/subscribed_apps`, {
            params: { access_token: accessToken }
        });
        
        const subscriptions = response.data.data;
        if (subscriptions && subscriptions.length > 0) {
            return { isActive: true };
        }
        
        return { isActive: false, error: 'No active subscription found for this WABA.' };
    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error("Webhook status check failed:", errorMessage);
        return { isActive: false, error: errorMessage };
    }
}


export async function handleSubscribeProjectWebhook(wabaId: string, appId: string, accessToken: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Attempt to subscribe to the app first
        const appSubscribeResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/${appId}/subscriptions`, {
            object: 'whatsapp_business_account',
            callback_url: `${process.env.WEBHOOK_CALLBACK_URL || process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/meta`,
            fields: 'account_update,message_template_status_update,messages,phone_number_name_update,phone_number_quality_update,security,template_category_update,calls',
            verify_token: process.env.META_VERIFY_TOKEN,
            access_token: accessToken,
        });

        if (!appSubscribeResponse.data.success) {
            throw new Error("Failed to subscribe app to webhook object.");
        }

        const wabaSubscribeResponse = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${wabaId}/subscribed_apps`,
            {
                access_token: accessToken,
            }
        );
        
        return { success: true };

    } catch (e: any) {
        const errorMessage = getErrorMessage(e);
        console.error(`Failed to subscribe project ${wabaId}:`, errorMessage);
        return { success: false, error: errorMessage };
    }
}

// --- CALLING ACTIONS ---

export async function getPhoneNumberCallingSettings(
  projectId: string,
  phoneNumberId: string
): Promise<{ settings?: CallingSettings; error?: string }> {
  const project = await getProjectById(projectId);
  if (!project || !project.accessToken) {
    return { error: 'Project not found or access token missing.' };
  }

  try {
    const response = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}?fields=calling_settings`,
      {
        params: {
          access_token: project.accessToken,
        },
      }
    );

    const data = response.data;
    if (data.error) {
       if (data.error.code === 100 && data.error.error_subcode === 33) {
        // Field doesn't exist, which is normal for a number not yet configured for calls.
        return { settings: undefined };
      }
      throw new Error(getErrorMessage({ response }));
    }
    
    // The settings are nested under a 'calling_settings' key
    return { settings: data.calling_settings };

  } catch (e: any) {
    const errorMessage = getErrorMessage(e);
    if(errorMessage.includes('(#100)')) {
        return { settings: undefined };
    }
    console.error("Failed to get call settings:", errorMessage);
    return { error: errorMessage };
  }
}

export async function savePhoneNumberCallingSettings(
  prevState: any,
  formData: FormData
): Promise<{ success: boolean; error?: string; payload?: string }> {
  const projectId = formData.get('projectId') as string;
  const phoneNumberId = formData.get('phoneNumberId') as string;
  
  if (!projectId || !phoneNumberId) {
    return { success: false, error: 'Project and Phone Number IDs are required.' };
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return { success: false, error: 'Project not found or access denied.' };
  }
  
  let settingsPayload: any = { calling: {} };
  
  try {
    settingsPayload.calling.status = formData.get('status');
    settingsPayload.calling.call_icon_visibility = formData.get('call_icon_visibility');
    settingsPayload.calling.callback_permission_status = formData.get('callback_permission_status');

    if (formData.get('call_hours_status') === 'ENABLED') {
        const weeklyHours = JSON.parse(formData.get('weekly_operating_hours') as string || '[]');
        const holidaySchedule = JSON.parse(formData.get('holiday_schedule') as string || '[]');
        settingsPayload.calling.call_hours = {
            status: 'ENABLED',
            timezone_id: formData.get('timezone_id'),
            weekly_operating_hours: weeklyHours,
            holiday_schedule: holidaySchedule,
        };
    } else {
        settingsPayload.calling.call_hours = {
            status: 'DISABLED',
            weekly_operating_hours: [], // Always include empty arrays
            holiday_schedule: [],
        };
    }

    if(formData.get('sip_status') === 'ENABLED' && formData.get('sip_hostname')) {
        const sipParamsString = formData.get('sip_params') as string;
        let sipParams = {};
        try {
            if(sipParamsString) sipParams = JSON.parse(sipParamsString);
        } catch(e) {
            return { success: false, error: 'SIP URI Params is not valid JSON.' };
        }

        settingsPayload.calling.sip = {
            status: 'ENABLED',
            servers: [{
                hostname: formData.get('sip_hostname'),
                port: Number(formData.get('sip_port')),
                request_uri_user_params: sipParams
            }]
        };
    } else {
        settingsPayload.calling.sip = { status: 'DISABLED', servers: [] };
    }
    
    const response = await axios.post(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/settings`,
      settingsPayload,
      { headers: { Authorization: `Bearer ${project.accessToken}` } }
    );
    
    if (response.data.error) throw new Error(getErrorMessage({ response }));
    
    revalidatePath(`/dashboard/calls/settings`);
    return { success: true, payload: JSON.stringify(settingsPayload, null, 2) };
    
  } catch (e: any) {
    console.error('Failed to update calling settings:', e);
    const errorMessage = getErrorMessage(e);
    return { success: false, error: errorMessage };
  }
}

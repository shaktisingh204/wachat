

'use server';

import { getProjectById } from '@/app/actions/project.actions';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';
import { revalidatePath } from 'next/cache';
import type { CallingSettings } from '@/lib/definitions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId, type WithId } from 'mongodb';
import type { CrmCallLog } from '@/lib/definitions';

const API_VERSION = 'v23.0';

export async function getPhoneNumberCallingSettings(projectId: string, phoneNumberId: string): Promise<{ settings?: CallingSettings; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found or access denied." };
    if (!project.wabaId || !project.accessToken) return { error: "Project is not fully configured for Meta API access." };

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/settings`, {
            params: { access_token: project.accessToken }
        });
        
        return { settings: response.data.calling };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function savePhoneNumberCallingSettings(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: "Project not found or access denied." };
    if (!project.wabaId || !project.accessToken) return { success: false, error: "Project is not fully configured for Meta API access." };

    try {
        const callingSettings: Partial<CallingSettings> = {
            status: formData.get('status') as 'ENABLED' | 'DISABLED',
            call_icon_visibility: formData.get('call_icon_visibility') as 'DEFAULT' | 'DISABLE_ALL',
            callback_permission_status: formData.get('callback_permission_status') as 'ENABLED' | 'DISABLED',
        };

        const restrictCountries = (formData.get('restrict_to_user_countries') as string || '')
            .split(',')
            .map(c => c.trim().toUpperCase())
            .filter(Boolean);

        if (restrictCountries.length > 0) {
            callingSettings.call_icons = {
                restrict_to_user_countries: restrictCountries,
            };
        }

        const callHoursStatus = formData.get('call_hours_status') as 'ENABLED' | 'DISABLED';
        if (callHoursStatus === 'ENABLED') {
            callingSettings.call_hours = {
                status: 'ENABLED',
                timezone_id: formData.get('timezone_id') as string,
                weekly_operating_hours: JSON.parse(formData.get('weekly_operating_hours') as string || '[]'),
                holiday_schedule: JSON.parse(formData.get('holiday_schedule') as string || '[]'),
            };
        }

        const sipStatus = formData.get('sip_status') as 'ENABLED' | 'DISABLED';
        const sipHostname = formData.get('sip_hostname') as string;
        if (sipStatus === 'ENABLED' && sipHostname) {
             const sipParamsString = formData.get('sip_params') as string;
             let sipParams = {};
             try {
                if(sipParamsString) sipParams = JSON.parse(sipParamsString);
             } catch {
                return { success: false, error: 'Invalid JSON format for SIP URI Params.' };
             }

            callingSettings.sip = {
                status: 'ENABLED',
                servers: [{
                    hostname: sipHostname,
                    port: Number(formData.get('sip_port')),
                    request_uri_user_params: sipParams
                }]
            };
        }

        const payload = { calling: callingSettings };

        await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/settings`,
            payload,
            { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
        );

        revalidatePath('/dashboard/calls/settings');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getCallLogs(projectId: string): Promise<WithId<CrmCallLog>[]> {
  if (!projectId || !ObjectId.isValid(projectId)) return [];
  try {
    const { db } = await connectToDatabase();
    const logs = await db.collection('crm_call_logs')
      .find({ projectId: new ObjectId(projectId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    return JSON.parse(JSON.stringify(logs));
  } catch (e) {
    console.error("Failed to fetch call logs:", e);
    return [];
  }
}

    
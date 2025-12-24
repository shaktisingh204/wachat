

'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/index.ts';
import type { CallingSettings, Project, PhoneNumber, CallLog } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';

const API_VERSION = 'v23.0';

export async function getPhoneNumberCallingSettings(projectId: string, phoneNumberId: string): Promise<{ settings?: CallingSettings | null; error?: string }> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: 'Access denied' };
    
    const { accessToken } = hasAccess;
    
    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/settings`, {
            params: {
                fields: 'calling',
                access_token: accessToken,
            }
        });
        
        return { settings: response.data?.calling || null };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function savePhoneNumberCallingSettings(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { success: false, error: 'Access denied' };
    
    const { accessToken } = hasAccess;

    try {
        const callingPayload: any = {
            status: formData.get('status') as string,
            call_icon_visibility: formData.get('call_icon_visibility') as string,
            callback_permission_status: formData.get('callback_permission_status') as string,
        };

        const countryRestrictions = (formData.get('restrict_to_user_countries') as string || '')
            .split(',')
            .map(c => c.trim().toUpperCase())
            .filter(Boolean);

        if (countryRestrictions.length > 0) {
            callingPayload.call_icons = {
                restrict_to_user_countries: countryRestrictions
            };
        }

        const callHoursStatus = formData.get('call_hours_status') as string;
        if (callHoursStatus === 'ENABLED') {
            const weeklyHours = JSON.parse(formData.get('weekly_operating_hours') as string);
            const holidaySchedule = JSON.parse(formData.get('holiday_schedule') as string);
            
            callingPayload.call_hours = {
                status: 'ENABLED',
                timezone_id: formData.get('timezone_id') as string,
                weekly_operating_hours: weeklyHours,
                holiday_schedule: holidaySchedule,
            };
        }
        
        const sipStatus = formData.get('sip_status') as string;
        if (sipStatus === 'ENABLED') {
            const sipParams = formData.get('sip_params') as string;
            callingPayload.sip = {
                status: 'ENABLED',
                servers: [
                    {
                        hostname: formData.get('sip_hostname') as string,
                        port: Number(formData.get('sip_port')),
                        ...(sipParams && { request_uri_user_params: JSON.parse(sipParams) })
                    }
                ]
            };
        }
        
        await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/settings`, {
            messaging_product: 'whatsapp',
            calling: callingPayload
        }, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        revalidatePath('/dashboard/calls/settings');
        return { success: true };

    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


// MOCK FUNCTION
export async function getCallLogs(projectId: string): Promise<WithId<CallLog>[]> {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    const now = Date.now();
    return [
        { _id: new ObjectId(), projectId: new ObjectId(projectId), callSid: 'CA123', from: '+15551112222', to: '+15553334444', status: 'completed', duration: 32, direction: 'inbound-api', timestamp: new Date(now - 1000 * 60 * 5) },
        { _id: new ObjectId(), projectId: new ObjectId(projectId), callSid: 'CA456', from: '+15553334444', to: '+15551112222', status: 'no-answer', duration: 0, direction: 'outbound-api', timestamp: new Date(now - 1000 * 60 * 15) },
        { _id: new ObjectId(), projectId: new ObjectId(projectId), callSid: 'CA789', from: '+15552223333', to: '+15553334444', status: 'completed', duration: 128, direction: 'inbound-api', timestamp: new Date(now - 1000 * 60 * 65) },
    ]
}

export async function getApiLogsForProject(projectId: string): Promise<any[]> {
    const { db } = await connectToDatabase();
    const logs = await db.collection('api_logs').find({ projectId: new ObjectId(projectId) }).sort({ createdAt: -1 }).limit(20).toArray();
    return JSON.parse(JSON.stringify(logs));
}

async function logApiCall(projectId: string, phoneNumberId: string, payload: any, response: any, error?: any) {
    const { db } = await connectToDatabase();
    await db.collection('api_logs').insertOne({
        projectId: new ObjectId(projectId),
        phoneNumberId,
        payload,
        response: response?.data,
        status: error ? 'ERROR' : 'SUCCESS',
        errorMessage: error ? getErrorMessage(error) : null,
        method: response?.config?.method?.toUpperCase() || 'POST',
        createdAt: new Date(),
    });
}

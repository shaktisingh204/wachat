

'use server';

import { getProjectById, getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';
import { revalidatePath } from 'next/cache';
import type { CallingSettings } from '@/lib/definitions';

const API_VERSION = 'v24.0';

export async function getCallLogs(projectId: string): Promise<any[]> {
    // This is mock data. In a real application, you would fetch this from your database.
    const mockLogs = [
        { _id: '1', direction: 'inbound-call', from: '+15551234567', to: '+15557654321', duration: 32, status: 'completed', timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), callSid: 'CA123...' },
        { _id: '2', direction: 'outbound-api-call', from: '+15557654321', to: '+15559876543', duration: 0, status: 'no-answer', timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), callSid: 'CA456...' },
        { _id: '3', direction: 'inbound-call', from: '+15551112222', to: '+15557654321', duration: 128, status: 'completed', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), callSid: 'CA789...' },
    ];
    return JSON.parse(JSON.stringify(mockLogs));
}

export async function getPhoneNumberCallingSettings(projectId: string, phoneNumberId: string): Promise<{ settings?: CallingSettings, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project || !project.accessToken) {
        return { error: 'Project not found or access token is missing.' };
    }
    
    try {
        const response = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/settings`,
            {
                params: {
                    fields: 'calling',
                    access_token: project.accessToken
                }
            }
        );
        
        if (response.data.error) {
            throw new Error(getErrorMessage({ response: { data: response.data }}));
        }

        return { settings: response.data.calling };

    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}

async function getApiLogsForProject(projectId: string): Promise<any[]> {
    return []; // Placeholder
}

export async function savePhoneNumberCallingSettings(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess || !hasAccess.accessToken) return { success: false, error: 'Access Denied.' };

    try {
        const weeklyHours = JSON.parse(formData.get('weekly_operating_hours') as string || '[]');
        const holidaySchedule = JSON.parse(formData.get('holiday_schedule') as string || '[]');

        const callingPayload: any = {
            status: formData.get('status'),
            call_icon_visibility: formData.get('call_icon_visibility'),
            callback_permission_status: formData.get('callback_permission_status'),
        };

        if (formData.get('call_hours_status')) {
            callingPayload.call_hours = {
                status: formData.get('call_hours_status'),
                timezone_id: formData.get('timezone_id'),
                weekly_operating_hours: weeklyHours,
                holiday_schedule: holidaySchedule,
            };
        }

        if (formData.get('sip_status')) {
            callingPayload.sip = {
                status: formData.get('sip_status'),
                servers: [
                    {
                        hostname: formData.get('sip_hostname'),
                        port: formData.get('sip_port'),
                    }
                ]
            };
            const paramsStr = formData.get('sip_params') as string;
            if (paramsStr) {
                try {
                    callingPayload.sip.servers[0].request_uri_user_params = JSON.parse(paramsStr);
                } catch (e) {
                    return { success: false, error: "Invalid JSON format for SIP URI Params." };
                }
            }
        }
        
        const payload = {
            messaging_product: 'whatsapp',
            calling: callingPayload
        };

        const response = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/settings`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${hasAccess.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.error) {
            throw new Error(getErrorMessage({ response: { data: response.data }}));
        }

        revalidatePath('/dashboard/calls/settings');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export { getApiLogsForProject };


'use server';

import { getProjectById } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';
import { revalidatePath } from 'next/cache';
import type { CallingSettings } from '@/lib/definitions';

const API_VERSION = 'v23.0';

export async function getPhoneNumberCallingSettings(projectId: string, phoneNumberId: string): Promise<{ settings?: CallingSettings, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found or access denied." };

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/settings`, {
            params: {
                fields: 'calling',
                access_token: project.accessToken,
            }
        });
        
        if (response.data.error) {
            throw new Error(response.data.error.message);
        }

        return { settings: response.data.calling };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function savePhoneNumberCallingSettings(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    if (!projectId || !phoneNumberId) return { success: false, error: "Missing project or phone number ID." };

    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: "Access denied." };

    try {
        const weeklyHours = JSON.parse(formData.get('weekly_operating_hours') as string || '[]');
        const holidaySchedule = JSON.parse(formData.get('holiday_schedule') as string || '[]');
        const restrictToCountries = (formData.get('restrict_to_user_countries') as string || '')
            .split(',')
            .map(c => c.trim().toUpperCase())
            .filter(Boolean);

        const sipParamsString = formData.get('sip_params') as string || '';
        let sipParams = {};
        if (sipParamsString) {
            try {
                sipParams = JSON.parse(sipParamsString);
            } catch {
                return { success: false, error: 'Invalid JSON format for SIP URI Params.'};
            }
        }

        const callingPayload: any = {
            status: formData.get('status'),
            call_icon_visibility: formData.get('call_icon_visibility'),
            callback_permission_status: formData.get('callback_permission_status'),
            call_hours: {
                status: formData.get('call_hours_status'),
                timezone_id: formData.get('timezone_id'),
                weekly_operating_hours: weeklyHours,
                holiday_schedule: holidaySchedule
            },
            call_icons: {
                restrict_to_user_countries: restrictToCountries
            },
            sip: {
                status: formData.get('sip_status'),
                servers: formData.get('sip_hostname') ? [{
                    hostname: formData.get('sip_hostname'),
                    port: Number(formData.get('sip_port')),
                    request_uri_user_params: sipParams
                }] : []
            }
        };

        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/settings`,
            { calling: callingPayload },
            {
                headers: {
                    'Authorization': `Bearer ${project.accessToken}`
                }
            }
        );

        if (response.data.error) {
            throw new Error(response.data.error.message);
        }

        revalidatePath('/dashboard/calls/settings');
        return { success: true };

    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getCallLogs(projectId: string): Promise<any[]> {
    console.log(`Fetching call logs for project: ${projectId}`);
    // In a real app, this would query a database.
    // For now, returning mock data.
    await new Promise(resolve => setTimeout(resolve, 500));
    return [
        { _id: '1', from: '+15551234567', to: '+15557654321', direction: 'inbound-unanswered', duration: 0, status: 'no-answer', timestamp: new Date(Date.now() - 5 * 60 * 1000), callSid: 'CA123...' },
        { _id: '2', from: '+15557654321', to: '+15559876543', direction: 'outbound-api', duration: 125, status: 'completed', timestamp: new Date(Date.now() - 15 * 60 * 1000), callSid: 'CA456...' },
        { _id: '3', from: '+15551112222', to: '+15557654321', direction: 'inbound', duration: 340, status: 'completed', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), callSid: 'CA789...' },
    ];
}

export async function getApiLogsForProject(projectId: string): Promise<any[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    // Mock data
    return [
      { _id: 'log1', method: 'POST', status: 'SUCCESS', createdAt: new Date(Date.now() - 10 * 60 * 1000), payload: { calling: { status: 'ENABLED' } }, response: { success: true } },
      { _id: 'log2', method: 'POST', status: 'FAILED', createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), payload: { calling: { status: 'INVALID' } }, errorMessage: 'Invalid parameter' }
    ];
}

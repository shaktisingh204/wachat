'use server';

import { getProjectById } from "./user.actions";
import { getErrorMessage } from "@/lib/utils";
import type { CallingSettings } from "@/lib/definitions";
import axios from 'axios';

const API_VERSION = 'v23.0';

export async function getPhoneNumberCallingSettings(projectId: string, phoneNumberId: string): Promise<{ settings?: Partial<CallingSettings>, error?: string }> {
    try {
        const project = await getProjectById(projectId);
        if (!project || !project.accessToken) {
            return { error: 'Project not found or access token is missing.' };
        }

        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/settings`, {
            params: {
                fields: 'calling',
                access_token: project.accessToken,
            }
        });

        if (response.data.error) {
            throw new Error(getErrorMessage({ response: { data: response.data }}));
        }

        return { settings: response.data.calling || {} };

    } catch (e: any) {
        console.error("Failed to get calling settings:", e);
        return { error: getErrorMessage(e) };
    }
}

export async function savePhoneNumberCallingSettings(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    
    if (!projectId || !phoneNumberId) return { success: false, error: 'Missing required IDs.' };

    try {
        const project = await getProjectById(projectId);
        if (!project || !project.accessToken) {
            return { success: false, error: 'Project not found or access token is missing.' };
        }

        const weeklyOperatingHours = JSON.parse(formData.get('weekly_operating_hours') as string || '[]');
        const holidaySchedule = JSON.parse(formData.get('holiday_schedule') as string || '[]');

        const callingPayload: Partial<CallingSettings> = {
            status: formData.get('status') as CallingSettings['status'],
            call_icon_visibility: formData.get('call_icon_visibility') as CallingSettings['call_icon_visibility'],
            callback_permission_status: formData.get('callback_permission_status') as CallingSettings['callback_permission_status'],
        };

        const restrictCountries = (formData.get('restrict_to_user_countries') as string || '').split(',').map(c => c.trim()).filter(Boolean);
        if (restrictCountries.length > 0) {
            callingPayload.call_icons = { restrict_to_user_countries: restrictCountries };
        }
        
        if (formData.get('call_hours_status') === 'ENABLED') {
            callingPayload.call_hours = {
                status: 'ENABLED',
                timezone_id: formData.get('timezone_id') as string,
                weekly_operating_hours: weeklyOperatingHours,
                holiday_schedule: holidaySchedule,
            };
        }

        if (formData.get('sip_status') === 'ENABLED') {
            const sipParamsStr = formData.get('sip_params') as string;
            let sipParams;
            if (sipParamsStr) {
                try {
                    sipParams = JSON.parse(sipParamsStr);
                } catch {
                     return { success: false, error: 'SIP URI Params is not valid JSON.' };
                }
            }
            
            callingPayload.sip = {
                status: 'ENABLED',
                servers: [{
                    hostname: formData.get('sip_hostname') as string,
                    port: Number(formData.get('sip_port')),
                    ...(sipParams && { request_uri_user_params: sipParams })
                }]
            };
        }
        
        const response = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/settings`,
            { calling: callingPayload },
            { headers: { Authorization: `Bearer ${project.accessToken}` } }
        );

        if (response.data.error) {
            throw new Error(getErrorMessage({ response: { data: response.data }}));
        }

        return { success: true };

    } catch (e: any) {
         console.error("Failed to save calling settings:", e);
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getCallLogs(projectId: string): Promise<any[]> {
    // Placeholder - in a real app, this would fetch from your database
    // where you log calls via webhooks.
    await new Promise(resolve => setTimeout(resolve, 1000));
    return [
        { _id: '1', direction: 'inbound', from: '+15551234567', to: '+15559876543', duration: 32, status: 'completed', timestamp: new Date(Date.now() - 5 * 60 * 1000), callSid: 'CA123...' },
        { _id: '2', direction: 'outbound', from: '+15559876543', to: '+15557654321', duration: 0, status: 'no-answer', timestamp: new Date(Date.now() - 15 * 60 * 1000), callSid: 'CA456...' },
        { _id: '3', direction: 'inbound', from: '+15558889999', to: '+15559876543', duration: 120, status: 'completed', timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), callSid: 'CA789...' },
    ];
}

export async function getApiLogsForProject(projectId: string): Promise<any[]> {
    // Placeholder for fetching API call logs related to calling settings
    return [];
}

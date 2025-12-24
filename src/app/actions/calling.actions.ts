
'use server';

import { getProjectById } from '@/app/actions/project.actions';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';
import { revalidatePath } from 'next/cache';
import type { CallingSettings, WithId, Project, PhoneNumber, WeeklyOperatingHours, HolidaySchedule } from '@/lib/definitions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const API_VERSION = 'v23.0';

export async function getPhoneNumberCallingSettings(projectId: string, phoneNumberId: string): Promise<{ settings?: Partial<CallingSettings>, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found." };
    
    const phone = project.phoneNumbers.find(p => p.id === phoneNumberId);
    if (!phone) return { error: "Phone number not found." };
    
    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}`, {
            params: {
                fields: 'calling',
                access_token: project.accessToken
            }
        });

        if (response.data.error) {
            throw new Error(getErrorMessage({ response: response }));
        }

        return { settings: response.data.calling || {} };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function savePhoneNumberCallingSettings(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;

    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: "Project not found." };
    
    try {
        const callingPayload: any = {
            status: formData.get('status')
        };
        
        const callIconVisibility = formData.get('call_icon_visibility') as string;
        if (callIconVisibility) {
            callingPayload.call_icon_visibility = callIconVisibility;
        }

        const restrictToCountries = (formData.get('restrict_to_user_countries') as string || '').split(',').map(c => c.trim()).filter(Boolean);
        if (restrictToCountries.length > 0) {
            callingPayload.call_icons = {
                restrict_to_user_countries: restrictToCountries
            };
        }

        const callbackPermission = formData.get('callback_permission_status') as string;
        if (callbackPermission) {
            callingPayload.callback_permission_status = callbackPermission;
        }

        // --- Call Hours Logic ---
        const callHoursStatus = formData.get('call_hours_status') as string;
        if (callHoursStatus) {
            const weeklyHours: WeeklyOperatingHours[] = JSON.parse(formData.get('weekly_operating_hours') as string || '[]');
            const holidaySchedule: HolidaySchedule[] = JSON.parse(formData.get('holiday_schedule') as string || '[]');
            
            callingPayload.call_hours = {
                status: callHoursStatus,
                timezone_id: formData.get('timezone_id') as string,
                weekly_operating_hours: weeklyHours,
                holiday_schedule: holidaySchedule
            };
        }

        // --- SIP Logic ---
        const sipStatus = formData.get('sip_status') as string;
        if (sipStatus) {
            callingPayload.sip = { status: sipStatus };
            if (sipStatus === 'ENABLED') {
                callingPayload.sip.servers = [{
                    hostname: formData.get('sip_hostname') as string,
                    port: Number(formData.get('sip_port')),
                    ...(formData.get('sip_params') && { request_uri_user_params: JSON.parse(formData.get('sip_params') as string) })
                }];
            }
        }
        
        const payload = { calling: callingPayload };

        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/settings`, payload, {
            headers: { 'Authorization': `Bearer ${project.accessToken}` }
        });
        
        if (response.data.error) {
            throw new Error(getErrorMessage({ response: response }));
        }

        revalidatePath('/dashboard/calls/settings');
        return { success: true };

    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

// Placeholder for fetching actual call logs
export async function getCallLogs(projectId: string): Promise<any[]> {
    console.log(`Fetching call logs for project: ${projectId}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    // In a real app, this would query a database
    return [
        { _id: '1', from: '+15551234567', to: '+15559876543', direction: 'inbound', duration: 32, status: 'completed', timestamp: new Date(Date.now() - 2 * 60 * 1000), callSid: 'CA123...' },
        { _id: '2', from: '+15559876543', to: '+15557654321', direction: 'outbound', duration: 0, status: 'no-answer', timestamp: new Date(Date.now() - 15 * 60 * 1000), callSid: 'CA456...' },
        { _id: '3', from: '+15551112222', to: '+15559876543', direction: 'inbound-dial', duration: 128, status: 'completed', timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), callSid: 'CA789...' },
    ];
}


export async function getApiLogsForProject(projectId: string): Promise<any[]> {
    console.log(`Fetching API logs for project: ${projectId}`);
    return [];
}

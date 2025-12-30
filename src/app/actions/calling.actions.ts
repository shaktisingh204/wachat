

'use server';

import { getProjectById } from '@/app/actions/index.ts';
import type { CallingSettings, WithId, Project, PhoneNumber } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

const API_VERSION = 'v24.0';

export async function getPhoneNumberCallingSettings(projectId: string, phoneNumberId: string): Promise<{ settings?: CallingSettings; error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found or access denied." };

    try {
        const response = await axios.get(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}?fields=calling`,
            { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
        );
        
        if (response.data.error) {
            throw new Error(response.data.error.message);
        }

        return { settings: response.data.calling };

    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function savePhoneNumberCallingSettings(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    if (!projectId || !phoneNumberId) return { success: false, error: 'Missing required IDs.' };

    const project = await getProjectById(projectId);
    if (!project) return { success: false, error: "Project not found or access denied." };

    try {
        let payload: any = {
            messaging_product: 'whatsapp',
        };

        const status = formData.get('status') as CallingSettings['status'];
        const call_icon_visibility = formData.get('call_icon_visibility') as CallingSettings['call_icon_visibility'];
        const restrict_to_user_countries = (formData.get('restrict_to_user_countries') as string)?.split(',').map(c => c.trim()).filter(Boolean);
        
        if (status) {
            payload.calling = { status };
        } else {
             payload.calling = {
                status: formData.get('call_hours_status') || 'DISABLED',
                call_icon_visibility,
                ...(restrict_to_user_countries && restrict_to_user_countries.length > 0 && { call_icons: { restrict_to_user_countries } }),
                callback_permission_status: formData.get('callback_permission_status'),
                call_hours: {
                    status: formData.get('call_hours_status'),
                    timezone_id: formData.get('timezone_id'),
                    weekly_operating_hours: JSON.parse(formData.get('weekly_operating_hours') as string || '[]'),
                    holiday_schedule: JSON.parse(formData.get('holiday_schedule') as string || '[]'),
                },
                sip: {
                    status: formData.get('sip_status'),
                    servers: [{
                        hostname: formData.get('sip_hostname'),
                        port: Number(formData.get('sip_port')),
                        ...(formData.get('sip_params') && { request_uri_user_params: JSON.parse(formData.get('sip_params') as string) })
                    }]
                }
            };
        }

        const response = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}`,
            payload,
            { headers: { 'Authorization': `Bearer ${project.accessToken}` } }
        );

        if (response.data.error) {
            throw new Error(response.data.error.message);
        }
        
        return { success: true };

    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function getCallLogs(projectId: string) {
    if (!projectId) return [];
    try {
        const { db } = await connectToDatabase();
        return await db.collection('crm_call_logs').find({ projectId: new ObjectId(projectId) }).sort({ createdAt: -1 }).limit(100).toArray();
    } catch(e) {
        return [];
    }
}


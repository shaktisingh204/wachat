

'use server';

import type { WithId, Project, PhoneNumber, CallingSettings, WeeklyOperatingHours, HolidaySchedule } from '@/lib/definitions';
import { getProjectById } from '.';
import axios from 'axios';
import { getErrorMessage } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';


export async function getPhoneNumberCallingSettings(projectId: string, phoneNumberId: string): Promise<{ settings?: CallingSettings, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) {
        return { error: 'Project not found or access denied.' };
    }
    
    try {
        const response = await axios.get(`https://graph.facebook.com/v23.0/${phoneNumberId}`, {
            params: {
                fields: 'calling_settings',
                access_token: project.accessToken
            }
        });

        if (response.data.error) {
            return { error: response.data.error.message };
        }

        return { settings: response.data.calling_settings };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function savePhoneNumberCallingSettings(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;

    const project = await getProjectById(projectId);
    if (!project) {
        return { success: false, error: 'Project not found.' };
    }

    try {
        const weeklyHours = JSON.parse(formData.get('weekly_operating_hours') as string || '[]');
        const holidaySchedule = JSON.parse(formData.get('holiday_schedule') as string || '[]');

        const payload = {
            messaging_product: 'whatsapp',
            calling_settings: {
                status: formData.get('status'),
                call_icon_visibility: formData.get('call_icon_visibility'),
                callback_permission_status: formData.get('callback_permission_status'),
                call_hours: {
                    status: formData.get('call_hours_status'),
                    timezone_id: formData.get('timezone_id'),
                    weekly_operating_hours: weeklyHours,
                    holiday_schedule: holidaySchedule,
                },
                sip: {
                    status: formData.get('sip_status'),
                    servers: [
                        {
                            hostname: formData.get('sip_hostname'),
                            port: formData.get('sip_port') ? Number(formData.get('sip_port')) : undefined,
                            request_uri_user_params: formData.get('sip_params') ? JSON.parse(formData.get('sip_params') as string) : undefined
                        }
                    ]
                }
            }
        };

        const response = await axios.post(`https://graph.facebook.com/v23.0/${phoneNumberId}`, payload, {
            headers: {
                'Authorization': `Bearer ${project.accessToken}`
            }
        });

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
    // In a real application, you would fetch this from your database.
    // For now, we return mock data.
    console.log(`[Mock] Fetching call logs for project: ${projectId}`);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

    const mockLogs = [
        {
            _id: new ObjectId(),
            callSid: 'CA1234567890abcdef1234567890ab',
            direction: 'inbound',
            from: '+15551234567',
            to: '+15557654321',
            duration: 125,
            status: 'completed',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
        {
            _id: new ObjectId(),
            callSid: 'CAfedcba0987654321fedcba098765',
            direction: 'outbound-api',
            from: '+15557654321',
            to: '+15559876543',
            duration: 0,
            status: 'no-answer',
            timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        },
        {
            _id: new ObjectId(),
            callSid: 'CAab12cd34ef56ab78cd90ef12ab34',
            direction: 'outbound-dial',
            from: '+15557654321',
            to: '+15551112222',
            duration: 340,
            status: 'completed',
            timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000), // 26 hours ago
        },
        {
            _id: new ObjectId(),
            callSid: 'CAfe12dc34ba56fe78ba90dc12fe34',
            direction: 'inbound',
            from: '+15553334444',
            to: '+15557654321',
            duration: 0,
            status: 'failed',
            timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
        },
    ];

    return JSON.parse(JSON.stringify(mockLogs));
}


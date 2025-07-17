
'use server';

import { revalidatePath } from 'next/cache';
import type { WithId } from 'mongodb';
import axios from 'axios';
import { getProjectById } from '@/app/actions';
import type { Project, PhoneNumber, CallingSettings } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

const API_VERSION = 'v23.0';

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
       // This error means the field has never been set, which is not a failure case.
       if (data.error.code === 100 && data.error.error_subcode === 33) {
        return { settings: undefined };
      }
      throw new Error(getErrorMessage({ response }));
    }
    
    // The settings are nested under a 'calling_settings' key
    return { settings: data.calling_settings };

  } catch (e: any) {
    const errorMessage = getErrorMessage(e);
     if (errorMessage.includes('(#100) Tried accessing nonexisting field (calling_settings)')) {
        return { settings: undefined };
    }
    console.error("Failed to get call settings:", errorMessage);
    return { error: errorMessage };
  }
}

export async function savePhoneNumberCallingSettings(
  prevState: any,
  formData: FormData
): Promise<{ success: boolean; error?: string, payload?: string }> {
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
            timezone_id: formData.get('timezone_id') as string,
            weekly_operating_hours: weeklyHours,
            holiday_schedule: holidaySchedule,
        };
    } else {
        settingsPayload.calling.call_hours = {
             status: 'DISABLED',
             weekly_operating_hours: [], // Always include empty arrays
             holiday_schedule: [],
             timezone_id: formData.get('timezone_id') as string || 'UTC', // Ensure timezone is present
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
    const errorMessage = getErrorMessage(e);
    console.error('Failed to update calling settings:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

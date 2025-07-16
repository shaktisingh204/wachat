
'use server';

import axios from 'axios';
import { getProjectById } from '@/app/actions';
import { getErrorMessage } from '@/lib/utils';
import type { CallingSettings } from '@/lib/definitions';
import { revalidatePath } from 'next/cache';
import { timezones } from '@/lib/timezones';

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
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}`,
      {
        params: {
          fields: 'calling',
          access_token: project.accessToken,
        },
      }
    );

    if (response.data.error) {
      throw new Error(getErrorMessage({ response }));
    }
    
    // The API returns an empty object if 'calling' is not set up, so we handle that.
    const settings = response.data.calling;
    if (settings && Object.keys(settings).length > 0) {
      return { settings };
    }
    return { settings: undefined };


  } catch (e: any) {
    return { error: getErrorMessage(e) };
  }
}

export async function savePhoneNumberCallingSettings(
  prevState: any,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const projectId = formData.get('projectId') as string;
  const phoneNumberId = formData.get('phoneNumberId') as string;
  if (!projectId || !phoneNumberId) {
    return { success: false, error: 'Project and Phone Number IDs are required.' };
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return { success: false, error: 'Project not found or access denied.' };
  }
  
  try {
    const weeklyHoursRaw = formData.get('weeklyHours') as string;
    const holidayScheduleRaw = formData.get('holidaySchedule') as string;
    const callHoursStatus = formData.get('call_hours_status') as 'ENABLED' | 'DISABLED';

    const settingsPayload: CallingSettings = {
      status: formData.get('status') as 'ENABLED' | 'DISABLED',
      call_icon_visibility: formData.get('call_icon_visibility') as 'DEFAULT' | 'DISABLE_ALL',
      callback_permission_status: formData.get('callback_permission_status') as 'ENABLED' | 'DISABLED',
      call_hours: {
        status: callHoursStatus,
        timezone_id: formData.get('timezone_id') as string,
        weekly_operating_hours: callHoursStatus === 'ENABLED' ? JSON.parse(weeklyHoursRaw) : [],
        holiday_schedule: callHoursStatus === 'ENABLED' ? JSON.parse(holidayScheduleRaw) : [],
      }
    };
    
    // API validation requires timezone_id even if call hours are disabled.
    if (!settingsPayload.call_hours.timezone_id) {
      return { success: false, error: 'Timezone ID is required for call hours configuration.' };
    }

    const response = await axios.post(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}`,
      {
        messaging_product: 'whatsapp',
        calling: settingsPayload
      },
      { headers: { Authorization: `Bearer ${project.accessToken}` } }
    );
    
    if (response.data.error) throw new Error(getErrorMessage({ response }));
    
    revalidatePath(`/dashboard/calls/settings/${phoneNumberId}`);
    return { success: true };
    
  } catch (e: any) {
    console.error('Failed to update calling settings:', e);
    return { success: false, error: getErrorMessage(e) };
  }
}

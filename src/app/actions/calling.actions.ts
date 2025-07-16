
'use server';

import axios from 'axios';
import { getProjectById } from '@/app/actions';
import { getErrorMessage } from '@/lib/utils';
import type { CallingSettings } from '@/lib/definitions';
import { revalidatePath } from 'next/cache';

const API_VERSION = 'v19.0';

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
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/call_settings`,
      {
        params: {
          access_token: project.accessToken,
        },
      }
    );

    const data = response.data;
    if (data.error) {
       // This error code (100) indicates the field doesn't exist yet, which is normal for new numbers.
       // We can treat it as a success case where there are no settings.
      if (data.error.code === 100 && data.error.error_subcode === 33) {
        return { settings: undefined };
      }
      throw new Error(getErrorMessage({ response }));
    }
    
    // The API might return an empty object if no settings are configured.
    if (data && (data.voice || data.video || data.sip)) {
      return { settings: data };
    }
    
    return { settings: undefined };

  } catch (e: any) {
    const errorMessage = getErrorMessage(e);
    // It's not a real error if the field just doesn't exist yet.
    if(errorMessage.includes('(#100)')) {
        return { settings: undefined };
    }
    console.error("Failed to get call settings:", errorMessage);
    return { error: errorMessage };
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
    const settingsPayload: any = {
      voice: {
        enabled: formData.get('voice_enabled') === 'on'
      },
      video: {
        enabled: formData.get('video_enabled') === 'on'
      }
    };

    const sipEnabled = formData.get('sip_enabled') === 'on';
    if (sipEnabled) {
        settingsPayload.sip = {
            enabled: true,
            uri: formData.get('sip_uri'),
            username: formData.get('sip_username'),
            password: formData.get('sip_password'),
        };
        if (!settingsPayload.sip.uri || !settingsPayload.sip.username || !settingsPayload.sip.password) {
            return { success: false, error: 'SIP URI, Username, and Password are required when SIP is enabled.' };
        }
    } else {
        // You may need to explicitly disable SIP if it was previously enabled.
        // The API docs are unclear, but sending enabled:false is safest.
        settingsPayload.sip = { enabled: false };
    }

    const response = await axios.post(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/call_settings`,
      settingsPayload,
      { headers: { Authorization: `Bearer ${project.accessToken}` } }
    );
    
    if (response.data.error) throw new Error(getErrorMessage({ response }));
    
    revalidatePath(`/dashboard/calls/settings`);
    return { success: true };
    
  } catch (e: any) {
    console.error('Failed to update calling settings:', e);
    return { success: false, error: getErrorMessage(e) };
  }
}

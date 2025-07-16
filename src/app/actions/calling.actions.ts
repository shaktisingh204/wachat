
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

    if (response.data.error) {
      // It's not a real error if the field just doesn't exist yet.
      if (response.data.error.code === 100 && response.data.error.message.includes('nonexisting field')) {
        return { settings: undefined };
      }
      throw new Error(getErrorMessage({ response }));
    }
    
    // The API returns an object like { voice: {enabled: true}, video: {enabled: false} }
    const settings = response.data;
    if (settings && (settings.voice || settings.video)) {
      return { settings };
    }
    // Return default/undefined if the object is empty or doesn't have the expected keys
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
    const settingsPayload = {
      voice: {
        enabled: formData.get('voice_enabled') === 'on'
      },
      video: {
        enabled: formData.get('video_enabled') === 'on'
      }
    };

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

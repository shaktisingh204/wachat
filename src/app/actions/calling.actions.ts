
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
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}`,
      {
        params: {
          fields: 'is_calling_enabled,inbound_call_control',
          access_token: project.accessToken,
        },
      }
    );

    const data = response.data;
    if (data.error) {
       // This error code (100) can indicate the field doesn't exist yet, which is normal for new numbers.
      if (data.error.code === 100 && data.error.error_subcode === 33) {
        return { settings: undefined };
      }
      throw new Error(getErrorMessage({ response }));
    }
    
    // The API might return an empty object if no settings are configured.
    if (data && (data.is_calling_enabled !== undefined || data.inbound_call_control)) {
      return { settings: { is_calling_enabled: data.is_calling_enabled, inbound_call_control: data.inbound_call_control } };
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
  projectId: string,
  phoneNumberId: string,
  isCallingEnabled: boolean,
  inboundCallControl: 'DISABLED' | 'CALLBACK_REQUEST'
): Promise<{ success: boolean; error?: string }> {
  if (!projectId || !phoneNumberId) {
    return { success: false, error: 'Project and Phone Number IDs are required.' };
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return { success: false, error: 'Project not found or access denied.' };
  }
  
  try {
    const settingsPayload = {
      is_calling_enabled: isCallingEnabled,
      inbound_call_control: inboundCallControl,
    };

    const response = await axios.post(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/settings`,
      settingsPayload,
      { headers: { Authorization: `Bearer ${project.accessToken}` } }
    );
    
    if (response.data.error) throw new Error(getErrorMessage({ response }));
    
    revalidatePath(`/dashboard/numbers`);
    return { success: true };
    
  } catch (e: any) {
    console.error('Failed to update calling settings:', e);
    return { success: false, error: getErrorMessage(e) };
  }
}

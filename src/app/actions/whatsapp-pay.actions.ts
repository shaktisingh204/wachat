
'use server';

import { getProjectById } from '@/app/actions/project.actions';
import { getErrorMessage } from '@/lib/utils';
import axios from 'axios';
import { revalidatePath } from 'next/cache';
import type { PaymentConfiguration } from '@/lib/definitions';

const API_VERSION = 'v24.0';

export async function getPaymentConfigurations(projectId: string): Promise<{ configurations: PaymentConfiguration[], error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { configurations: [], error: "Project not found or access denied." };
    if (!project.wabaId || !project.accessToken) return { configurations: [], error: "WABA not configured for this project." };

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${project.wabaId}/payment_configurations`, {
            params: {
                access_token: project.accessToken
            }
        });

        if (response.data.data && response.data.data.length > 0 && response.data.data[0].payment_configurations) {
             return { configurations: response.data.data[0].payment_configurations };
        }
        
        return { configurations: [] };

    } catch (e) {
        return { configurations: [], error: getErrorMessage(e) };
    }
}

export async function getPaymentConfigurationByName(projectId: string, configName: string): Promise<{ configuration?: PaymentConfiguration, error?: string }> {
    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found or access denied." };
    if (!project.wabaId || !project.accessToken) return { error: "WABA not configured for this project." };

    try {
        const response = await axios.get(`https://graph.facebook.com/${API_VERSION}/${project.wabaId}/payment_configuration/${configName}`, {
            params: {
                access_token: project.accessToken
            }
        });

        if (response.data.data && response.data.data.length > 0) {
            return { configuration: response.data.data[0] };
        }

        return { error: 'Configuration not found.' };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}


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


export async function handleCreatePaymentConfiguration(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found or access denied." };

    const { wabaId, accessToken } = project;
    if (!wabaId || !accessToken) return { error: "Project is not fully configured for Meta API access." };

    const providerName = formData.get('provider_name') as string;
    
    const payload: any = {
        configuration_name: formData.get('configuration_name'),
        purpose_code: formData.get('purpose_code'),
        merchant_category_code: formData.get('merchant_category_code'),
        provider_name: providerName,
    };
    
    if(providerName === 'upi_vpa') {
        payload.merchant_vpa = formData.get('merchant_vpa');
    } else {
        payload.redirect_url = formData.get('redirect_url');
    }

    try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${wabaId}/payment_configurations`, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data.error) {
            throw new Error(getErrorMessage({ response: { data: response.data } }));
        }

        revalidatePath('/dashboard/whatsapp-pay/settings');
        
        if(response.data.oauth_url) {
            return { message: "Configuration created. Please complete the provider onboarding.", oauth_url: response.data.oauth_url };
        }

        return { message: "UPI VPA configuration created successfully.", oauth_url: null };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleUpdateDataEndpoint(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const configName = formData.get('configurationName') as string;
    const dataEndpointUrl = formData.get('dataEndpointUrl') as string;

    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found or access denied." };

    const { wabaId, accessToken } = project;
    if (!wabaId || !accessToken) return { error: "Project is not fully configured for Meta API access." };

    if (!dataEndpointUrl) {
        return { error: 'Data Endpoint URL is required.' };
    }

    try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${wabaId}/payment_configuration/${configName}`, 
        {
            data_endpoint_url: dataEndpointUrl,
        },
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data.error) {
            throw new Error(getErrorMessage({ response: { data: response.data } }));
        }

        revalidatePath('/dashboard/whatsapp-pay/settings');
        return { message: "Data endpoint updated successfully." };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleRegenerateOauthLink(prevState: any, formData: FormData) {
    const projectId = formData.get('projectId') as string;
    const configName = formData.get('configuration_name') as string;
    const redirectUrl = formData.get('redirect_url') as string;

    const project = await getProjectById(projectId);
    if (!project) return { error: "Project not found or access denied." };

    const { wabaId, accessToken } = project;
    if (!wabaId || !accessToken) return { error: "Project is not fully configured for Meta API access." };

    if (!redirectUrl || !configName) {
        return { error: 'Configuration name and redirect URL are required.' };
    }

    try {
        const response = await axios.post(`https://graph.facebook.com/${API_VERSION}/${wabaId}/generate_payment_configuration_oauth_link`, 
        {
            configuration_name: configName,
            redirect_url: redirectUrl,
        },
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data.error) {
            throw new Error(getErrorMessage({ response: { data: response.data } }));
        }

        return { oauth_url: response.data.oauth_url };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

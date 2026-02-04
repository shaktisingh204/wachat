
import { ISmsProvider } from './types';
import axios from 'axios';

export interface GenericProviderConfig {
    baseUrl: string;
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
    params?: Record<string, string>; // Query params
    bodyTemplate?: string; // JSON string or text with placeholders
    mapping: {
        to: string; // param name for phone number
        message: string; // param name for content
        dltTemplateId?: string; // param name for DLT ID
        dltEntityId?: string;
    };
    successIdentifier?: string; // substring to check in response
}

export class GenericHttpProvider implements ISmsProvider {
    private config: GenericProviderConfig;

    constructor(config: GenericProviderConfig) {
        this.config = config;
    }

    async send(to: string, content: string, dltParams: { dltTemplateId: string; dltPrincipalEntityId: string; dltHeaderId: string; }): Promise<{ messageId: string; status: 'SENT' | 'FAILED' | 'QUEUED'; error?: string; }> {
        try {
            const { baseUrl, method, headers, params, bodyTemplate, mapping } = this.config;

            // Prepare dynamic params
            const finalParams: Record<string, string> = { ...params };
            finalParams[mapping.to] = to;
            finalParams[mapping.message] = content;
            if (mapping.dltTemplateId) finalParams[mapping.dltTemplateId] = dltParams.dltTemplateId;
            if (mapping.dltEntityId) finalParams[mapping.dltEntityId] = dltParams.dltPrincipalEntityId;

            let response;
            if (method === 'GET') {
                response = await axios.get(baseUrl, { params: finalParams, headers });
            } else {
                // If bodyTemplate exists, interpolate it
                let data: any = finalParams;
                if (bodyTemplate) {
                    let bodyStr = bodyTemplate
                        .replace('{{to}}', to)
                        .replace('{{message}}', content)
                        .replace('{{dltTemplateId}}', dltParams.dltTemplateId);
                    try {
                        data = JSON.parse(bodyStr);
                    } catch {
                        data = bodyStr; // send as raw string/form-data
                    }
                }

                response = await axios.post(baseUrl, data, { headers, params: method === 'POST' ? undefined : finalParams });
            }

            // Simple success check
            const isSuccess = response.status >= 200 && response.status < 300;
            // TODO: check successIdentifier if needed

            return {
                messageId: String(response.data?.id || 'ID_Pending'),
                status: isSuccess ? 'SENT' : 'FAILED',
                error: isSuccess ? undefined : 'API Error'
            };

        } catch (error: any) {
            return {
                messageId: '',
                status: 'FAILED',
                error: error.message
            };
        }
    }
}

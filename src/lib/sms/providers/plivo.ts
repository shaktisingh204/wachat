
import { ISmsProvider } from './types';
import axios from 'axios';

export class PlivoAdapter implements ISmsProvider {
    private authId: string;
    private authToken: string;
    private src: string;

    constructor(authId: string, authToken: string, src: string) {
        this.authId = authId;
        this.authToken = authToken;
        this.src = src;
    }

    async send(to: string, content: string, dltParams: { dltTemplateId: string; dltPrincipalEntityId: string; dltHeaderId: string; }): Promise<{ messageId: string; status: 'SENT' | 'FAILED' | 'QUEUED'; error?: string; }> {
        try {
            // Plivo API: POST https://api.plivo.com/v1/Account/{auth_id}/Message/
            const url = `https://api.plivo.com/v1/Account/${this.authId}/Message/`;
            const auth = { username: this.authId, password: this.authToken };

            const payload = {
                src: this.src,
                dst: to,
                text: content,
                // DLT params for Plivo need to be checked. Usually via 'dlt_entity_id' and 'dlt_template_id' params?
                // Checking docs... Plivo supports dlt_entity_id and dlt_template_id
                dlt_entity_id: dltParams.dltPrincipalEntityId,
                dlt_template_id: dltParams.dltTemplateId
            };

            const response = await axios.post(url, payload, { auth });

            if (response.status === 202) {
                return {
                    messageId: response.data.message_uuid[0],
                    status: 'QUEUED',
                };
            }

            return {
                messageId: '',
                status: 'FAILED',
                error: JSON.stringify(response.data)
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


import { ISmsProvider } from './types';
import axios from 'axios';

export class GupshupAdapter implements ISmsProvider {
    private userId: string;
    private password: string;

    constructor(userId: string, pass: string) {
        this.userId = userId;
        this.password = pass;
    }

    async send(to: string, content: string, dltParams: { dltTemplateId: string; dltPrincipalEntityId: string; dltHeaderId: string; }): Promise<{ messageId: string; status: 'SENT' | 'FAILED' | 'QUEUED'; error?: string; }> {
        try {
            // Gupshup Enterprise API
            // http://enterprise.sms.gupshup.com/GatewayAPI/rest?method=sendMessage&send_to=...&msg=...&msg_type=TEXT&userid=...&auth_scheme=plain&password=...&v=1.1&format=text
            // DLT params can be passed as extra args depending on account setup, often &principalEntityId=... &dltTemplateId=...

            const params = {
                method: 'sendMessage',
                send_to: to,
                msg: content,
                msg_type: 'TEXT',
                userid: this.userId,
                auth_scheme: 'plain',
                password: this.password,
                v: '1.1',
                format: 'json',
                principalEntityId: dltParams.dltPrincipalEntityId,
                dltTemplateId: dltParams.dltTemplateId
            };

            const response = await axios.get('http://enterprise.sms.gupshup.com/GatewayAPI/rest', { params });

            // Gupshup response format varies. Success usually starts with "success | <id>"
            const data = response.data;
            let status: 'SENT' | 'FAILED' | 'QUEUED' = 'FAILED';
            let messageId = '';

            if (typeof data === 'string' && data.startsWith('success')) {
                status = 'QUEUED';
                messageId = data.split('|')[1]?.trim() || 'NO_ID';
            } else if (data?.response?.status === 'success') {
                status = 'QUEUED';
                messageId = data.response.id;
            }

            return {
                messageId,
                status,
                error: status === 'FAILED' ? JSON.stringify(data) : undefined
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

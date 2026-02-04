
import { ISmsProvider } from './types';
import axios from 'axios';

export class Msg91Adapter implements ISmsProvider {
    private authKey: string;
    private senderId: string; // 6 char Header

    constructor(authKey: string, senderId: string) {
        this.authKey = authKey;
        this.senderId = senderId;
    }

    async send(to: string, content: string, dltParams: { dltTemplateId: string; dltPrincipalEntityId: string; dltHeaderId: string; }): Promise<{ messageId: string; status: 'SENT' | 'FAILED' | 'QUEUED'; error?: string; }> {
        try {
            // MSG91 v5 API
            // URL: https://api.msg91.com/api/v5/flow/
            // But standard transactional/promotional is often v2 or specific DLT endpoint.
            // Using the 'sendhttp.php' or 'v2/sendsms' endpoint is common for raw text.

            // However, modern MSG91 encourages "Flow" based id. 
            // For RAW DLT sending, we use the specific endpoint.

            // Endpoint: https://api.msg91.com/api/v2/sendsms

            const payload = {
                sender: this.senderId,
                route: '4', // 4 is typically transactional/service
                country: '91',
                sms: [
                    {
                        message: content,
                        to: [to.replace(/\D/g, '')] // Remove non-digits
                    }
                ],
                DLT_TE_ID: dltParams.dltTemplateId
            };

            const response = await axios.post('https://api.msg91.com/api/v2/sendsms', payload, {
                headers: {
                    'authkey': this.authKey,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data?.type === 'error') {
                return {
                    messageId: '',
                    status: 'FAILED',
                    error: response.data.message
                };
            }

            // msg91 returns a request ID
            return {
                messageId: response.data?.message || 'NO_ID',
                status: 'QUEUED', // MSG91 queues it
            };

        } catch (error: any) {
            console.error('MSG91 Send Error:', error);
            return {
                messageId: '',
                status: 'FAILED',
                error: error.message || 'Unknown MSG91 error'
            };
        }
    }
}

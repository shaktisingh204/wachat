
import { ISmsProvider } from './types';
import twilio from 'twilio';

export class TwilioAdapter implements ISmsProvider {
    private client: twilio.Twilio;
    private fromNumber: string;

    constructor(accountSid: string, authToken: string, fromNumber: string) {
        this.client = twilio(accountSid, authToken);
        this.fromNumber = fromNumber;
    }

    async send(to: string, content: string, dltParams: { dltTemplateId: string; dltPrincipalEntityId: string; dltHeaderId: string; }): Promise<{ messageId: string; status: 'SENT' | 'FAILED' | 'QUEUED'; error?: string; }> {
        try {
            // Twilio might require cleaner phone numbers
            const recipient = to.startsWith('+') ? to : `+${to}`;

            // NOTE: DLT params are not natively supported by standard Twilio API in all regions, 
            // but for India routes, they might pass through if registered on Twilio dashboard.
            // We focus on sending the message here.

            const response = await this.client.messages.create({
                body: content,
                from: this.fromNumber,
                to: recipient,
            });

            // Map Twilio status to our status
            let status: 'SENT' | 'FAILED' | 'QUEUED' = 'QUEUED';
            if (response.status === 'sent' || response.status === 'delivered') status = 'SENT';
            if (response.status === 'failed' || response.status === 'undelivered') status = 'FAILED';

            return {
                messageId: response.sid,
                status: status,
                error: response.errorMessage || undefined
            };

        } catch (error: any) {
            console.error('Twilio Send Error:', error);
            return {
                messageId: '',
                status: 'FAILED',
                error: error.message || 'Unknown Twilio error'
            };
        }
    }

    async getBalance(): Promise<number> {
        // Twilio API for balance is a bit distinct, and usually not per sub-account in same way.
        // Skipping implementation for now or can implement fetching Account resource.
        return 0;
    }
}

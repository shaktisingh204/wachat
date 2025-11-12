
'use server';

import { sendSingleSms } from '@/app/actions/sms.actions';
import type { WithId, User } from '@/lib/definitions';
import FormData from 'form-data';

export async function executeSmsAction(actionName: string, inputs: any, user: WithId<User>, logger: any) {
    try {
        const formData = new FormData();
        Object.keys(inputs).forEach(key => {
             if (inputs[key] !== undefined && inputs[key] !== null) {
                formData.append(key, String(inputs[key]));
            }
        });

        switch (actionName) {
            case 'sendSms': {
                formData.append('recipient', inputs.to);
                formData.append('message', inputs.message);

                const result = await sendSingleSms(null, formData);
                if (result.error) throw new Error(result.error);
                return { output: result };
            }
            default:
                throw new Error(`SMS action "${actionName}" is not implemented.`);
        }
    } catch(e: any) {
        return { error: e.message };
    }
}

export const smsActions = [
    {
        name: 'sendSms',
        label: 'Send SMS',
        description: 'Sends a standard SMS message via Twilio.',
        inputs: [
            { name: 'to', label: 'To (Phone Number)', type: 'tel', required: true, placeholder: 'e.g. 919876543210' },
            { name: 'message', label: 'Message', type: 'textarea', required: true },
        ]
    }
];

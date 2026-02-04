

'use server';

import { sendQuickSms } from '@/app/actions/sms-quick.actions';
import type { WithId, User } from '@/lib/definitions';


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
                const recipient = inputs.to;
                const message = inputs.message;

                const result = await sendQuickSms(recipient, message);
                if (!result.success) throw new Error(result.error);
                return { output: result };
            }
            default:
                throw new Error(`SMS action "${actionName}" is not implemented.`);
        }
    } catch (e: any) {
        return { error: e.message };
    }
}

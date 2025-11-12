

'use server';

import { createQrCode } from '@/app/actions/qr-code.actions';
import type { WithId, User } from '@/lib/definitions';
import FormData from 'form-data';

export async function executeQrCodeAction(actionName: string, inputs: any, user: WithId<User>, logger: any) {
    try {
        const formData = new FormData();
        
        switch (actionName) {
            case 'generateQrCode': {
                formData.append('dataType', 'url'); // Simplified for now
                formData.append('data', JSON.stringify({ url: inputs.data }));
                formData.append('name', inputs.name || `FlowQR-${Date.now()}`);
                
                const result = await createQrCode(null, formData);
                if (result.error) throw new Error(result.error);
                return { output: result };
            }
            default:
                throw new Error(`QR Code action "${actionName}" is not implemented.`);
        }
    } catch(e: any) {
        return { error: e.message };
    }
}

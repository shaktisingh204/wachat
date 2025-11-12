
'use server';

import { createShortUrl } from '@/app/actions/url-shortener.actions';
import type { WithId, User } from '@/lib/definitions';
import FormData from 'form-data';

export async function executeUrlShortenerAction(actionName: string, inputs: any, user: WithId<User>, logger: any) {
    try {
        const formData = new FormData();
        
        switch (actionName) {
            case 'createShortLink': {
                formData.append('originalUrl', inputs.longUrl);
                if (inputs.alias) formData.append('alias', inputs.alias);

                const result = await createShortUrl(null, formData);
                if (result.error) throw new Error(result.error);
                
                // Construct the full URL for the context
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
                const fullShortUrl = `${appUrl}/s/${(result as any).shortCode}`;
                
                return { output: { ...result, fullShortUrl } };
            }
            default:
                throw new Error(`URL Shortener action "${actionName}" is not implemented.`);
        }
    } catch(e: any) {
        return { error: e.message };
    }
}

export const urlShortenerActions = [
    {
        name: 'createShortLink',
        label: 'Create Short Link',
        description: 'Creates a new short, trackable link.',
        inputs: [
            { name: 'longUrl', label: 'Original URL', type: 'text', required: true },
            { name: 'alias', label: 'Custom Alias (Optional)', type: 'text' },
        ]
    }
];

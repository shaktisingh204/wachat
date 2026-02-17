
import axios from 'axios';
import NodeFormData from 'form-data';
import { getErrorMessage } from '@/lib/utils';

const API_VERSION = 'v23.0';

/**
 * Uploads media to Meta for WhatsApp Cloud API.
 * @param accessToken Project's access token
 * @param phoneNumberId Phone number ID associated with the project
 * @param base64Data Base64 encoded media data
 * @returns Object containing the media ID
 */
export async function uploadMediaToMeta(accessToken: string, phoneNumberId: string, base64Data: string): Promise<{ id?: string; error?: string }> {
    try {
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return { error: 'Invalid base64 data format.' };
        }

        const type = matches[1];
        const content = matches[2];
        const buffer = Buffer.from(content, 'base64');
        const extension = type.split('/')[1] || 'png';
        const filename = `media-${Date.now()}.${extension}`;

        const form = new NodeFormData();
        const blob = new Blob([buffer], { type });
        form.append('file', blob, filename);
        form.append('messaging_product', 'whatsapp');

        const formHeaders = form.getHeaders();

        const uploadResponse = await axios.post(
            `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/media`,
            form,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    ...formHeaders
                }
            }
        );

        if (uploadResponse.data && uploadResponse.data.id) {
            return { id: uploadResponse.data.id };
        } else {
            return { error: 'Upload failed: No ID returned.' };
        }

    } catch (error: any) {
        return { error: getErrorMessage(error) };
    }
}

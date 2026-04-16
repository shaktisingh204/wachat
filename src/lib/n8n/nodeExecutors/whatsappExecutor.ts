/**
 * WhatsApp executor — sends WhatsApp messages via the SabNode Meta Cloud API
 * integration (same approach used by the broadcast / flow webhook processor).
 *
 * Parameters:
 *   phoneNumberId   – Meta phone-number ID (required)
 *   accessToken     – Meta access token (required, or pulled from credentials)
 *   to              – Recipient WA ID / phone number (required, supports interpolation)
 *   messageType     – 'text' | 'template' | 'image' | 'document' | 'audio' | 'interactive'
 *
 *   [messageType: text]
 *   text            – message body (supports interpolation)
 *   previewUrl      – boolean
 *
 *   [messageType: template]
 *   templateName    – template name
 *   templateLanguage – language code e.g. 'en_US'
 *   templateComponents – array of component objects
 *
 *   [messageType: image / document / audio]
 *   mediaUrl        – publicly accessible URL of the media
 *   caption         – optional caption
 *
 *   [messageType: interactive]
 *   interactive     – raw interactive object passed directly to the API
 *
 *   apiVersion      – Meta API version (default: 'v23.0')
 */

import type { N8NNode, ExecutionContext, NodeExecutorResult } from '../types';
import { interpolateParameters } from '../helpers/interpolateVariables';

const DEFAULT_API_VERSION = 'v23.0';

type MetaTextPayload = {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: { body: string; preview_url?: boolean };
};

type MetaTemplatePayload = {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components?: unknown[];
  };
};

type MetaMediaPayload = {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: string;
  [mediaType: string]: unknown;
};

async function sendMessage(
  phoneNumberId: string,
  accessToken: string,
  payload: Record<string, unknown>,
  apiVersion: string
): Promise<{ wamid: string }> {
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Meta API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json() as { messages?: { id: string }[] };
  const wamid = data.messages?.[0]?.id;
  if (!wamid) throw new Error('WhatsApp message sent but no WAMID returned from Meta');

  return { wamid };
}

export async function executeWhatsApp(
  node: N8NNode,
  inputItems: Record<string, unknown>[],
  context: ExecutionContext
): Promise<NodeExecutorResult> {
  const items = inputItems.length > 0 ? inputItems : [{}];
  const outputItems: Record<string, unknown>[] = [];

  for (let i = 0; i < items.length; i++) {
    const params = interpolateParameters(node.parameters, context, items, i);

    const phoneNumberId = (params.phoneNumberId as string | undefined) ?? '';
    const accessToken = (params.accessToken as string | undefined) ?? '';
    const to = (params.to as string | undefined) ?? '';
    const messageType = (params.messageType as string | undefined) ?? 'text';
    const apiVersion = (params.apiVersion as string | undefined) ?? DEFAULT_API_VERSION;

    if (!phoneNumberId) return { items: [], error: 'WhatsApp node: phoneNumberId is required' };
    if (!accessToken) return { items: [], error: 'WhatsApp node: accessToken is required' };
    if (!to) return { items: [], error: 'WhatsApp node: "to" (recipient) is required' };

    // Normalise recipient — strip leading + if present for Meta API
    const recipient = to.replace(/^\+/, '');

    let payload: Record<string, unknown>;

    switch (messageType) {
      case 'text': {
        const textPayload: MetaTextPayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipient,
          type: 'text',
          text: {
            body: (params.text as string | undefined) ?? '',
            ...(params.previewUrl ? { preview_url: true } : {}),
          },
        };
        payload = textPayload as unknown as Record<string, unknown>;
        break;
      }

      case 'template': {
        const templatePayload: MetaTemplatePayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipient,
          type: 'template',
          template: {
            name: (params.templateName as string) ?? '',
            language: { code: (params.templateLanguage as string) ?? 'en_US' },
            ...(params.templateComponents ? { components: params.templateComponents as unknown[] } : {}),
          },
        };
        payload = templatePayload as unknown as Record<string, unknown>;
        break;
      }

      case 'image':
      case 'document':
      case 'audio':
      case 'video':
      case 'sticker': {
        const mediaPayload: MetaMediaPayload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipient,
          type: messageType,
          [messageType]: {
            link: params.mediaUrl as string,
            ...(params.caption ? { caption: params.caption } : {}),
            ...(params.filename ? { filename: params.filename } : {}),
          },
        };
        payload = mediaPayload as Record<string, unknown>;
        break;
      }

      case 'interactive': {
        payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipient,
          type: 'interactive',
          interactive: params.interactive ?? {},
        };
        break;
      }

      default:
        return { items: [], error: `WhatsApp node: unsupported messageType "${messageType}"` };
    }

    try {
      const { wamid } = await sendMessage(phoneNumberId, accessToken, payload, apiVersion);
      outputItems.push({
        ...items[i],
        wamid,
        to: recipient,
        messageType,
        sentAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { items: [], error: msg };
    }
  }

  return { items: outputItems };
}

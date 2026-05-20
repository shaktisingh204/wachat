/**
 * Forge block: WhatsApp Cloud API (Meta Graph)
 *
 * Source: n8n-master/packages/nodes-base/nodes/WhatsApp/WhatsApp.node.ts (+ MessagesDescription.ts, GenericFunctions.ts)
 * Credential type: 'whatsapp' — { phoneNumberId, accessToken, businessAccountId } from CREDENTIAL_FIELD_SCHEMAS.
 *
 * Operations covered (selected from the message resource):
 *   - send_text       POST   /{phone-id}/messages   { type: 'text' }
 *   - send_template   POST   /{phone-id}/messages   { type: 'template' }
 *   - send_media      POST   /{phone-id}/messages   { type: 'image'|'document'|'video'|'audio' }
 *   - send_location   POST   /{phone-id}/messages   { type: 'location' }
 *   - send_contacts   POST   /{phone-id}/messages   { type: 'contacts' }
 *   - media_get       GET    /{media-id}            (resolve to download URL)
 *   - media_delete    DELETE /{media-id}
 *
 * Out of scope for the first port:
 *   - Binary media upload (POST /{phone-id}/media — requires multipart binary support)
 *   - Interactive button / list builders (callers can hand-craft via send_template `components`)
 *   - sendTemplate component builder UI — accept a JSON `components` blob instead
 *   - SEND_AND_WAIT_OPERATION
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

const WHATSAPP_BASE = 'https://graph.facebook.com/v19.0';

type WhatsAppCred = { phoneNumberId: string; accessToken: string; businessAccountId?: string };

function credsOrThrow(ctx: ForgeActionContext): WhatsAppCred {
  const cred = requireCredential('WhatsApp', ctx.credential);
  const phoneNumberId = cred.phoneNumberId ?? '';
  const accessToken = cred.accessToken ?? '';
  if (!phoneNumberId) throw new Error('WhatsApp: credential missing `phoneNumberId`');
  if (!accessToken) throw new Error('WhatsApp: credential missing `accessToken`');
  return { phoneNumberId, accessToken, businessAccountId: cred.businessAccountId };
}

async function send(ctx: ForgeActionContext, body: Record<string, unknown>): Promise<unknown> {
  const { phoneNumberId, accessToken } = credsOrThrow(ctx);
  const res = await apiRequest({
    service: 'WhatsApp',
    method: 'POST',
    url: `${WHATSAPP_BASE}/${encodeURIComponent(phoneNumberId)}/messages`,
    headers: { Authorization: `Bearer ${accessToken}` },
    json: { messaging_product: 'whatsapp', ...body },
  });
  return res.data;
}

function cleanRecipient(raw: string): string {
  // n8n's cleanPhoneNumber strips '+' and spaces.
  return raw.replace(/[^\d]/g, '');
}

async function sendText(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const to = asString(ctx.options.to);
  const body = asString(ctx.options.body);
  if (!to) throw new Error('WhatsApp: recipient `to` is required');
  if (!body) throw new Error('WhatsApp: `body` is required');

  const previewUrl =
    ctx.options.previewUrl === true || ctx.options.previewUrl === 'true' ? true : false;

  const result = await send(ctx, {
    to: cleanRecipient(to),
    type: 'text',
    text: { body, preview_url: previewUrl },
  });
  return { outputs: { result }, logs: [`WhatsApp text → ${to}`] };
}

async function sendTemplate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const to = asString(ctx.options.to);
  const templateName = asString(ctx.options.templateName);
  const language = asString(ctx.options.language) || 'en_US';
  if (!to) throw new Error('WhatsApp: recipient `to` is required');
  if (!templateName) throw new Error('WhatsApp: `templateName` is required');

  const template: Record<string, unknown> = {
    name: templateName,
    language: { code: language },
  };

  const componentsRaw = asString(ctx.options.components).trim();
  if (componentsRaw) {
    try {
      const parsed = JSON.parse(componentsRaw);
      if (!Array.isArray(parsed)) {
        throw new Error('components must be a JSON array');
      }
      template.components = parsed;
    } catch (err) {
      throw new Error(`WhatsApp: invalid components JSON — ${(err as Error).message}`);
    }
  }

  const result = await send(ctx, {
    to: cleanRecipient(to),
    type: 'template',
    template,
  });
  return { outputs: { result }, logs: [`WhatsApp template → ${to} (${templateName})`] };
}

async function sendMedia(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const to = asString(ctx.options.to);
  const mediaType = asString(ctx.options.mediaType) || 'image';
  const link = asString(ctx.options.link);
  const mediaId = asString(ctx.options.mediaId);
  if (!to) throw new Error('WhatsApp: recipient `to` is required');
  if (!link && !mediaId) {
    throw new Error('WhatsApp: provide either `link` (URL) or `mediaId`');
  }

  const media: Record<string, unknown> = {};
  if (link) media.link = link;
  if (mediaId) media.id = mediaId;
  const caption = asString(ctx.options.caption);
  if (caption && (mediaType === 'image' || mediaType === 'document' || mediaType === 'video')) {
    media.caption = caption;
  }
  const filename = asString(ctx.options.filename);
  if (filename && mediaType === 'document') {
    media.filename = filename;
  }

  const result = await send(ctx, {
    to: cleanRecipient(to),
    type: mediaType,
    [mediaType]: media,
  });
  return { outputs: { result }, logs: [`WhatsApp ${mediaType} → ${to}`] };
}

async function sendLocation(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const to = asString(ctx.options.to);
  const latitude = asString(ctx.options.latitude);
  const longitude = asString(ctx.options.longitude);
  if (!to) throw new Error('WhatsApp: recipient `to` is required');
  if (!latitude) throw new Error('WhatsApp: latitude is required');
  if (!longitude) throw new Error('WhatsApp: longitude is required');

  const location: Record<string, unknown> = {
    latitude: Number(latitude),
    longitude: Number(longitude),
  };
  const name = asString(ctx.options.name);
  if (name) location.name = name;
  const address = asString(ctx.options.address);
  if (address) location.address = address;

  const result = await send(ctx, {
    to: cleanRecipient(to),
    type: 'location',
    location,
  });
  return { outputs: { result }, logs: [`WhatsApp location → ${to}`] };
}

async function sendContacts(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const to = asString(ctx.options.to);
  const contactsRaw = ctx.options.contacts;
  if (!to) throw new Error('WhatsApp: recipient `to` is required');
  if (contactsRaw === undefined || contactsRaw === null || contactsRaw === '') {
    throw new Error('WhatsApp: contacts (JSON array of contact objects) is required');
  }
  const contacts = typeof contactsRaw === 'string' ? JSON.parse(contactsRaw) : contactsRaw;
  if (!Array.isArray(contacts)) {
    throw new Error('WhatsApp: contacts must be a JSON array');
  }
  const result = await send(ctx, {
    to: cleanRecipient(to),
    type: 'contacts',
    contacts,
  });
  return { outputs: { result }, logs: [`WhatsApp contacts → ${to}`] };
}

async function mediaGet(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { accessToken } = credsOrThrow(ctx);
  const mediaId = asString(ctx.options.mediaId);
  if (!mediaId) throw new Error('WhatsApp: mediaId is required');
  const res = await apiRequest({
    service: 'WhatsApp',
    method: 'GET',
    url: `${WHATSAPP_BASE}/${encodeURIComponent(mediaId)}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { media: res.data }, logs: [`WhatsApp media get → ${mediaId}`] };
}

async function mediaDelete(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const { accessToken } = credsOrThrow(ctx);
  const mediaId = asString(ctx.options.mediaId);
  if (!mediaId) throw new Error('WhatsApp: mediaId is required');
  const res = await apiRequest({
    service: 'WhatsApp',
    method: 'DELETE',
    url: `${WHATSAPP_BASE}/${encodeURIComponent(mediaId)}`,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { outputs: { result: res.data }, logs: [`WhatsApp media delete → ${mediaId}`] };
}

const block: ForgeBlock = {
  id: 'forge_whatsapp',
  name: 'WhatsApp',
  description: 'Send WhatsApp Cloud API messages: text, template and media.',
  iconName: 'LuMessageCircle',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'whatsapp' },
  actions: [
    {
      id: 'send_text',
      label: 'Send text message',
      description: 'Send a plain text WhatsApp message.',
      fields: [
        { id: 'to', label: "Recipient's phone number", type: 'text', required: true, placeholder: '+15551234567' },
        { id: 'body', label: 'Message', type: 'textarea', required: true },
        { id: 'previewUrl', label: 'Preview URL', type: 'toggle' },
      ],
      run: sendText,
    },
    {
      id: 'send_template',
      label: 'Send template message',
      description: 'Send a pre-approved WhatsApp template.',
      fields: [
        { id: 'to', label: "Recipient's phone number", type: 'text', required: true },
        { id: 'templateName', label: 'Template name', type: 'text', required: true },
        { id: 'language', label: 'Language code', type: 'text', defaultValue: 'en_US', placeholder: 'en_US' },
        {
          id: 'components',
          label: 'Components (JSON array)',
          type: 'json',
          helperText: 'Optional WhatsApp Cloud API template `components` array, see Meta docs.',
        },
      ],
      run: sendTemplate,
    },
    {
      id: 'send_media',
      label: 'Send media',
      description: 'Send an image, document, video or audio message.',
      fields: [
        { id: 'to', label: "Recipient's phone number", type: 'text', required: true },
        {
          id: 'mediaType',
          label: 'Media type',
          type: 'select',
          required: true,
          options: [
            { label: 'Image', value: 'image' },
            { label: 'Document', value: 'document' },
            { label: 'Video', value: 'video' },
            { label: 'Audio', value: 'audio' },
          ],
        },
        { id: 'link', label: 'Public URL', type: 'text', helperText: 'Either link or mediaId is required.' },
        { id: 'mediaId', label: 'Media ID', type: 'text' },
        { id: 'caption', label: 'Caption', type: 'textarea' },
        { id: 'filename', label: 'Filename (document only)', type: 'text' },
      ],
      run: sendMedia,
    },
    {
      id: 'send_location',
      label: 'Send location',
      description: 'Send a geographic location message.',
      fields: [
        { id: 'to', label: "Recipient's phone number", type: 'text', required: true },
        { id: 'latitude', label: 'Latitude', type: 'text', required: true },
        { id: 'longitude', label: 'Longitude', type: 'text', required: true },
        { id: 'name', label: 'Place name', type: 'text' },
        { id: 'address', label: 'Address', type: 'text' },
      ],
      run: sendLocation,
    },
    {
      id: 'send_contacts',
      label: 'Send contacts',
      description: 'Send one or more contact cards. `contacts` accepts a JSON array of contact objects.',
      fields: [
        { id: 'to', label: "Recipient's phone number", type: 'text', required: true },
        {
          id: 'contacts',
          label: 'Contacts (JSON array)',
          type: 'json',
          required: true,
          placeholder: '[{"name":{"formatted_name":"Jane Doe","first_name":"Jane"},"phones":[{"phone":"+15551234567"}]}]',
        },
      ],
      run: sendContacts,
    },
    {
      id: 'media_get',
      label: 'Get media URL',
      description: 'Resolve a media ID to its temporary download URL and metadata.',
      fields: [{ id: 'mediaId', label: 'Media ID', type: 'text', required: true }],
      run: mediaGet,
    },
    {
      id: 'media_delete',
      label: 'Delete media',
      description: 'Delete a previously uploaded media item from WhatsApp servers.',
      fields: [{ id: 'mediaId', label: 'Media ID', type: 'text', required: true }],
      run: mediaDelete,
    },
  ],
};

registerForgeBlock(block);
export default block;

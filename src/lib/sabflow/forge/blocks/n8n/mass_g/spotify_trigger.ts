/**
 * Forge block: Spotify Trigger (info shim).
 *
 * Registration-info shim. Spotify does not expose first-class user-facing
 * webhooks; n8n's trigger polls the Web API. This shim returns the SabFlow
 * receiver URL + the polling event slugs n8n supports.
 *
 * Source: Spotify Web API + n8n polling triggers.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const KNOWN_EVENTS = [
  'now_playing.changed',
  'recently_played.added',
  'saved_track.added',
  'saved_album.added',
  'followed_artist.added',
  'playlist.created',
  'playlist.updated',
  'playlist.track_added',
] as const;

async function register_trigger_info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const webhookId = asString(ctx.options.webhookId);
  const eventTypesRaw = ctx.options.eventTypes;
  const eventTypes = Array.isArray(eventTypesRaw)
    ? eventTypesRaw.map(asString).filter(Boolean)
    : [];
  const sabflowReceiverUrl = webhookId
    ? `${BASE_URL}/api/sabflow/webhook/${webhookId}`
    : '(webhook id not minted yet — see SabFlow Connections)';
  return {
    outputs: {
      service: 'Spotify',
      sabflowReceiverUrl,
      supportedEvents: KNOWN_EVENTS,
      selectedEvents: eventTypes,
      registrationDocs: 'https://developer.spotify.com/documentation/web-api',
      registrationInstructions:
        `Spotify has no native webhooks — use a poller / cron block to fetch one or more of supportedEvents and POST to ${sabflowReceiverUrl}.`,
    },
    logs: [`Spotify trigger info → ${KNOWN_EVENTS.length} known events`],
  };
}

const block: ForgeBlock = {
  id: 'forge_spotify_trigger',
  name: 'Spotify Trigger (info)',
  description:
    'Returns the SabFlow webhook URL + Spotify-polling event slugs (Spotify has no native webhooks).',
  iconName: 'LuWebhook',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'register_trigger_info',
      label: 'Get registration info',
      description: 'Return the SabFlow receiver URL + Spotify event slugs.',
      fields: [
        {
          id: 'webhookId',
          label: 'SabFlow webhook id',
          type: 'text',
          placeholder: 'minted by SabFlow Connections',
          helperText: 'Leave blank to preview the URL pattern.',
        },
        {
          id: 'eventTypes',
          label: 'Event types (JSON array)',
          type: 'json',
          placeholder: '["now_playing.changed", "saved_track.added"]',
          helperText: `One or more of: ${KNOWN_EVENTS.join(', ')}.`,
        },
      ],
      run: register_trigger_info,
    },
  ],
};

registerForgeBlock(block);
export default block;

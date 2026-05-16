/**
 * Forge block: Video Synthesia
 *
 * Creates an AI avatar video with Synthesia (`https://api.synthesia.io/v2/videos`).
 * Synthesia rendering is async — the create call returns a `video.id` you can
 * poll via the GET action; the final MP4 URL appears on `download`.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asBoolean, asString } from '../_shared/http';

const BASE = 'https://api.synthesia.io/v2/videos';

async function create(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Synthesia: apiKey is required');
  const title = asString(ctx.options.title) || 'SabFlow video';
  const scriptText = asString(ctx.options.scriptText);
  if (!scriptText) throw new Error('Synthesia: scriptText is required');
  const avatar = asString(ctx.options.avatar) || 'anna_costume1_cameraA';
  const background = asString(ctx.options.background) || 'green_screen';
  const voice = asString(ctx.options.voice);
  const test = asBoolean(ctx.options.test);

  const scriptObj: Record<string, unknown> = { scriptText, avatar, background };
  if (voice) scriptObj.voice = voice;

  const res = await apiRequest({
    service: 'Synthesia',
    method: 'POST',
    url: BASE,
    headers: { Authorization: apiKey },
    json: { test, title, input: [scriptObj] },
  });
  const data = res.data as { id?: string; status?: string };
  return {
    outputs: { videoId: data?.id ?? '', status: data?.status ?? '', url: '', raw: res.data },
    logs: [`Synthesia video queued → ${data?.id}`],
  };
}

async function get(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Synthesia: apiKey is required');
  const videoId = asString(ctx.options.videoId);
  if (!videoId) throw new Error('Synthesia: videoId is required');

  const res = await apiRequest({
    service: 'Synthesia',
    method: 'GET',
    url: `${BASE}/${encodeURIComponent(videoId)}`,
    headers: { Authorization: apiKey },
  });
  const data = res.data as { id?: string; status?: string; download?: string };
  return {
    outputs: { videoId, status: data?.status ?? '', url: data?.download ?? '', raw: res.data },
    logs: [`Synthesia ${videoId} → ${data?.status}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_video_synthesia',
  name: 'Video Synthesia',
  description: 'Create AI avatar videos with Synthesia.',
  iconName: 'LuVideo',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'create',
      label: 'Create video',
      description: 'Queue a Synthesia avatar video. Output: `videoId` to poll later.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'title', label: 'Title', type: 'text', defaultValue: 'SabFlow video' },
        { id: 'scriptText', label: 'Script text', type: 'textarea', required: true },
        { id: 'avatar', label: 'Avatar', type: 'text', defaultValue: 'anna_costume1_cameraA' },
        { id: 'background', label: 'Background', type: 'text', defaultValue: 'green_screen' },
        { id: 'voice', label: 'Voice', type: 'text' },
        { id: 'test', label: 'Test mode (no credits)', type: 'toggle', defaultValue: true },
      ],
      run: create,
    },
    {
      id: 'get',
      label: 'Get video',
      description: 'Fetch video status; once `status` is `complete`, `url` (download) is set.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'videoId', label: 'Video ID', type: 'text', required: true },
      ],
      run: get,
    },
  ],
};

registerForgeBlock(block);
export default block;

/**
 * Forge block: Audio OpenAI TTS
 *
 * Synthesizes speech with OpenAI's `/v1/audio/speech` endpoint. Returns the
 * audio as a base64 string for downstream upload to SabFiles or for data-URL
 * embedding.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString } from '../_shared/http';

const API = 'https://api.openai.com/v1/audio/speech';

async function synthesize(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('OpenAI TTS: apiKey is required');
  const input = asString(ctx.options.text);
  if (!input) throw new Error('OpenAI TTS: text is required');
  const model = asString(ctx.options.model) || 'tts-1';
  const voice = asString(ctx.options.voice) || 'alloy';
  const responseFormat = asString(ctx.options.responseFormat) || 'mp3';
  const speed = asNumber(ctx.options.speed) ?? 1.0;

  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, voice, input, response_format: responseFormat, speed }),
  });
  if (!res.ok) {
    const body = await res.text();
    const clip = body.length > 300 ? `${body.slice(0, 300)}…` : body;
    throw new Error(`OpenAI TTS failed (${res.status}): ${clip}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const b64 = buf.toString('base64');
  const contentType = res.headers.get('content-type') ?? `audio/${responseFormat}`;
  return {
    outputs: { b64, url: '', contentType, bytes: buf.length },
    logs: [`OpenAI TTS → ${buf.length} bytes (${voice}, ${model})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_audio_openai_tts',
  name: 'Audio OpenAI TTS',
  description: 'Synthesize speech with OpenAI text-to-speech.',
  iconName: 'LuVolume2',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'synthesize',
      label: 'Text to speech',
      description: 'Return base64-encoded audio bytes from OpenAI TTS.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'tts-1', placeholder: 'tts-1 | tts-1-hd' },
        { id: 'voice', label: 'Voice', type: 'text', defaultValue: 'alloy', placeholder: 'alloy, echo, fable, onyx, nova, shimmer' },
        { id: 'responseFormat', label: 'Format', type: 'text', defaultValue: 'mp3', placeholder: 'mp3 | opus | aac | flac | wav | pcm' },
        { id: 'speed', label: 'Speed', type: 'number', defaultValue: 1.0 },
      ],
      run: synthesize,
    },
  ],
};

registerForgeBlock(block);
export default block;

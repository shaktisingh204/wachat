/**
 * Forge block: Audio ElevenLabs TTS
 *
 * Synthesizes speech with ElevenLabs
 * (`https://api.elevenlabs.io/v1/text-to-speech/<voiceId>`). The API streams
 * raw audio bytes — we buffer them and return a base64 string. Caller can
 * upload to SabFiles or surface as a data URL.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asNumber, asString } from '../_shared/http';

async function synthesize(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('ElevenLabs: apiKey is required');
  const voiceId = asString(ctx.options.voiceId);
  if (!voiceId) throw new Error('ElevenLabs: voiceId is required');
  const text = asString(ctx.options.text);
  if (!text) throw new Error('ElevenLabs: text is required');
  const modelId = asString(ctx.options.modelId) || 'eleven_multilingual_v2';
  const outputFormat = asString(ctx.options.outputFormat) || 'mp3_44100_128';
  const stability = asNumber(ctx.options.stability) ?? 0.5;
  const similarityBoost = asNumber(ctx.options.similarityBoost) ?? 0.75;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/*',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability, similarity_boost: similarityBoost },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    const clip = body.length > 300 ? `${body.slice(0, 300)}…` : body;
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${clip}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const b64 = buf.toString('base64');
  const contentType = res.headers.get('content-type') ?? 'audio/mpeg';
  return {
    outputs: { b64, url: '', contentType, bytes: buf.length },
    logs: [`ElevenLabs TTS → ${buf.length} bytes (${contentType})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_audio_elevenlabs_tts',
  name: 'Audio ElevenLabs TTS',
  description: 'Synthesize speech with ElevenLabs text-to-speech.',
  iconName: 'LuVolume2',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'synthesize',
      label: 'Text to speech',
      description: 'Return base64-encoded audio bytes (e.g. mp3) for the given text.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'voiceId', label: 'Voice ID', type: 'text', required: true },
        { id: 'text', label: 'Text', type: 'textarea', required: true },
        { id: 'modelId', label: 'Model', type: 'text', defaultValue: 'eleven_multilingual_v2' },
        { id: 'outputFormat', label: 'Output format', type: 'text', defaultValue: 'mp3_44100_128' },
        { id: 'stability', label: 'Stability', type: 'number', defaultValue: 0.5 },
        { id: 'similarityBoost', label: 'Similarity boost', type: 'number', defaultValue: 0.75 },
      ],
      run: synthesize,
    },
  ],
};

registerForgeBlock(block);
export default block;

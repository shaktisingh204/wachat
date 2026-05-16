/**
 * Forge block: Audio Deepgram
 *
 * Transcribes audio with Deepgram's prerecorded API
 * (`https://api.deepgram.com/v1/listen`). Sends the audio by URL, which
 * Deepgram fetches internally — saves us a round-trip and works for arbitrarily
 * large media.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asBoolean, asString } from '../_shared/http';

async function transcribe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Deepgram: apiKey is required');
  const audioUrl = asString(ctx.options.audioUrl);
  if (!audioUrl) throw new Error('Deepgram: audioUrl is required');
  const model = asString(ctx.options.model) || 'nova-2';
  const language = asString(ctx.options.language) || 'en';
  const punctuate = asBoolean(ctx.options.punctuate);
  const diarize = asBoolean(ctx.options.diarize);
  const smartFormat = asBoolean(ctx.options.smartFormat);

  const qs = new URLSearchParams({ model, language });
  if (punctuate) qs.set('punctuate', 'true');
  if (diarize) qs.set('diarize', 'true');
  if (smartFormat) qs.set('smart_format', 'true');

  const res = await apiRequest({
    service: 'Deepgram',
    method: 'POST',
    url: `https://api.deepgram.com/v1/listen?${qs.toString()}`,
    headers: { Authorization: `Token ${apiKey}` },
    json: { url: audioUrl },
  });
  const data = res.data as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{ transcript?: string; confidence?: number; words?: unknown[] }>;
      }>;
    };
  };
  const alt = data?.results?.channels?.[0]?.alternatives?.[0];
  return {
    outputs: {
      text: alt?.transcript ?? '',
      confidence: alt?.confidence,
      words: alt?.words ?? [],
      raw: res.data,
    },
    logs: [`Deepgram ${model} → ${(alt?.transcript ?? '').length} chars`],
  };
}

const block: ForgeBlock = {
  id: 'forge_audio_deepgram',
  name: 'Audio Deepgram',
  description: 'Transcribe audio with Deepgram.',
  iconName: 'LuMic',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'transcribe',
      label: 'Transcribe audio',
      description: 'Submit by URL; Deepgram fetches the audio and returns a transcript.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'audioUrl', label: 'Audio URL', type: 'text', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'nova-2' },
        { id: 'language', label: 'Language', type: 'text', defaultValue: 'en' },
        { id: 'punctuate', label: 'Punctuate', type: 'toggle', defaultValue: true },
        { id: 'diarize', label: 'Diarize speakers', type: 'toggle', defaultValue: false },
        { id: 'smartFormat', label: 'Smart format', type: 'toggle', defaultValue: true },
      ],
      run: transcribe,
    },
  ],
};

registerForgeBlock(block);
export default block;

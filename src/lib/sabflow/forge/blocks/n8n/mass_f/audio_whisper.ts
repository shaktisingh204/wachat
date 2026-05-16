/**
 * Forge block: Audio Whisper (OpenAI)
 *
 * Transcribes audio with OpenAI Whisper
 * (`https://api.openai.com/v1/audio/transcriptions`). Source the audio from
 * a publicly fetchable URL (typically a SabFiles share URL) — the block fetches
 * the bytes itself, then forwards them as multipart/form-data.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

const API = 'https://api.openai.com/v1/audio/transcriptions';

async function transcribe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Whisper: apiKey is required');
  const audioUrl = asString(ctx.options.audioUrl);
  if (!audioUrl) throw new Error('Whisper: audioUrl is required');
  const model = asString(ctx.options.model) || 'whisper-1';
  const language = asString(ctx.options.language);
  const responseFormat = asString(ctx.options.responseFormat) || 'json';
  const prompt = asString(ctx.options.prompt);

  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error(`Whisper: could not fetch audio (${audioRes.status})`);
  const audioBlob = await audioRes.blob();
  const filename = audioUrl.split('/').pop()?.split('?')[0] || 'audio.mp3';

  const form = new FormData();
  form.append('file', audioBlob, filename);
  form.append('model', model);
  form.append('response_format', responseFormat);
  if (language) form.append('language', language);
  if (prompt) form.append('prompt', prompt);

  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    const clip = text.length > 300 ? `${text.slice(0, 300)}…` : text;
    throw new Error(`Whisper POST failed (${res.status}): ${clip}`);
  }
  let body: { text?: string } & Record<string, unknown> = {};
  try {
    body = JSON.parse(text);
  } catch {
    body = { text };
  }
  return {
    outputs: { text: body.text ?? text, raw: body },
    logs: [`Whisper transcribed → ${(body.text ?? text).length} chars`],
  };
}

const block: ForgeBlock = {
  id: 'forge_audio_whisper',
  name: 'Audio Whisper',
  description: 'Transcribe audio with OpenAI Whisper.',
  iconName: 'LuMic',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'transcribe',
      label: 'Transcribe audio',
      description: 'Fetch an audio file by URL and transcribe it to text.',
      fields: [
        { id: 'apiKey', label: 'OpenAI API key', type: 'password', required: true },
        { id: 'audioUrl', label: 'Audio URL (SabFiles share)', type: 'text', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'whisper-1' },
        { id: 'language', label: 'Language hint', type: 'text', placeholder: 'en, es, hi…' },
        { id: 'prompt', label: 'Prompt (style/spelling hint)', type: 'textarea' },
        { id: 'responseFormat', label: 'Response format', type: 'text', defaultValue: 'json', placeholder: 'json | text | srt | verbose_json | vtt' },
      ],
      run: transcribe,
    },
  ],
};

registerForgeBlock(block);
export default block;

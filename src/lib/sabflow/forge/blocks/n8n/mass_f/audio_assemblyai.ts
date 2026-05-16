/**
 * Forge block: Audio AssemblyAI
 *
 * Transcribes audio with AssemblyAI. Submits a transcript by audio URL
 * (`POST /v2/transcript`) and polls until status is `completed` or `error`.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asBoolean, asNumber, asString } from '../_shared/http';

const BASE = 'https://api.assemblyai.com/v2';

async function transcribe(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('AssemblyAI: apiKey is required');
  const audioUrl = asString(ctx.options.audioUrl);
  if (!audioUrl) throw new Error('AssemblyAI: audioUrl is required');
  const speakerLabels = asBoolean(ctx.options.speakerLabels);
  const languageCode = asString(ctx.options.languageCode);
  const pollIntervalMs = asNumber(ctx.options.pollIntervalMs) ?? 2000;
  const maxWaitMs = asNumber(ctx.options.maxWaitMs) ?? 5 * 60 * 1000;

  const body: Record<string, unknown> = { audio_url: audioUrl };
  if (speakerLabels) body.speaker_labels = true;
  if (languageCode) body.language_code = languageCode;

  const create = await apiRequest({
    service: 'AssemblyAI',
    method: 'POST',
    url: `${BASE}/transcript`,
    headers: { Authorization: apiKey },
    json: body,
  });
  const created = create.data as { id?: string; status?: string };
  if (!created.id) throw new Error('AssemblyAI: missing transcript id from create response');

  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const poll = await apiRequest({
      service: 'AssemblyAI',
      method: 'GET',
      url: `${BASE}/transcript/${created.id}`,
      headers: { Authorization: apiKey },
    });
    const data = poll.data as {
      status?: string;
      text?: string;
      error?: string;
      words?: unknown;
      utterances?: unknown;
    };
    if (data.status === 'completed') {
      return {
        outputs: {
          id: created.id,
          text: data.text ?? '',
          words: data.words ?? [],
          utterances: data.utterances ?? [],
          raw: data,
        },
        logs: [`AssemblyAI transcript ${created.id} → ${(data.text ?? '').length} chars`],
      };
    }
    if (data.status === 'error') {
      throw new Error(`AssemblyAI transcript ${created.id} failed: ${data.error ?? 'unknown error'}`);
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  throw new Error(`AssemblyAI transcript ${created.id} timed out after ${maxWaitMs}ms`);
}

const block: ForgeBlock = {
  id: 'forge_audio_assemblyai',
  name: 'Audio AssemblyAI',
  description: 'Transcribe audio with AssemblyAI.',
  iconName: 'LuMic',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'transcribe',
      label: 'Transcribe audio',
      description: 'Submit by URL and poll until transcription completes.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'audioUrl', label: 'Audio URL', type: 'text', required: true },
        { id: 'languageCode', label: 'Language code', type: 'text', placeholder: 'en_us, es, hi…' },
        { id: 'speakerLabels', label: 'Speaker labels', type: 'toggle', defaultValue: false },
        { id: 'pollIntervalMs', label: 'Poll interval (ms)', type: 'number', defaultValue: 2000 },
        { id: 'maxWaitMs', label: 'Max wait (ms)', type: 'number', defaultValue: 300000 },
      ],
      run: transcribe,
    },
  ],
};

registerForgeBlock(block);
export default block;

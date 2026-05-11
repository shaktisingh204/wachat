import type { IntegrationResult, ResolvedOptions, Credential } from './types';

export async function executeElevenLabs(
  options: ResolvedOptions,
  credential?: Credential,
): Promise<IntegrationResult> {
  const apiKey = credential?.apiKey ?? (options.apiKey as string);
  if (!apiKey) return { error: 'elevenlabs: apiKey credential is required' };

  const text = (options.text as string) ?? '';
  if (!text) return { error: 'elevenlabs: text is required' };

  const voiceId = (options.voiceId as string) ?? '21m00Tcm4TlvDq8ikWAM';
  const modelId = (options.modelId as string) ?? 'eleven_monolingual_v1';

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: modelId }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return {
      outputs: { audioBase64: base64, mimeType: 'audio/mpeg', size: String(buffer.byteLength) },
    };
  } catch (err) {
    return { error: `elevenlabs failed: ${(err as Error).message}` };
  }
}

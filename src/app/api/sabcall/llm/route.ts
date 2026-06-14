/**
 * SabCall engine → LLM bridge.
 *
 *   POST /api/sabcall/llm   { system, prompt }  →  { text }
 *
 * The `sabcall-engine` autopilot (AI voice agent) points `SABCALL_LLM_URL` here
 * so the engine never holds model keys — it reuses SabNode's canonical LLM
 * gateway (`generateSabcrmText` → AI Gateway → Anthropic → OpenAI). Authn is the
 * shared engine bearer token (`SABCALL_ENGINE_TOKEN`); a no-op in local dev when
 * the token is unset, matching the engine's own guard.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { generateSabcrmText } from '@/lib/sabcrm/ai-llm.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const token = process.env.SABCALL_ENGINE_TOKEN;
  if (token) {
    const presented = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (presented !== token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const body = (await req.json().catch(() => ({}))) as {
    system?: unknown;
    prompt?: unknown;
  };
  const system =
    typeof body.system === 'string' && body.system.trim()
      ? body.system
      : 'You are a concise, helpful phone assistant.';
  const prompt = typeof body.prompt === 'string' ? body.prompt : '';

  const res = await generateSabcrmText({ system, prompt, maxTokens: 300 });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 502 });
  }
  return NextResponse.json({ text: res.text });
}

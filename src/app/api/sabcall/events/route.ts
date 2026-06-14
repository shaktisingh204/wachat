/**
 * SabCall engine → app event sink.
 *
 *   POST /api/sabcall/events   { type, tenant, channelId, from, to, recordingUrl?, digits? }
 *
 * The `sabcall-engine` posts call lifecycle events here (it holds no R2/S3
 * creds). On a completed call with a `recordingUrl`, this fetches the recording,
 * stores it in R2 (SabFiles), optionally transcribes it via SABCALL_STT_URL, and
 * writes the recording URL + transcript onto the matching CDR. Every event is
 * also archived to `sabcall_call_events`. Auth is the shared engine bearer token.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import { uploadToR2, buildFileKey } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CallEvent {
  type?: string;
  tenant?: string;
  channelId?: string;
  from?: string;
  to?: string;
  recordingUrl?: string;
  digits?: string;
}

async function transcribe(audioUrl: string): Promise<string | null> {
  const url = process.env.SABCALL_STT_URL;
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrl }),
    });
    if (!res.ok) return null;
    const v = (await res.json()) as { text?: string };
    return v.text ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const token = process.env.SABCALL_ENGINE_TOKEN;
  if (token) {
    const presented = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (presented !== token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const ev = (await req.json().catch(() => ({}))) as CallEvent;
  if (!ev.tenant) {
    return NextResponse.json({ error: 'tenant is required' }, { status: 400 });
  }

  const { db } = await connectToDatabase();
  await db.collection('sabcall_call_events').insertOne({ ...ev, receivedAt: new Date() });

  let recordingStoredUrl: string | null = null;
  let transcript: string | null = null;

  if (ev.recordingUrl) {
    try {
      const audio = await fetch(ev.recordingUrl);
      if (audio.ok) {
        const bytes = Buffer.from(await audio.arrayBuffer());
        const key = buildFileKey(ev.tenant, `sabcall-recordings/${ev.channelId ?? 'call'}.wav`);
        const stored = await uploadToR2({ key, body: bytes, contentType: 'audio/wav' });
        recordingStoredUrl = stored.url;
        transcript = await transcribe(stored.url);
      }
    } catch {
      // best-effort — recording/transcription must not fail the callback
    }
  }

  if ((recordingStoredUrl || transcript) && ev.channelId) {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (recordingStoredUrl) set.recordingUrl = recordingStoredUrl;
    if (transcript) set.transcript = transcript;
    await db
      .collection('sabcall_calls')
      .updateOne(
        { userId: ev.tenant, providerCallSid: ev.channelId },
        { $set: set },
      );
  }

  return NextResponse.json({ ok: true, recordingStoredUrl, transcribed: !!transcript });
}

/**
 * Kiosk read endpoint. PIN-gated submission goes to Rust; this endpoint
 * only returns the envelope projection a kiosk needs to render. The PIN
 * itself is verified at submit time, not here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ envelopeId: string }> },
) {
  const { envelopeId } = await params;
  const signerId = req.nextUrl.searchParams.get('signerId');
  if (!signerId || !ObjectId.isValid(envelopeId)) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }
  const { db } = await connectToDatabase();
  const env = await db.collection('esign_envelopes').findOne({ _id: new ObjectId(envelopeId) });
  if (!env) return NextResponse.json({ error: 'Envelope not found' }, { status: 404 });

  const signer = (env.signers || []).find(
    (s: any) => s.id === signerId && s.authMethod === 'pin',
  );
  if (!signer) {
    return NextResponse.json({ error: 'Signer not configured for kiosk mode' }, { status: 404 });
  }
  if (['completed', 'voided', 'expired', 'declined'].includes(env.status)) {
    return NextResponse.json({ error: `Envelope is ${env.status}` }, { status: 410 });
  }

  return NextResponse.json({
    _id: String(env._id),
    name: env.name,
    docUrl: env.docUrl,
    docName: env.docName,
    fields: env.fields || [],
    signer: {
      id: signer.id,
      role: signer.role,
      name: signer.name,
      authMethod: signer.authMethod,
    },
  });
}

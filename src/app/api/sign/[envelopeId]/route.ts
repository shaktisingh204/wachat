/**
 * Public read endpoint backing the signer's sign page.
 *
 * Surfaces only the fields the signer needs (role-scoped fields, signer
 * record, document URL). Authentication is the `(signerId, t)` token
 * pair, validated server-side against the envelope's signer record.
 *
 * Runs on the Node.js runtime — it reads from MongoDB directly via
 * `connectToDatabase`. No session check; the access token is the auth.
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
  const accessToken = req.nextUrl.searchParams.get('t');

  if (!signerId || !accessToken || !ObjectId.isValid(envelopeId)) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  const { db } = await connectToDatabase();
  const env = await db.collection('esign_envelopes').findOne({ _id: new ObjectId(envelopeId) });
  if (!env) {
    return NextResponse.json({ error: 'Envelope not found' }, { status: 404 });
  }
  const signer = (env.signers || []).find(
    (s: any) => s.id === signerId && s.accessToken === accessToken,
  );
  if (!signer) {
    return NextResponse.json({ error: 'Invalid signer credentials' }, { status: 401 });
  }
  if (['completed', 'voided', 'expired', 'declined'].includes(env.status)) {
    return NextResponse.json({ error: `Envelope is ${env.status}` }, { status: 410 });
  }

  // Strip secrets before sending to the browser. Hashes (pinHash,
  // KBA answerHashes) are particularly important to keep server-side.
  const safeSigner = {
    id: signer.id,
    role: signer.role,
    name: signer.name,
    email: signer.email,
    authMethod: signer.authMethod,
    kbaQuestions: (signer.kbaQuestions || []).map((q: any) => ({ question: q.question })),
  };

  return NextResponse.json({
    _id: String(env._id),
    name: env.name,
    docUrl: env.docUrl,
    docName: env.docName,
    fields: env.fields || [],
    signer: safeSigner,
  });
}

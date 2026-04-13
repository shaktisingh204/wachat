/**
 * WhatsApp Flows data-exchange endpoint.
 *
 * Meta POSTs encrypted bodies here when a flow screen's action is
 * `data_exchange`, on `INIT`, on `BACK` (if the screen opted in), and
 * for health `ping`s. We decrypt with the RSA private key bound to
 * this phone number, dispatch, then return an encrypted response.
 *
 * Return codes:
 *   200   OK with encrypted body (text/plain, base64)
 *   421   Decryption failed — Meta will refresh our public key & retry once
 *   427   Close the flow session on the client (used for unrecoverable errors)
 *   400   Malformed request
 */

import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { connectToDatabase } from '@/lib/mongodb';
import { decryptFlowRequest, encryptFlowResponse } from '@/lib/crypto/flows-cipher';
import type { Project } from '@/lib/definitions';

export const dynamic = 'force-dynamic';

const LOG_PREFIX = '[FLOWS ENDPOINT]';
const DATA_API_VERSION = '3.0';

function verifyMetaSignature(rawBody: string, header: string | null): boolean {
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) return process.env.NODE_ENV !== 'production';
    if (!header || !header.startsWith('sha256=')) return false;
    const expected = crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(header.slice(7), 'hex');
    if (expectedBuf.length !== receivedBuf.length) return false;
    try { return crypto.timingSafeEqual(expectedBuf, receivedBuf); } catch { return false; }
}

async function resolvePrivateKey(phoneNumberId: string): Promise<string | null> {
    const { db } = await connectToDatabase();
    const project = await db.collection<Project>('projects').findOne(
        { 'phoneNumbers.id': phoneNumberId },
        { projection: { phoneNumbers: 1 } },
    );
    const phone = project?.phoneNumbers?.find((p: any) => p.id === phoneNumberId);
    return phone?.flowsEncryptionConfig?.privateKey ?? null;
}

/**
 * Route incoming flow requests to a response.
 *
 * This default handler is deliberately minimal — it responds with
 * acknowledgements for INIT/BACK/ping and echoes data back on
 * data_exchange. Swap it out with project-specific business logic
 * (look up flow_token → session, validate the form, fetch CRM data,
 * choose next screen) when wiring concrete flows.
 */
async function handleFlowAction(decrypted: Record<string, any>): Promise<Record<string, any>> {
    const action = decrypted.action;

    if (action === 'ping') {
        return { version: DATA_API_VERSION, data: { status: 'active' } };
    }

    // Meta forwards client-side errors so we can log and must ack.
    if (decrypted.data?.error) {
        console.warn(`${LOG_PREFIX} client error`, decrypted.data.error);
        return { version: DATA_API_VERSION, data: { acknowledged: true } };
    }

    if (action === 'INIT' || action === 'BACK' || action === 'data_exchange') {
        // Default: remain on the current screen, pass through any provided data.
        // Real implementations: look up decrypted.flow_token, decide the next
        // screen, and return { screen: "<NEXT>", data: { ... } } or a terminal
        // completion response with extension_message_response.
        return {
            version: DATA_API_VERSION,
            screen: decrypted.screen ?? 'SUCCESS',
            data: decrypted.data ?? {},
        };
    }

    return {
        version: DATA_API_VERSION,
        data: { error_message: `Unsupported action: ${action}` },
    };
}

export async function POST(
    request: NextRequest,
    ctx: { params: Promise<{ phoneNumberId: string }> },
) {
    const { phoneNumberId } = await ctx.params;
    if (!phoneNumberId) return new NextResponse('Missing phoneNumberId', { status: 400 });

    const rawBody = await request.text();
    if (!rawBody) return new NextResponse('Empty body', { status: 400 });

    // Meta signs the encrypted envelope itself — verify before decrypting.
    const sig = request.headers.get('x-hub-signature-256');
    if (!verifyMetaSignature(rawBody, sig)) {
        return new NextResponse('Invalid signature', { status: 401 });
    }

    let envelope: any;
    try { envelope = JSON.parse(rawBody); }
    catch { return new NextResponse('Invalid JSON envelope', { status: 400 }); }

    const privateKey = await resolvePrivateKey(phoneNumberId);
    if (!privateKey) {
        console.error(`${LOG_PREFIX} no private key for ${phoneNumberId}`);
        return new NextResponse('No private key configured', { status: 421 });
    }

    let decrypted;
    try {
        decrypted = decryptFlowRequest(envelope, privateKey);
    } catch (e: any) {
        console.error(`${LOG_PREFIX} decrypt failed for ${phoneNumberId}: ${e.message}`);
        // 421 tells Meta to refresh our public key and retry once.
        return new NextResponse('Decryption failed', { status: 421 });
    }

    let responseJson: Record<string, any>;
    try {
        responseJson = await handleFlowAction(decrypted.payload);
    } catch (e: any) {
        console.error(`${LOG_PREFIX} handler error: ${e.message}`);
        responseJson = {
            version: DATA_API_VERSION,
            data: { error_message: 'Internal error. Please try again.' },
        };
    }

    const encrypted = encryptFlowResponse(responseJson, decrypted.aesKey, decrypted.iv);
    return new NextResponse(encrypted, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
    });
}

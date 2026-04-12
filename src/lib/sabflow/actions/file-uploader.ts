
'use server';

import type { WithId, User } from '@/lib/definitions';
import { connectToDatabase } from '@/lib/mongodb';
import { randomUUID } from 'crypto';
import { assertSafeOutboundUrl } from './url-guard';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB cap per upload

export async function executeFileUploaderAction(
    actionName: string,
    inputs: any,
    user: WithId<User>,
    logger: any
) {
    try {
        switch (actionName) {
            case 'inspectUrl': {
                const rawUrl = String(inputs.sourceUrl ?? '').trim();
                if (!rawUrl) throw new Error('sourceUrl is required.');
                const safeUrl = await assertSafeOutboundUrl(rawUrl);
                const url = safeUrl.toString();
                try {
                    const head = await fetch(url, { method: 'HEAD', redirect: 'follow' });
                    const contentType = head.headers.get('content-type') || 'application/octet-stream';
                    const size = Number(head.headers.get('content-length') ?? 0);
                    logger.log(`[FileUploader] Inspected ${url} (${contentType}, ${size} bytes)`);
                    return {
                        output: {
                            url,
                            contentType,
                            size,
                            reachable: String(head.ok),
                        },
                    };
                } catch (err: any) {
                    return {
                        output: {
                            url,
                            contentType: 'unknown',
                            size: 0,
                            reachable: 'false',
                        },
                        error: `Could not reach URL: ${err.message || err}`,
                    };
                }
            }

            case 'uploadFromUrl': {
                const rawUrl = String(inputs.sourceUrl ?? '').trim();
                if (!rawUrl) throw new Error('sourceUrl is required.');
                const safeUrl = await assertSafeOutboundUrl(rawUrl);
                const sourceUrl = safeUrl.toString();
                const res = await fetch(sourceUrl, { redirect: 'follow' });
                if (!res.ok) throw new Error(`Failed to fetch file: HTTP ${res.status}`);
                const buffer = Buffer.from(await res.arrayBuffer());
                if (buffer.byteLength > MAX_UPLOAD_BYTES) {
                    throw new Error(`File too large (${buffer.byteLength} bytes). Max ${MAX_UPLOAD_BYTES}.`);
                }
                const contentType = res.headers.get('content-type') || 'application/octet-stream';
                const filename = String(inputs.filename ?? '').trim() || sourceUrl.split('/').pop() || `file_${Date.now()}`;

                const { db } = await connectToDatabase();
                const fileId = randomUUID();
                await db.collection('sabflow_uploads').insertOne({
                    fileId,
                    userId: user._id,
                    filename,
                    contentType,
                    size: buffer.byteLength,
                    data: buffer, // Binary (BSON Binary)
                    source: 'url',
                    sourceUrl,
                    createdAt: new Date(),
                });

                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
                const url = `${baseUrl}/api/sabflow/uploads/${fileId}`;
                logger.log(`[FileUploader] Saved ${filename} (${buffer.byteLength} bytes) as ${fileId}`);
                return { output: { fileId, url, size: buffer.byteLength } };
            }

            case 'uploadBase64': {
                const raw = String(inputs.base64Data ?? '').trim();
                if (!raw) throw new Error('base64Data is required.');
                // Strip data URL prefix if present
                const cleaned = raw.replace(/^data:[^;]+;base64,/, '');
                const buffer = Buffer.from(cleaned, 'base64');
                if (buffer.byteLength === 0) throw new Error('Base64 data is empty or invalid.');
                if (buffer.byteLength > MAX_UPLOAD_BYTES) {
                    throw new Error(`File too large (${buffer.byteLength} bytes). Max ${MAX_UPLOAD_BYTES}.`);
                }

                const filename = String(inputs.filename ?? '').trim();
                if (!filename) throw new Error('filename is required.');
                const contentType = String(inputs.contentType ?? '').trim() || 'application/octet-stream';

                const { db } = await connectToDatabase();
                const fileId = randomUUID();
                await db.collection('sabflow_uploads').insertOne({
                    fileId,
                    userId: user._id,
                    filename,
                    contentType,
                    size: buffer.byteLength,
                    data: buffer,
                    source: 'base64',
                    createdAt: new Date(),
                });

                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
                const url = `${baseUrl}/api/sabflow/uploads/${fileId}`;
                logger.log(`[FileUploader] Saved base64 ${filename} (${buffer.byteLength} bytes) as ${fileId}`);
                return { output: { fileId, url, size: buffer.byteLength } };
            }

            default:
                return { error: `File Uploader action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'File Uploader action failed.' };
    }
}

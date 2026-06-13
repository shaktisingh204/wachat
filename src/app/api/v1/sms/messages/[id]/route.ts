import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

import { apiError, withSabsmsApi } from '@/lib/sabsms/apikeys/http';
import { getSabsmsCollections } from '@/lib/sabsms/db/collections';
import type { SabsmsMessage } from '@/lib/sabsms/types';

import { projectMessage } from '../projection';

/**
 * Public API — `GET /api/v1/sms/messages/:id`.
 *
 * Reads the canonical Mongo document with a `{ _id, workspaceId }`
 * filter so a key can never read another workspace's message (the
 * engine's `GET /v1/messages/:id` is not workspace-filtered, which is
 * why the public read path goes to Mongo directly).
 */
export const GET = withSabsmsApi<{ id: string }>(
  'messages:read',
  async (_req: NextRequest, { auth, params }) => {
    const { id } = params;
    if (!ObjectId.isValid(id)) {
      return apiError('not_found', 'Unknown message id', 404);
    }
    const { cols } = await getSabsmsCollections();
    const doc = (await cols.messages.findOne({
      _id: new ObjectId(id),
      workspaceId: auth.workspaceId,
    } as never)) as SabsmsMessage | null;
    if (!doc) return apiError('not_found', 'Unknown message id', 404);
    return NextResponse.json(projectMessage(doc));
  },
);

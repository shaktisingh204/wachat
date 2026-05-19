'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { requireSession } from '@/lib/hr-crud';
import type {
  CrmConnectionModuleKey,
  CrmModuleConnection,
  CrmModuleConnectionDTO,
} from '@/lib/worksuite/module-connections-types';

const COLLECTION = 'crm_module_connections';
const BASE_ROUTE = '/dashboard/crm/settings/integrations';

/**
 * Convenience action: returns the storage binding so client uploaders
 * (SabFilePicker on CRM pages) can preselect the configured root folder.
 * Shape mirrors `CrmStorageBinding` from the server lib.
 */
export async function getCrmStorageDefaults(): Promise<{
  rootFolderId: string | null;
  rootFolderName?: string;
  autoOrganize: boolean;
} | null> {
  const c = await getCrmModuleConnection('storage');
  if (!c || c.status !== 'connected') return null;
  return {
    rootFolderId: (c.config.rootFolderId as string | null) ?? null,
    rootFolderName: c.config.rootFolderName as string | undefined,
    autoOrganize: Boolean(c.config.autoOrganize),
  };
}

function toDTO(
  doc: CrmModuleConnection | (Omit<CrmModuleConnection, '_id'> & { _id: ObjectId }),
): CrmModuleConnectionDTO {
  return {
    _id: String(doc._id),
    moduleKey: doc.moduleKey,
    status: doc.status,
    config: doc.config ?? {},
    connectedAt: doc.connectedAt?.toISOString(),
    disconnectedAt: doc.disconnectedAt?.toISOString(),
    lastTestedAt: doc.lastTestedAt?.toISOString(),
    lastTestResult: doc.lastTestResult,
    lastTestError: doc.lastTestError,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function getCrmModuleConnection(
  moduleKey: CrmConnectionModuleKey,
): Promise<CrmModuleConnectionDTO | null> {
  const user = await requireSession();
  if (!user) return null;
  const { db } = await connectToDatabase();
  const doc = (await db
    .collection(COLLECTION)
    .findOne({
      userId: new ObjectId(user._id),
      moduleKey,
    })) as CrmModuleConnection | null;
  return doc ? toDTO(doc) : null;
}

export async function getAllCrmModuleConnections(): Promise<
  CrmModuleConnectionDTO[]
> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const docs = (await db
    .collection(COLLECTION)
    .find({ userId: new ObjectId(user._id) })
    .toArray()) as CrmModuleConnection[];
  return docs.map(toDTO);
}

export async function connectCrmModule(
  moduleKey: CrmConnectionModuleKey,
  config: Record<string, any>,
): Promise<{ ok: boolean; error?: string; connection?: CrmModuleConnectionDTO }> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { db } = await connectToDatabase();
  const now = new Date();
  const filter = { userId: new ObjectId(user._id), moduleKey };

  await db.collection(COLLECTION).updateOne(
    filter,
    {
      $set: {
        moduleKey,
        status: 'connected' as const,
        config,
        connectedAt: now,
        updatedAt: now,
      },
      $setOnInsert: {
        userId: new ObjectId(user._id),
        createdAt: now,
      },
      $unset: { disconnectedAt: '' },
    },
    { upsert: true },
  );

  const doc = (await db
    .collection(COLLECTION)
    .findOne(filter)) as CrmModuleConnection | null;

  revalidatePath(`${BASE_ROUTE}/${moduleKey}`);
  return { ok: true, connection: doc ? toDTO(doc) : undefined };
}

export async function disconnectCrmModule(
  moduleKey: CrmConnectionModuleKey,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { db } = await connectToDatabase();
  const now = new Date();

  await db.collection(COLLECTION).updateOne(
    { userId: new ObjectId(user._id), moduleKey },
    {
      $set: {
        status: 'disconnected' as const,
        disconnectedAt: now,
        updatedAt: now,
      },
    },
  );

  revalidatePath(`${BASE_ROUTE}/${moduleKey}`);
  return { ok: true };
}

/**
 * Smoke-test the connection by exercising the underlying module.
 * Today this is best-effort: it stamps `lastTestResult` on the doc and
 * returns the result. Per-module test implementations live in the page
 * server actions so they can call into the email/sms/sabfiles/ad-manager
 * helpers directly.
 */
export async function recordConnectionTest(
  moduleKey: CrmConnectionModuleKey,
  result: 'success' | 'failure',
  error?: string,
): Promise<void> {
  const user = await requireSession();
  if (!user) return;
  const { db } = await connectToDatabase();
  await db.collection(COLLECTION).updateOne(
    { userId: new ObjectId(user._id), moduleKey },
    {
      $set: {
        lastTestedAt: new Date(),
        lastTestResult: result,
        ...(error ? { lastTestError: error } : { lastTestError: '' }),
      },
    },
  );
}

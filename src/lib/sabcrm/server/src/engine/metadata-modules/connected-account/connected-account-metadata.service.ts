import 'server-only';

import { connectToDatabase } from '@/lib/mongodb';
import {
  ConnectedAccountExceptionCode,
  ConnectedAccountException,
} from 'src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/connected-account.exception';
import { type ConnectedAccountDocument } from 'src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/entities/connected-account.entity';

const COLLECTION = 'sabcrm_connected_account';

async function getCollection() {
  const { db } = await connectToDatabase();
  return db.collection<ConnectedAccountDocument>(COLLECTION);
}

export async function findByUserWorkspaceId({
  userWorkspaceId,
  workspaceId,
}: {
  userWorkspaceId: string;
  workspaceId: string;
}): Promise<ConnectedAccountDocument[]> {
  const col = await getCollection();
  return col.find({ userWorkspaceId, workspaceId }).toArray();
}

export async function findById({
  id,
  workspaceId,
}: {
  id: string;
  workspaceId: string;
}): Promise<ConnectedAccountDocument | null> {
  const col = await getCollection();
  return col.findOne({ id, workspaceId });
}

export async function findByIdAndUserWorkspaceId({
  id,
  userWorkspaceId,
  workspaceId,
}: {
  id: string;
  userWorkspaceId: string;
  workspaceId: string;
}): Promise<ConnectedAccountDocument | null> {
  const col = await getCollection();
  return col.findOne({ id, userWorkspaceId, workspaceId });
}

export async function verifyOwnership({
  id,
  userWorkspaceId,
  workspaceId,
}: {
  id: string;
  userWorkspaceId: string;
  workspaceId: string;
}): Promise<ConnectedAccountDocument> {
  const col = await getCollection();
  const connectedAccount = await col.findOne({ id, workspaceId });

  if (!connectedAccount) {
    throw new ConnectedAccountException(
      `Connected account ${id} not found`,
      ConnectedAccountExceptionCode.CONNECTED_ACCOUNT_NOT_FOUND,
    );
  }

  if (
    connectedAccount.visibility !== 'workspace' &&
    connectedAccount.userWorkspaceId !== userWorkspaceId
  ) {
    throw new ConnectedAccountException(
      `Connected account ${id} does not belong to user workspace ${userWorkspaceId}`,
      ConnectedAccountExceptionCode.CONNECTED_ACCOUNT_OWNERSHIP_VIOLATION,
    );
  }

  return connectedAccount;
}

export async function getUserConnectedAccountIds({
  userWorkspaceId,
  workspaceId,
}: {
  userWorkspaceId: string;
  workspaceId: string;
}): Promise<string[]> {
  const col = await getCollection();
  const accounts = await col
    .find({ userWorkspaceId, workspaceId }, { projection: { id: 1 } })
    .toArray();
  return accounts.map((a) => a.id);
}

export async function getWorkspaceSharedConnectedAccountIds({
  workspaceId,
}: {
  workspaceId: string;
}): Promise<string[]> {
  const col = await getCollection();
  const accounts = await col
    .find({ workspaceId, visibility: 'workspace' }, { projection: { id: 1 } })
    .toArray();
  return accounts.map((a) => a.id);
}

export async function createConnectedAccount(
  data: Omit<ConnectedAccountDocument, '_id'>,
): Promise<ConnectedAccountDocument> {
  const col = await getCollection();
  const now = new Date();
  const doc: ConnectedAccountDocument = {
    ...data,
    visibility: data.visibility ?? 'user',
    createdAt: now,
    updatedAt: now,
  };
  await col.insertOne(doc as ConnectedAccountDocument & { _id?: unknown });
  return doc;
}

export async function updateConnectedAccount({
  id,
  workspaceId,
  data,
}: {
  id: string;
  workspaceId: string;
  data: Partial<ConnectedAccountDocument>;
}): Promise<ConnectedAccountDocument> {
  const col = await getCollection();
  await col.updateOne({ id, workspaceId }, { $set: { ...data, updatedAt: new Date() } });
  const updated = await col.findOne({ id, workspaceId });
  if (!updated) {
    throw new ConnectedAccountException(
      `Connected account ${id} not found after update`,
      ConnectedAccountExceptionCode.CONNECTED_ACCOUNT_NOT_FOUND,
    );
  }
  return updated;
}

export async function deleteConnectedAccount({
  id,
  workspaceId,
}: {
  id: string;
  workspaceId: string;
}): Promise<ConnectedAccountDocument> {
  const col = await getCollection();
  const connectedAccount = await col.findOne({ id, workspaceId });

  if (!connectedAccount) {
    throw new ConnectedAccountException(
      `Connected account ${id} not found`,
      ConnectedAccountExceptionCode.CONNECTED_ACCOUNT_NOT_FOUND,
    );
  }

  // PORT-NOTE: Message/calendar channel counts were tracked in Postgres via related repositories.
  // In Mongo, callers should query sabcrm_message_channel and sabcrm_calendar_channel if needed.

  await col.deleteOne({ id, workspaceId });

  return connectedAccount;
}

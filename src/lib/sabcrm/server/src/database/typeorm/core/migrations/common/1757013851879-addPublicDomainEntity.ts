// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddPublicDomainEntity1757013851879
// Postgres: CREATE TABLE "core"."publicDomain" with a unique "domain" column
//           and a FK to workspace.
//
// In MongoDB: create the sabcrm_publicdomain collection and add a unique index
// on "domain" plus a workspaceId index.

import 'server-only';
import { connectToDatabase } from '@/lib/mongodb';

export const up = async (): Promise<void> => {
  const { db } = await connectToDatabase();

  await db.collection('sabcrm_publicdomain').createIndexes([
    { key: { domain: 1 }, unique: true, name: 'UQ_PUBLIC_DOMAIN_DOMAIN' },
    { key: { workspaceId: 1 }, name: 'IDX_PUBLIC_DOMAIN_WORKSPACE_ID' },
  ]);
};

export const down = async (): Promise<void> => {
  const { db } = await connectToDatabase();

  await db.collection('sabcrm_publicdomain').dropIndexes();
};

export const migrationName = 'AddPublicDomainEntity1757013851879';

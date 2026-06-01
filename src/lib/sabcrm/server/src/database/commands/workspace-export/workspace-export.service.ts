import 'server-only';
// PORT-NOTE: Ported from twenty-server database/commands/workspace-export/workspace-export.service.ts
// NestJS @Injectable() / @InjectDataSource / @InjectRepository decorators removed.
// TypeORM DataSource replaced by MongoDB via SabNode's connectToDatabase helper.
// The export writes to the local filesystem in the same way as the original.
// Postgres-specific COPY format kept for compatibility with the generated SQL file.

import { once } from 'events';
import { type WriteStream, createWriteStream, mkdirSync } from 'fs';
import { finished } from 'stream/promises';

import { connectToDatabase } from '@/lib/mongodb';
import { formatSqlValue } from '@/lib/sabcrm/server/src/database/commands/workspace-export/utils/format-sql-value.util';
import { formatPgCopyField } from '@/lib/sabcrm/server/src/database/commands/workspace-export/utils/format-pg-copy-value.util';
import { generateWorkspaceSchemaDdl } from '@/lib/sabcrm/server/src/database/commands/workspace-export/utils/generate-workspace-schema-ddl.util';
import { getCoreEntityMetadatasWithWorkspaceId } from '@/lib/sabcrm/server/src/database/commands/workspace-export/utils/get-core-entity-metadatas-with-workspace-id.util';

const BATCH_SIZE = 10_000;

export type WorkspaceExportParams = {
  workspaceId: string;
  outputPath: string;
  tableFilter?: string[];
};

type WriteRowsOptions = {
  collectionName: string;
  displayName: string;
  stream: WriteStream;
  filter?: Record<string, unknown>;
  jsonFields?: Set<string>;
  excludedFields?: Set<string>;
};

const isNonEmptyArray = <T>(arr: T[] | undefined): arr is T[] =>
  Array.isArray(arr) && arr.length > 0;

const escapeIdentifier = (name: string): string =>
  `"${name.replace(/"/g, '""')}"`;

/**
 * Builds an INSERT prefix like:
 *   INSERT INTO "schema"."table" ("col1", "col2") VALUES
 */
const buildInsertPrefix = (
  schemaName: string,
  tableName: string,
  columnNames: string[],
): string => {
  const escapedColumns = columnNames.map(escapeIdentifier).join(', ');

  return `INSERT INTO ${escapeIdentifier(schemaName)}.${escapeIdentifier(tableName)} (${escapedColumns}) VALUES `;
};

// ---------------------------------------------------------------------------

async function writeRows({
  collectionName,
  displayName,
  stream,
  filter = {},
  jsonFields,
  excludedFields,
}: WriteRowsOptions): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection(collectionName);

  let columnNames: string[] | undefined;
  let insertPrefix: string | undefined;
  let totalRows = 0;
  let offset = 0;

  for (;;) {
    const docs = await collection
      .find(filter)
      .sort({ _id: 1 })
      .skip(offset)
      .limit(BATCH_SIZE)
      .toArray();

    if (!isNonEmptyArray(docs)) break;

    if (!columnNames) {
      columnNames = Object.keys(docs[0]).filter(
        (key) => key !== '_id' && !excludedFields?.has(key),
      );
      insertPrefix = buildInsertPrefix('core', collectionName, columnNames);
    }

    totalRows += docs.length;
    offset += docs.length;

    const valueTuples: string[] = [];

    for (const doc of docs) {
      const row = doc as Record<string, unknown>;
      const formattedValues = columnNames.map((col) =>
        formatSqlValue(row[col], jsonFields?.has(col)),
      );

      valueTuples.push(`(${formattedValues.join(', ')})`);
    }

    const statement = `${insertPrefix}${valueTuples.join(', ')};\n`;

    if (!stream.write(statement)) {
      await once(stream, 'drain');
    }

    if (docs.length < BATCH_SIZE) break;
  }

  if (totalRows > 0) {
    console.log(`  ${displayName}: ${totalRows} rows`);
  }
}

async function writeCopyRows({
  collectionName,
  displayName,
  stream,
  filter = {},
  jsonFields,
  excludedFields,
}: WriteRowsOptions): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection(collectionName);

  let columnNames: string[] | undefined;
  let totalRows = 0;
  let offset = 0;

  for (;;) {
    const docs = await collection
      .find(filter)
      .sort({ _id: 1 })
      .skip(offset)
      .limit(BATCH_SIZE)
      .toArray();

    if (!isNonEmptyArray(docs)) break;

    if (!columnNames) {
      columnNames = Object.keys(docs[0]).filter(
        (key) => key !== '_id' && !excludedFields?.has(key),
      );

      const escapedColumns = columnNames.map(escapeIdentifier).join(', ');

      stream.write(
        `COPY ${escapeIdentifier('workspace')}.${escapeIdentifier(collectionName)} (${escapedColumns}) FROM stdin;\n`,
      );
    }

    totalRows += docs.length;
    offset += docs.length;

    for (const doc of docs) {
      const row = doc as Record<string, unknown>;
      const values = columnNames.map((col) =>
        formatPgCopyField(row[col], jsonFields?.has(col)),
      );

      if (!stream.write(values.join('\t') + '\n')) {
        await once(stream, 'drain');
      }
    }

    if (docs.length < BATCH_SIZE) break;
  }

  if (isNonEmptyArray(columnNames)) {
    stream.write('\\.\n\n');
  }

  if (totalRows > 0) {
    console.log(`  ${displayName}: ${totalRows} rows`);
  }
}

// ---------------------------------------------------------------------------

/**
 * Exports a workspace as a SQL file to the given outputPath directory.
 * Returns the absolute path of the written file.
 */
export const exportWorkspace = async ({
  workspaceId,
  outputPath,
  tableFilter,
}: WorkspaceExportParams): Promise<string> => {
  const { db } = await connectToDatabase();

  const workspace = await db
    .collection('sabcrm_workspace')
    .findOne({ id: workspaceId });

  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  console.log(`Exporting workspace ${workspaceId}`);

  // Fetch object + field metadata from Mongo collections.
  const objectMetadatas = await db
    .collection('sabcrm_objectmetadata')
    .find({ workspaceId })
    .toArray();

  const allFieldMetadatas = await db
    .collection('sabcrm_fieldmetadata')
    .find({ workspaceId })
    .toArray();

  const fieldsByObjectId = new Map<string, typeof allFieldMetadatas>();

  for (const field of allFieldMetadatas) {
    const key = field['objectMetadataId'] as string;
    const arr = fieldsByObjectId.get(key) ?? [];

    arr.push(field);
    fieldsByObjectId.set(key, arr);
  }

  mkdirSync(outputPath, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = `${outputPath}/${workspaceId}-${timestamp}.sql`;
  const stream = createWriteStream(filePath);

  try {
    stream.write("SET session_replication_role = 'replica';\n\n");

    // Write core workspace row.
    await writeRows({
      collectionName: 'sabcrm_workspace',
      displayName: 'workspace',
      stream,
      filter: { id: workspaceId },
    });

    // Write all core entity collections that carry workspaceId.
    const coreEntityDescriptors = getCoreEntityMetadatasWithWorkspaceId();

    for (const descriptor of coreEntityDescriptors) {
      try {
        await writeRows({
          collectionName: `sabcrm_${descriptor.tableName.toLowerCase()}`,
          displayName: descriptor.tableName,
          stream,
          filter: { workspaceId },
        });
      } catch (error) {
        console.warn(`${descriptor.tableName}: skipped`, error);
      }
    }

    // Emit workspace schema DDL.
    stream.write(`\n-- WORKSPACE SCHEMA DDL\n\n`);

    const ddlStatements = generateWorkspaceSchemaDdl(
      workspaceId,
      `workspace_${workspaceId.replace(/-/g, '_')}`,
      objectMetadatas as never,
      fieldsByObjectId as never,
    );

    for (const statement of ddlStatements) {
      stream.write(statement + '\n');
    }

    stream.write('\n');

    // Write workspace data rows (one collection per object metadata).
    for (const objectMetadata of objectMetadatas) {
      if (!objectMetadata['isActive']) continue;

      const nameSingular = objectMetadata['nameSingular'] as string;

      if (tableFilter && !tableFilter.includes(nameSingular)) {
        continue;
      }

      const collectionName = objectMetadata['isCustom']
        ? `sabcrm_custom_${nameSingular}`
        : `sabcrm_${nameSingular}`;

      try {
        await writeCopyRows({
          collectionName,
          displayName: nameSingular,
          stream,
        });
      } catch (error) {
        console.warn(`${nameSingular}: skipped`, error);
      }
    }

    stream.write("\nSET session_replication_role = 'origin';\n");
  } finally {
    stream.end();
    await finished(stream);
  }

  return filePath;
};

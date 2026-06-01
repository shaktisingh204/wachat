import "server-only";

// PORT-NOTE: Ported from twenty-server RecordPositionService (TypeORM/Postgres)
// to MongoDB. GlobalWorkspaceOrmManager is replaced with direct MongoDB
// collection access via connectToDatabase from @/lib/mongodb.
// sanitizeNumber is inlined below.

import { connectToDatabase } from "@/lib/mongodb";

export type RecordPositionServiceCreateArgs = {
  value: number | "first" | "last";
  objectMetadata: { isCustom: boolean; nameSingular: string };
  workspaceId: string;
  index?: number;
};

type ObjectRecord = { id: string; position: number | null };

const isNumber = (v: unknown): v is number =>
  typeof v === "number" && !Number.isNaN(v);

const isDefined = <T>(v: T | null | undefined): v is T =>
  v !== null && v !== undefined;

// Returns a numeric position or null for non-numeric/NaN values.
const sanitizeNumber = (v: unknown): number | null => {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
};

const collectionName = (objectMetadata: {
  isCustom: boolean;
  nameSingular: string;
}): string => `sabcrm_${objectMetadata.nameSingular.toLowerCase()}`;

// Finds the minimum numeric position value in the collection for the workspace.
const findMinPosition = async (
  objectMetadata: { isCustom: boolean; nameSingular: string },
  workspaceId: string
): Promise<number | null> => {
  const { db } = await connectToDatabase();
  const col = db.collection(collectionName(objectMetadata));

  const [doc] = await col
    .find({ workspaceId, position: { $type: "number" } })
    .sort({ position: 1 })
    .limit(1)
    .project<{ position: unknown }>({ position: 1, _id: 0 })
    .toArray();

  return sanitizeNumber(doc?.position ?? null);
};

// Finds the maximum numeric position value in the collection for the workspace.
const findMaxPosition = async (
  objectMetadata: { isCustom: boolean; nameSingular: string },
  workspaceId: string
): Promise<number | null> => {
  const { db } = await connectToDatabase();
  const col = db.collection(collectionName(objectMetadata));

  const [doc] = await col
    .find({ workspaceId, position: { $type: "number" } })
    .sort({ position: -1 })
    .limit(1)
    .project<{ position: unknown }>({ position: 1, _id: 0 })
    .toArray();

  return sanitizeNumber(doc?.position ?? null);
};

export const buildRecordPosition = async ({
  objectMetadata,
  value,
  workspaceId,
  index = 0,
}: RecordPositionServiceCreateArgs): Promise<number> => {
  if (isNumber(value)) {
    return value;
  }

  if (value === "first") {
    const minPos = await findMinPosition(objectMetadata, workspaceId);
    return minPos !== null ? minPos - index - 1 : 1;
  }

  const maxPos = await findMaxPosition(objectMetadata, workspaceId);
  return maxPos !== null ? maxPos + index + 1 : 1;
};

export const overridePositionOnRecords = async ({
  partialRecordInputs,
  workspaceId,
  objectMetadata,
  shouldBackfillPositionIfUndefined,
}: {
  partialRecordInputs: Partial<Record<string, unknown>>[];
  workspaceId: string;
  objectMetadata: {
    isCustom: boolean;
    nameSingular: string;
    fieldIdByName: Record<string, string>;
  };
  shouldBackfillPositionIfUndefined: boolean;
}): Promise<Partial<Record<string, unknown>>[]> => {
  const recordsThatNeedFirstPosition: Partial<Record<string, unknown>>[] = [];
  const recordsThatNeedLastPosition: Partial<Record<string, unknown>>[] = [];
  const recordsWithExistingNumberPosition: Partial<Record<string, unknown>>[] =
    [];
  const recordsThatShouldNotBeUpdated: Partial<Record<string, unknown>>[] = [];

  const positionFieldId = objectMetadata.fieldIdByName["position"];

  if (!isDefined(positionFieldId)) {
    return partialRecordInputs;
  }

  for (const partialRecordInput of partialRecordInputs) {
    if (partialRecordInput.position === "last") {
      recordsThatNeedLastPosition.push(partialRecordInput);
    } else if (typeof partialRecordInput.position === "number") {
      recordsWithExistingNumberPosition.push(partialRecordInput);
    } else if (partialRecordInput.position === "first") {
      recordsThatNeedFirstPosition.push(partialRecordInput);
    } else if (
      partialRecordInput.position === undefined &&
      shouldBackfillPositionIfUndefined
    ) {
      recordsThatNeedFirstPosition.push(partialRecordInput);
    } else {
      recordsThatShouldNotBeUpdated.push(partialRecordInput);
    }
  }

  const numericPositions = recordsWithExistingNumberPosition
    .map((record) => record.position)
    .filter((position) => isNumber(position)) as number[];

  const calculatePosition = (
    mathOperation: (positions: number[], existingPosition: number) => number,
    existingPosition: number | null
  ): number => {
    const sanitizedExistingPosition =
      isDefined(existingPosition) && !Number.isNaN(existingPosition)
        ? existingPosition
        : null;

    const fallback = sanitizedExistingPosition ?? 1;

    return numericPositions.length > 0
      ? mathOperation(numericPositions, fallback)
      : fallback;
  };

  if (recordsThatNeedFirstPosition.length > 0) {
    const existingRecordMinPosition = await findMinPosition(
      objectMetadata,
      workspaceId
    );

    const minPosition = calculatePosition(
      (positions, fallback) => Math.min(...positions, fallback),
      existingRecordMinPosition
    );

    for (const [index, record] of recordsThatNeedFirstPosition.entries()) {
      record.position = minPosition - index - 1;
    }
  }

  if (recordsThatNeedLastPosition.length > 0) {
    const existingRecordMaxPosition = await findMaxPosition(
      objectMetadata,
      workspaceId
    );

    const maxPosition = calculatePosition(
      (positions, fallback) => Math.max(...positions, fallback),
      existingRecordMaxPosition
    );

    for (const [index, record] of recordsThatNeedLastPosition.entries()) {
      record.position = maxPosition + index + 1;
    }
  }

  return [
    ...recordsThatNeedFirstPosition,
    ...recordsThatNeedLastPosition,
    ...recordsWithExistingNumberPosition,
    ...recordsThatShouldNotBeUpdated,
  ];
};

export const findByPosition = async (
  positionValue: number | null,
  objectMetadata: { isCustom: boolean; nameSingular: string },
  workspaceId: string
): Promise<{ id: string; position: number } | null> => {
  const { db } = await connectToDatabase();
  const col = db.collection<ObjectRecord>(collectionName(objectMetadata));

  const record = await col.findOne({ workspaceId, position: positionValue });

  if (!record) return null;

  return {
    id: record.id,
    position: record.position as number,
  };
};

export const updateRecordPosition = async (
  recordId: string,
  positionValue: number,
  objectMetadata: { isCustom: boolean; nameSingular: string },
  workspaceId: string
): Promise<void> => {
  const { db } = await connectToDatabase();
  const col = db.collection(collectionName(objectMetadata));

  await col.updateOne(
    { workspaceId, id: recordId },
    { $set: { position: positionValue } }
  );
};

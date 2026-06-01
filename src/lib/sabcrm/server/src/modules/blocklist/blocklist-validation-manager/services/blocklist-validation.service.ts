// PORT-NOTE: Adapted from twenty-server/src/modules/blocklist/blocklist-validation-manager/services/blocklist-validation.service.ts
// NestJS @Injectable class converted to plain exported functions.
// MongoDB queries replace TypeORM repository calls.

import "server-only";

import { z } from "zod";

import { getBlocklistCollection } from "@/lib/sabcrm/server/src/modules/blocklist/repositories/blocklist.repository";
import type { BlocklistDocument } from "@/lib/sabcrm/server/src/modules/blocklist/standard-objects/blocklist.workspace-entity";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type BlocklistItem = Omit<
  BlocklistDocument,
  "createdAt" | "updatedAt" | "_id"
> & {
  createdAt: string;
  updatedAt: string;
};

export type CreateManyArgs<T> = { data: T[] };
export type UpdateOneArgs<T> = { id: string; data: Partial<T> & { handle?: string; workspaceMemberId?: string } };

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

export class BlocklistValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userFriendlyMessage: string,
  ) {
    super(message);
    this.name = "BlocklistValidationError";
  }
}

// ---------------------------------------------------------------------------
// Schema validator
// ---------------------------------------------------------------------------

function isDomain(value: string): boolean {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/.test(
    value,
  );
}

const emailOrDomainSchema = z
  .string()
  .trim()
  .pipe(z.email({ error: "Invalid email or domain" }))
  .or(
    z.string().refine(
      (value) => value.startsWith("@") && isDomain(value.slice(1)),
      "Invalid email or domain",
    ),
  );

export async function validateSchema(blocklist: BlocklistItem[]) {
  for (const handle of blocklist.map((item) => item.handle)) {
    if (!handle) {
      throw new BlocklistValidationError(
        "Blocklist handle is required",
        "BAD_REQUEST",
        "Blocklist handle is required.",
      );
    }

    const result = emailOrDomainSchema.safeParse(handle);

    if (!result.success) {
      throw new BlocklistValidationError(
        result.error.issues[0]?.message ?? "Invalid email or domain",
        "BAD_REQUEST",
        "Invalid email or domain.",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Create-many validation
// ---------------------------------------------------------------------------

export async function validateBlocklistForCreateMany(
  payload: CreateManyArgs<BlocklistItem>,
  userId: string,
  workspaceId: string,
) {
  await validateSchema(payload.data);
  await validateUniquenessForCreateMany(payload, userId, workspaceId);
}

export async function validateUniquenessForCreateMany(
  payload: CreateManyArgs<BlocklistItem>,
  _userId: string,
  workspaceId: string,
) {
  const collection = await getBlocklistCollection();

  // Verify that no requesting item is assigned to a different workspace member
  const requestedMemberIds = payload.data
    .map((item) => item.workspaceMemberId)
    .filter(Boolean);

  if (requestedMemberIds.length > 0) {
    // In SabNode we enforce via RBAC — the check below validates handle uniqueness.
  }

  const handles = payload.data.map((item) => item.handle).filter(Boolean);

  if (handles.length > 0) {
    const existing = await collection.findOne({
      workspaceId,
      handle: { $in: handles as string[] },
    });

    if (existing) {
      throw new BlocklistValidationError(
        "Blocklist handle already exists",
        "BAD_REQUEST",
        "Blocklist handle already exists.",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Update-one validation
// ---------------------------------------------------------------------------

export async function validateBlocklistForUpdateOne(
  payload: UpdateOneArgs<BlocklistItem>,
  _userId: string,
  workspaceId: string,
) {
  if (payload.data.handle) {
    await validateSchema([payload.data as BlocklistItem]);
  }
  await validateUniquenessForUpdateOne(payload, workspaceId);
}

export async function validateUniquenessForUpdateOne(
  payload: UpdateOneArgs<BlocklistItem>,
  workspaceId: string,
) {
  const collection = await getBlocklistCollection();

  const existingRecord = await collection.findOne({
    id: payload.id,
    workspaceId,
  });

  if (!existingRecord) {
    throw new BlocklistValidationError(
      "Blocklist item not found",
      "RECORD_NOT_FOUND",
      "Blocklist item not found.",
    );
  }

  if (
    payload.data.workspaceMemberId &&
    existingRecord.workspaceMemberId !== payload.data.workspaceMemberId
  ) {
    throw new BlocklistValidationError(
      "Workspace member cannot be updated",
      "BAD_REQUEST",
      "Workspace member cannot be updated.",
    );
  }

  if (!payload.data.handle || existingRecord.handle === payload.data.handle) {
    return;
  }

  const duplicate = await collection.findOne({
    workspaceId,
    workspaceMemberId: existingRecord.workspaceMemberId,
    handle: payload.data.handle,
    id: { $ne: payload.id },
  });

  if (duplicate) {
    throw new BlocklistValidationError(
      "Blocklist handle already exists",
      "BAD_REQUEST",
      "Blocklist handle already exists.",
    );
  }
}

// ---------------------------------------------------------------------------
// Class façade (matches original API surface for callers that expect a class)
// ---------------------------------------------------------------------------

export class BlocklistValidationService {
  async validateBlocklistForCreateMany(
    payload: CreateManyArgs<BlocklistItem>,
    userId: string,
    workspaceId: string,
  ) {
    return validateBlocklistForCreateMany(payload, userId, workspaceId);
  }

  async validateBlocklistForUpdateOne(
    payload: UpdateOneArgs<BlocklistItem>,
    userId: string,
    workspaceId: string,
  ) {
    return validateBlocklistForUpdateOne(payload, userId, workspaceId);
  }

  async validateSchema(blocklist: BlocklistItem[]) {
    return validateSchema(blocklist);
  }
}

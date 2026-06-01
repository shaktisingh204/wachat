// PORT-NOTE: ObjectMetadataEntity (TypeORM) replaced with ObjectMetadataDocument
// (Mongo). ObjectMetadataDTO is defined inline. Logic ported verbatim.

// Mongo document shape for object metadata (minimal surface used by this util)
export type ObjectMetadataDocument = {
  id: string;
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
  isCustom: boolean;
  isActive: boolean;
  isSystem: boolean;
  isRemote: boolean;
  workspaceId: string;
  universalIdentifier: string;
  applicationId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  standardOverrides?: unknown | null;
  shortcut?: string | null;
  duplicateCriteria?: unknown | null;
  [key: string]: unknown;
};

export type ObjectMetadataDTO = {
  id: string;
  nameSingular: string;
  namePlural: string;
  labelSingular: string;
  labelPlural: string;
  isCustom: boolean;
  isActive: boolean;
  isSystem: boolean;
  isRemote: boolean;
  workspaceId: string;
  universalIdentifier: string;
  applicationId?: string;
  createdAt: Date;
  updatedAt: Date;
  description?: string;
  icon?: string;
  color?: string;
  standardOverrides?: unknown;
  shortcut?: string;
  duplicateCriteria?: unknown;
  [key: string]: unknown;
};

export const fromObjectMetadataEntityToObjectMetadataDto = (
  objectMetadataEntity: ObjectMetadataDocument,
): ObjectMetadataDTO => {
  const {
    createdAt,
    updatedAt,
    description,
    icon,
    color,
    standardOverrides,
    shortcut,
    duplicateCriteria,
    applicationId,
    ...rest
  } = objectMetadataEntity;

  return {
    ...rest,
    createdAt: new Date(createdAt as string | Date),
    updatedAt: new Date(updatedAt as string | Date),
    description: description ?? undefined,
    icon: icon ?? undefined,
    color: color ?? undefined,
    standardOverrides: standardOverrides ?? undefined,
    shortcut: shortcut ?? undefined,
    duplicateCriteria: duplicateCriteria ?? undefined,
    applicationId: applicationId ?? undefined,
  } as ObjectMetadataDTO;
};

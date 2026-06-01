// PORT-NOTE: getLogoUrlFromDomainName from twenty-shared/utils and FileFolder enum
// are stubbed here. extractFileIdFromUrl is also stubbed as it depends on the
// file-serving infra (R2/SabFiles) rather than Postgres.

import {
  type FlatFieldMetadata,
  type FlatObjectMetadata,
} from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/types/object-metadata-for-tool-schema.type';
import {
  type FlatEntityMaps,
  findFlatEntityByIdInFlatEntityMaps,
} from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/utils/get-record-display-name.util';

export enum FileFolder {
  FilesField = 'files-field',
  CorePicture = 'core-picture',
}

// Derives a favicon logo URL from a domain name — simplified stub.
const getLogoUrlFromDomainName = (domainUrl: string): string | null => {
  try {
    const url = new URL(
      domainUrl.startsWith('http') ? domainUrl : `https://${domainUrl}`,
    );
    return `https://www.google.com/s2/favicons?sz=64&domain_url=${url.hostname}`;
  } catch {
    return null;
  }
};

// Extracts a file ID embedded in a SabFiles URL — stub implementation.
const extractFileIdFromUrl = (
  url: string,
  _folder: FileFolder,
): string | null => {
  const match = /\/([a-f0-9-]{36})(?:[/?]|$)/i.exec(url);
  return match?.[1] ?? null;
};

const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

type FileOutput = { fileId: string };

type GetRecordImageIdentifierOptions = {
  record: Record<string, unknown>;
  flatObjectMetadata: FlatObjectMetadata;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  signUrl?: (
    fileId: string,
    fileFolder: FileFolder,
  ) => Promise<string | null> | string | null;
};

export const getRecordImageIdentifier = async ({
  record,
  flatObjectMetadata,
  flatFieldMetadataMaps,
  signUrl,
}: GetRecordImageIdentifierOptions): Promise<string | null> => {
  if (flatObjectMetadata.nameSingular === 'company') {
    const domainNameObj = record.domainName as
      | { primaryLinkUrl?: string }
      | undefined;
    const domainNamePrimaryLinkUrl = domainNameObj?.primaryLinkUrl;

    return domainNamePrimaryLinkUrl
      ? getLogoUrlFromDomainName(domainNamePrimaryLinkUrl) || null
      : null;
  }

  // TODO: Temporary solution before imageIdentifier refactor
  if (signUrl && flatObjectMetadata.nameSingular === 'person') {
    const avatarFileId = (record.avatarFile as FileOutput[])?.[0]?.fileId;
    if (!isDefined(avatarFileId)) {
      return null;
    }
    return signUrl(avatarFileId, FileFolder.FilesField);
  }

  if (
    signUrl &&
    flatObjectMetadata.nameSingular === 'workspaceMember' &&
    isDefined(record.avatarUrl)
  ) {
    const avatarFileId = extractFileIdFromUrl(
      record.avatarUrl as string,
      FileFolder.CorePicture,
    );
    if (!isDefined(avatarFileId)) {
      return null;
    }
    return signUrl(avatarFileId, FileFolder.CorePicture);
  }

  if (!isDefined(flatObjectMetadata.imageIdentifierFieldMetadataId)) {
    return null;
  }

  const imageIdentifierField = findFlatEntityByIdInFlatEntityMaps({
    flatEntityMaps: flatFieldMetadataMaps,
    flatEntityId: flatObjectMetadata.imageIdentifierFieldMetadataId,
  });

  if (!isDefined(imageIdentifierField)) {
    return null;
  }

  const imageValue = record[imageIdentifierField.name];

  if (!isDefined(imageValue)) {
    return null;
  }

  const rawImageValue = String(imageValue);

  if (!isNonEmptyString(rawImageValue)) {
    return null;
  }

  if (signUrl && flatObjectMetadata.nameSingular === 'workspaceMember') {
    return signUrl(rawImageValue, FileFolder.FilesField);
  }

  return rawImageValue;
};

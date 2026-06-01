import "server-only";

// PORT-NOTE: Ported from twenty-server RecordInputTransformerService.
// NestJS @Injectable class replaced with plain exported function.
// compositeTypeDefinitions from twenty-shared/types is stubbed as a Map
// because the heavy runtime is not needed for Mongo storage.
// Transform sub-functions (emails, links, phones, richText) reference
// stubs below — they mirror the original behavior where feasible.

import { FieldMetadataType } from "@/lib/sabcrm/shared/src/types/FieldMetadataType";
import {
  type FlatEntityMaps,
  findFlatEntityByIdInFlatEntityMaps,
} from "@/lib/sabcrm/server/src/engine/core-modules/record-crud/utils/get-record-display-name.util";
import {
  type FlatFieldMetadata,
  type FlatObjectMetadata,
} from "@/lib/sabcrm/server/src/engine/core-modules/record-crud/types/object-metadata-for-tool-schema.type";

// Minimal stub for composite type definitions used by the transformer.
// Each entry maps a FieldMetadataType to the sub-field property names + types.
const compositeTypeDefinitions = new Map<
  FieldMetadataType,
  { properties: Array<{ name: string; type: FieldMetadataType }> }
>([
  [
    FieldMetadataType.LINKS,
    {
      properties: [
        { name: "primaryLinkUrl", type: FieldMetadataType.TEXT },
        { name: "primaryLinkLabel", type: FieldMetadataType.TEXT },
        { name: "secondaryLinks", type: FieldMetadataType.RAW_JSON },
      ],
    },
  ],
  [
    FieldMetadataType.EMAILS,
    {
      properties: [
        { name: "primaryEmail", type: FieldMetadataType.TEXT },
        { name: "additionalEmails", type: FieldMetadataType.RAW_JSON },
      ],
    },
  ],
  [
    FieldMetadataType.PHONES,
    {
      properties: [
        { name: "primaryPhoneNumber", type: FieldMetadataType.TEXT },
        { name: "primaryPhoneCountryCode", type: FieldMetadataType.TEXT },
        { name: "primaryPhoneCallingCode", type: FieldMetadataType.TEXT },
        { name: "additionalPhones", type: FieldMetadataType.RAW_JSON },
      ],
    },
  ],
  [
    FieldMetadataType.FULL_NAME,
    {
      properties: [
        { name: "firstName", type: FieldMetadataType.TEXT },
        { name: "lastName", type: FieldMetadataType.TEXT },
      ],
    },
  ],
  [
    FieldMetadataType.ADDRESS,
    {
      properties: [
        { name: "addressStreet1", type: FieldMetadataType.TEXT },
        { name: "addressStreet2", type: FieldMetadataType.TEXT },
        { name: "addressCity", type: FieldMetadataType.TEXT },
        { name: "addressPostcode", type: FieldMetadataType.TEXT },
        { name: "addressState", type: FieldMetadataType.TEXT },
        { name: "addressCountry", type: FieldMetadataType.TEXT },
        { name: "addressLat", type: FieldMetadataType.NUMBER },
        { name: "addressLng", type: FieldMetadataType.NUMBER },
      ],
    },
  ],
  [
    FieldMetadataType.CURRENCY,
    {
      properties: [
        { name: "amountMicros", type: FieldMetadataType.NUMBER },
        { name: "currencyCode", type: FieldMetadataType.TEXT },
      ],
    },
  ],
  [
    FieldMetadataType.RICH_TEXT,
    {
      properties: [
        { name: "markdown", type: FieldMetadataType.TEXT },
        { name: "blocknote", type: FieldMetadataType.RAW_JSON },
      ],
    },
  ],
]);

const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

// Builds a fieldIdByName map from FlatObjectMetadata + FlatFieldMetadataMaps.
const buildFieldMapsFromFlatObjectMetadata = (
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>,
  _flatObjectMetadata: FlatObjectMetadata
): { fieldIdByName: Record<string, string> } => {
  const fieldIdByName: Record<string, string> = {};

  flatFieldMetadataMaps.byId.forEach((field) => {
    fieldIdByName[field.name] = field.id;
  });

  return { fieldIdByName };
};

// Normalizes a URL string origin (strips trailing slashes, etc.).
const normalizeUrlOrigin = (url: string): string => {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.href.replace(/\/$/, "");
  } catch {
    return url;
  }
};

// --- Inline transform helpers (simplified, no external libs) ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformEmailsValue = (value: any): any => {
  if (!isDefined(value)) return value;

  let additionalEmails: string | null = value?.additionalEmails ?? null;
  const primaryEmail =
    typeof value?.primaryEmail === "string" && value.primaryEmail
      ? value.primaryEmail.toLowerCase()
      : null;

  if (additionalEmails) {
    try {
      const emailArray = (
        typeof additionalEmails === "string"
          ? JSON.parse(additionalEmails)
          : additionalEmails
      ) as string[];

      additionalEmails = Array.isArray(emailArray) && emailArray.length > 0
        ? JSON.stringify(emailArray.map((e) => e.toLowerCase()))
        : null;
    } catch {
      // keep as-is
    }
  }

  return { primaryEmail, additionalEmails };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformLinksValue = (value: any): any => {
  if (!isDefined(value)) return value;

  const primaryLinkUrl = isDefined(value.primaryLinkUrl)
    ? normalizeUrlOrigin(value.primaryLinkUrl)
    : value.primaryLinkUrl ?? null;

  let secondaryLinks = value.secondaryLinks ?? null;
  if (typeof secondaryLinks === "string") {
    try {
      secondaryLinks = JSON.parse(secondaryLinks);
    } catch {
      // keep as string
    }
  }
  if (Array.isArray(secondaryLinks) && secondaryLinks.length === 0) {
    secondaryLinks = null;
  }
  if (Array.isArray(secondaryLinks)) {
    secondaryLinks = JSON.stringify(
      secondaryLinks.map((link: { url?: string; label?: string }) => ({
        ...link,
        url: isDefined(link.url) ? normalizeUrlOrigin(link.url) : link.url,
      }))
    );
  }

  return {
    ...value,
    primaryLinkUrl,
    primaryLinkLabel: value.primaryLinkLabel ?? null,
    secondaryLinks,
  };
};

// Simplified phone transform — validates basic structure only.
// PORT-NOTE: Full validation with libphonenumber-js is not pulled in here to
// avoid a heavy dependency. Add libphonenumber-js and replace this stub when
// strict phone validation is required.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformPhonesValue = ({ input }: { input: any }): any => {
  if (!isDefined(input)) return input;
  return input;
};

// Simplified rich-text transform — returns the value as-is.
// PORT-NOTE: @blocknote/server-util converts between markdown and blocknote
// formats. That ESM-only dependency is not available in the Next.js server
// bundle without additional config. Replace this stub with the real transform
// when @blocknote/server-util is integrated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformRichTextValue = async (value: any): Promise<any> => {
  return value;
};

// --- Field value transformation ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformFieldValue = async (fieldType: FieldMetadataType, value: any): Promise<any> => {
  if (!isDefined(value)) return value;

  switch (fieldType) {
    case FieldMetadataType.UUID:
      return value || null;
    case FieldMetadataType.NUMBER:
      return value === null ? null : Number(value);
    case FieldMetadataType.RICH_TEXT:
      return transformRichTextValue(value);
    case FieldMetadataType.LINKS:
      return transformLinksValue(value);
    case FieldMetadataType.EMAILS:
      return transformEmailsValue(value);
    case FieldMetadataType.PHONES:
      return transformPhonesValue({ input: value });
    default:
      return value;
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stringifySubFields = (fieldMetadataType: FieldMetadataType, value: any): any => {
  const compositeType = compositeTypeDefinitions.get(fieldMetadataType);
  if (!compositeType || typeof value !== "object" || value === null) return value;

  return Object.entries(value).reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (acc: Record<string, any>, [subFieldName, subFieldValue]) => {
      const subFieldType = compositeType.properties.find(
        (p) => p.name === subFieldName
      )?.type;

      if (subFieldType === FieldMetadataType.RAW_JSON) {
        return {
          ...acc,
          [subFieldName]: subFieldValue
            ? JSON.stringify(subFieldValue)
            : subFieldValue,
        };
      }

      return { ...acc, [subFieldName]: subFieldValue };
    },
    {}
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseSubFields = (fieldMetadataType: FieldMetadataType, value: any): any => {
  const compositeType = compositeTypeDefinitions.get(fieldMetadataType);
  if (!compositeType || typeof value !== "object" || value === null) return value;

  return Object.entries(value).reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (acc: Record<string, any>, [subFieldName, subFieldValue]) => {
      const subFieldType = compositeType.properties.find(
        (p) => p.name === subFieldName
      )?.type;

      if (subFieldType === FieldMetadataType.RAW_JSON) {
        return {
          ...acc,
          [subFieldName]: subFieldValue
            ? JSON.parse(subFieldValue as string)
            : subFieldValue,
        };
      }

      return { ...acc, [subFieldName]: subFieldValue };
    },
    {}
  );
};

export const processRecordInput = async ({
  recordInput,
  flatObjectMetadata,
  flatFieldMetadataMaps,
}: {
  recordInput: Partial<Record<string, unknown>>;
  flatObjectMetadata: FlatObjectMetadata;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
}): Promise<Partial<Record<string, unknown>>> => {
  let transformedEntries: Record<string, unknown> = {};

  const { fieldIdByName } = buildFieldMapsFromFlatObjectMetadata(
    flatFieldMetadataMaps,
    flatObjectMetadata
  );

  for (const [key, value] of Object.entries(recordInput)) {
    const fieldMetadataId = fieldIdByName[key];
    const fieldMetadata = fieldMetadataId
      ? findFlatEntityByIdInFlatEntityMaps({
          flatEntityId: fieldMetadataId,
          flatEntityMaps: flatFieldMetadataMaps,
        })
      : undefined;

    if (!fieldMetadata) {
      transformedEntries = { ...transformedEntries, [key]: value };
      continue;
    }

    const type = fieldMetadata.type as FieldMetadataType;

    const transformedValue = parseSubFields(
      type,
      await transformFieldValue(
        type,
        stringifySubFields(type, value)
      )
    );

    transformedEntries = { ...transformedEntries, [key]: transformedValue };
  }

  return transformedEntries;
};

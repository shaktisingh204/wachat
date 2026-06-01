/*
 * _____                    _
 *|_   _|_      _____ _ __ | |_ _   _
 *  | | \ \ /\ / / _ \ '_ \| __| | | | Auto-generated file
 *  | |  \ V  V /  __/ | | | |_| |_| | Any edits to this will be overridden
 *  |_|   \_/\_/ \___|_| |_|\__|\__, |
 *                              |___/
 */

// Composite types
export type { ActorMetadata } from './composite-types/actor.composite-type';
export {
  FieldActorSource,
  actorCompositeType,
} from './composite-types/actor.composite-type';
export type { AddressMetadata } from './composite-types/address.composite-type';
export { addressCompositeType } from './composite-types/address.composite-type';
export { compositeTypeDefinitions } from './composite-types/composite-type-definitions';
export type {
  CompositeProperty,
  CompositeType,
} from './composite-types/composite-type.interface';
export type { CurrencyMetadata } from './composite-types/currency.composite-type';
export { currencyCompositeType } from './composite-types/currency.composite-type';
export type { EmailsMetadata } from './composite-types/emails.composite-type';
export { emailsCompositeType } from './composite-types/emails.composite-type';
export type { FullNameMetadata } from './composite-types/full-name.composite-type';
export { fullNameCompositeType } from './composite-types/full-name.composite-type';
export type {
  LinkMetadata,
  LinksMetadata,
  LinkMetadataNullable,
} from './composite-types/links.composite-type';
export { linksCompositeType } from './composite-types/links.composite-type';
export type {
  AdditionalPhoneMetadata,
  PhonesMetadata,
} from './composite-types/phones.composite-type';
export { phonesCompositeType } from './composite-types/phones.composite-type';
export type { RichTextMetadata } from './composite-types/rich-text.composite-type';
export {
  richTextCompositeType,
  richTextValueSchema,
} from './composite-types/rich-text.composite-type';

// Field metadata
export type { FieldMetadataMultiItemSettings } from './FieldMetadataMultiItemSettings';
export { FieldMetadataSettingsOnClickAction } from './FieldMetadataMultiItemSettings';
export type {
  TagColor,
  FieldMetadataOptionForAnyType,
  FieldMetadataOptions,
} from './FieldMetadataOptions';
export {
  FieldMetadataDefaultOption,
  FieldMetadataComplexOption,
} from './FieldMetadataOptions';
export type {
  FieldNumberVariant,
  FieldMetadataSettingsMapping,
  AllFieldMetadataSettings,
  FieldMetadataSettings,
} from './FieldMetadataSettings';
export { NumberDataType, DateDisplayFormat } from './FieldMetadataSettings';
export { FieldMetadataType } from './FieldMetadataType';
export type { FieldMetadataUniversalSettings } from './FieldMetadataUniversalSettings';
export type { FieldRatingValue } from './FieldRatingValue';

// File types
export type { FileCategory } from './FileCategory';
export { FILE_CATEGORIES } from './FileCategory';
export { FileFolder } from './FileFolder';

// Filter types
export type {
  FilterableFieldType,
  FilterableAndTSVectorFieldType,
} from './FilterableFieldType';
export { FILTERABLE_FIELD_TYPES } from './FilterableFieldType';

// Date/time
export { FirstDayOfTheWeek } from './FirstDayOfTheWeek';

// Serialized relation utilities
export type { FormatRecordSerializedRelationProperties } from './FormatRecordSerializedRelationProperties.type';
export type { FromTo } from './FromToType';

// HTTP
export { HTTPMethod } from './HttpMethod';

// Utility types
export type { IndexOf } from './IndexOf.type';
export type { IsEmptyObject } from './IsEmptyObject.type';
export type { IsEmptyRecord } from './IsEmptyRecord.type';
export type { IsExactly } from './IsExactly';
export type { IsGreaterOrEqual } from './IsGreaterOrEqual.type';
export type { IsNever } from './IsNever.type';
export type { IsSerializedRelation } from './IsSerializedRelation.type';

// Logic function
export type { LogicFunctionEvent } from './LogicFunctionEvent';

// Message channel types
export { MessageChannelContactAutoCreationPolicy } from './MessageChannelContactAutoCreationPolicy';
export { MessageChannelPendingGroupEmailsAction } from './MessageChannelPendingGroupEmailsAction';
export { MessageChannelSyncStage } from './MessageChannelSyncStage';
export { MessageChannelSyncStatus } from './MessageChannelSyncStatus';
export { MessageChannelType } from './MessageChannelType';
export { MessageChannelVisibility } from './MessageChannelVisibility';
export { MessageFolderImportPolicy } from './MessageFolderImportPolicy';
export { MessageFolderPendingSyncAction } from './MessageFolderPendingSyncAction';
export { MessageParticipantRole } from './MessageParticipantRole';
export type { MetadataGqlOperationSignature } from './MetadataGqlOperationSignature';
export type { ModifiedProperties } from './ModifiedProperties';

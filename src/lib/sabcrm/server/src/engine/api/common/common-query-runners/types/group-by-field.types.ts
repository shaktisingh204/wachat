import "server-only";

// PORT-NOTE: Ported from Twenty's GroupByField types.
// No NestJS or TypeORM dependency.

import type { FirstDayOfTheWeek } from '@/lib/sabcrm/shared/src/types/FirstDayOfTheWeek';
import type { ObjectRecordGroupByDateGranularity } from '@/lib/sabcrm/shared/src/types/ObjectRecordGroupByDateGranularity';
import type { FlatFieldMetadata } from '@/lib/sabcrm/server/src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';

export type GroupByRegularField = {
  fieldMetadata: FlatFieldMetadata;
  subFieldName?: string;
  shouldUnnest?: boolean;
};

export type GroupByDateField = {
  fieldMetadata: FlatFieldMetadata;
  subFieldName?: string;
  dateGranularity: ObjectRecordGroupByDateGranularity;
  weekStartDay?: FirstDayOfTheWeek;
  timeZone?: string;
};

export type GroupByRelationField = {
  fieldMetadata: FlatFieldMetadata;
  nestedFieldMetadata: FlatFieldMetadata;
  nestedSubFieldName?: string;
  dateGranularity?: ObjectRecordGroupByDateGranularity;
  weekStartDay?: FirstDayOfTheWeek;
  timeZone?: string;
};

export type GroupByField =
  | GroupByRegularField
  | GroupByDateField
  | GroupByRelationField;

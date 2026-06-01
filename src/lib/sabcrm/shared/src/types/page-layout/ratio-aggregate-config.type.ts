// PORT-NOTE: Companion type needed by page-layout-widget-configuration.type.ts.
// Ported from twenty-shared page-layout types.
import { type SerializedRelation } from '../SerializedRelation.type';

export type RatioAggregateConfig = {
  fieldMetadataId: SerializedRelation;
  optionValue: string;
};

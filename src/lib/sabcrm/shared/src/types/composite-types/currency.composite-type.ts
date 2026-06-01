import { FieldMetadataType } from '../FieldMetadataType';
import { type CompositeType } from './composite-type.interface';

export const currencyCompositeType: CompositeType = {
  type: FieldMetadataType.CURRENCY,
  properties: [
    {
      name: 'amountMicros',
      type: FieldMetadataType.NUMERIC,
      hidden: false,
      isRequired: false,
    },
    {
      name: 'currencyCode',
      type: FieldMetadataType.TEXT,
      hidden: false,
      isRequired: false,
    },
  ],
};

export type CurrencyMetadata = {
  amountMicros: number;
  currencyCode: string;
};

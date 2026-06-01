import { type MetadataGqlOperationSignature } from '@/lib/sabcrm/shared/src/types/MetadataGqlOperationSignature';
import { type RecordGqlOperationSignature } from '@/lib/sabcrm/shared/src/types/RecordGqlOperationSignature';

export const isMetadataGqlOperationSignature = (
  operationSignature:
    | RecordGqlOperationSignature
    | MetadataGqlOperationSignature,
): operationSignature is MetadataGqlOperationSignature =>
  'metadataName' in operationSignature;

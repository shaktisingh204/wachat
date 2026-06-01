import { type MetadataGqlOperationSignature } from '@/lib/sabcrm/shared/src/types/MetadataGqlOperationSignature';
import { type RecordGqlOperationSignature } from '@/lib/sabcrm/shared/src/types/RecordGqlOperationSignature';

export const isRecordGqlOperationSignature = (
  operationSignature:
    | RecordGqlOperationSignature
    | MetadataGqlOperationSignature,
): operationSignature is RecordGqlOperationSignature =>
  'objectNameSingular' in operationSignature;

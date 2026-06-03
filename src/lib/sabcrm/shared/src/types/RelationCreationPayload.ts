import { type RelationType } from './RelationType';

export type RelationCreationPayload = {
  type: RelationType;
  targetObjectMetadataId: string;
  targetFieldLabel: string;
  targetFieldIcon: string;
};

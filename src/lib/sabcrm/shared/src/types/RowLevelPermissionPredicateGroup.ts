/* @license Enterprise */

import { type RowLevelPermissionPredicateGroupLogicalOperator } from './RowLevelPermissionPredicateGroupLogicalOperator';

export type RowLevelPermissionPredicateGroup = {
  id: string;
  logicalOperator: RowLevelPermissionPredicateGroupLogicalOperator;
  objectMetadataId: string;
  parentRowLevelPermissionPredicateGroupId: string | null;
  positionInRowLevelPermissionPredicateGroup: number | null;
  roleId: string;
};

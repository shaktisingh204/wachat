import { type ObjectRecord } from '@/lib/sabcrm/shared/types';

import { type CommonPageInfo } from '@/lib/sabcrm/server/src/engine/api/common/types/common-page-info.type';
import { type CommonSelectedFieldsResult } from '@/lib/sabcrm/server/src/engine/api/common/types/common-selected-fields-result.type';

export type CommonFindManyOutput = {
  records: ObjectRecord[];
  aggregatedValues: Record<string, number>;
  totalCount: number;
  pageInfo: CommonPageInfo;
  selectedFieldsResult: CommonSelectedFieldsResult;
};

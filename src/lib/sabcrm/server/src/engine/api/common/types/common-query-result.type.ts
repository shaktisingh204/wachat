import { type ObjectRecord } from '@/lib/sabcrm/shared/types';

import { type CommonFindDuplicatesOutputItem } from '@/lib/sabcrm/server/src/engine/api/common/types/common-find-duplicates-output-item.type';
import { type CommonFindManyOutput } from '@/lib/sabcrm/server/src/engine/api/common/types/common-find-many-output.type';
import { type CommonGroupByOutputItem } from '@/lib/sabcrm/server/src/engine/api/common/types/common-group-by-output-item.type';
import {
  type CommonExtendedInput,
  type CommonQueryArgs,
} from '@/lib/sabcrm/server/src/engine/api/common/types/common-query-args.type';

export type CommonQueryResult =
  | ObjectRecord[]
  | ObjectRecord
  | CommonGroupByOutputItem[]
  | CommonFindManyOutput
  | CommonFindDuplicatesOutputItem[];

export type CommonQueryExecutionResult<
  Output extends CommonQueryResult,
  Args extends CommonQueryArgs,
> = {
  results: Output;
  args: CommonExtendedInput<Args>;
};

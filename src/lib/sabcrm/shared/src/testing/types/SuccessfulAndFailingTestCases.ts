import { type EachTestingContext } from '@/lib/sabcrm/shared/src/testing/types/EachTestingContext.type';

export type SuccessfulAndFailingTestCases<T> = {
  successful: EachTestingContext<T>[];
  failing: EachTestingContext<T>[];
};

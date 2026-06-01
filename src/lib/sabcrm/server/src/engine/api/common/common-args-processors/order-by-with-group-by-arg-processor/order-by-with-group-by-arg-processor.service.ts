import "server-only";

import {
  OrderByWithGroupBy,
  type AggregateOrderByWithGroupByField,
  type ObjectRecordOrderByForCompositeField,
  type ObjectRecordOrderByForRelationField,
  type ObjectRecordOrderByForScalarField,
  type ObjectRecordOrderByWithGroupByDateField,
} from "@/lib/sabcrm/shared/types";
import { isDefined } from "@/lib/sabcrm/shared/utils";

// PORT-NOTE: NestJS @Injectable() removed; exported as plain class for use without DI.
export class OrderByWithGroupByArgProcessorService {
  process({
    orderBy,
  }: {
    orderBy:
      | undefined
      | ObjectRecordOrderByForScalarField
      | ObjectRecordOrderByForCompositeField
      | ObjectRecordOrderByWithGroupByDateField
      | ObjectRecordOrderByForRelationField
      | AggregateOrderByWithGroupByField
      | OrderByWithGroupBy;
  }): OrderByWithGroupBy | undefined {
    if (Array.isArray(orderBy) || !isDefined(orderBy)) {
      return orderBy;
    }

    return [orderBy];
  }
}

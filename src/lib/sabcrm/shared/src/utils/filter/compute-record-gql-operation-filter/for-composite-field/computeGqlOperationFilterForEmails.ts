import { type CompositeFieldSubFieldName } from '@/lib/sabcrm/shared/src/types/CompositeFieldSubFieldNameType';
import { type PartialFieldMetadataItem } from '@/lib/sabcrm/shared/src/types/PartialFieldMetadataItem';
import {
  type EmailsFilter,
  type RecordGqlOperationFilter,
} from '@/lib/sabcrm/shared/src/types/RecordGqlOperationFilter';
import { ViewFilterOperand as RecordFilterOperand } from '@/lib/sabcrm/shared/src/types/ViewFilterOperand';
import { CustomError } from '@/lib/sabcrm/shared/src/utils/errors';
import { type RecordFilter } from '@/lib/sabcrm/shared/src/utils/filter/turnRecordFilterGroupIntoGqlOperationFilter';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export const computeGqlOperationFilterForEmails = ({
  recordFilter,
  correspondingFieldMetadataItem,
  subFieldName,
}: {
  recordFilter: Omit<RecordFilter, 'id'>;
  correspondingFieldMetadataItem: Pick<
    PartialFieldMetadataItem,
    'name' | 'type'
  >;
  subFieldName: CompositeFieldSubFieldName | null | undefined;
}): RecordGqlOperationFilter => {
  const isSubFieldFilter = isNonEmptyString(subFieldName);

  if (isSubFieldFilter) {
    switch (subFieldName) {
      case 'primaryEmail': {
        switch (recordFilter.operand) {
          case RecordFilterOperand.CONTAINS:
            return {
              [correspondingFieldMetadataItem.name]: {
                primaryEmail: {
                  ilike: `%${recordFilter.value}%`,
                },
              } satisfies EmailsFilter,
            };
          case RecordFilterOperand.DOES_NOT_CONTAIN:
            return {
              not: {
                [correspondingFieldMetadataItem.name]: {
                  primaryEmail: {
                    ilike: `%${recordFilter.value}%`,
                  },
                } satisfies EmailsFilter,
              },
            };
          default:
            throw new Error(
              `Unknown operand ${recordFilter.operand} for ${correspondingFieldMetadataItem.type} filter`,
            );
        }
      }
      case 'additionalEmails': {
        switch (recordFilter.operand) {
          case RecordFilterOperand.CONTAINS:
            return {
              [correspondingFieldMetadataItem.name]: {
                additionalEmails: {
                  like: `%${recordFilter.value}%`,
                },
              } satisfies EmailsFilter,
            };
          case RecordFilterOperand.DOES_NOT_CONTAIN:
            return {
              or: [
                {
                  not: {
                    [correspondingFieldMetadataItem.name]: {
                      additionalEmails: {
                        like: `%${recordFilter.value}%`,
                      },
                    } satisfies EmailsFilter,
                  },
                },
                {
                  [correspondingFieldMetadataItem.name]: {
                    additionalEmails: {
                      is: 'NULL',
                    },
                  } satisfies EmailsFilter,
                },
              ],
            };
          default:
            throw new CustomError(
              `Unknown operand ${recordFilter.operand} for ${correspondingFieldMetadataItem.type} filter`,
              'UNKNOWN_OPERAND_FOR_FILTER',
            );
        }
      }
      default: {
        throw new CustomError(
          `Unknown subfield name ${subFieldName}`,
          'UNKNOWN_SUBFIELD_NAME',
        );
      }
    }
  }

  switch (recordFilter.operand) {
    case RecordFilterOperand.CONTAINS:
      return {
        or: [
          {
            [correspondingFieldMetadataItem.name]: {
              primaryEmail: {
                ilike: `%${recordFilter.value}%`,
              },
            } satisfies EmailsFilter,
          },
          {
            [correspondingFieldMetadataItem.name]: {
              additionalEmails: {
                like: `%${recordFilter.value}%`,
              },
            } satisfies EmailsFilter,
          },
        ],
      };
    case RecordFilterOperand.DOES_NOT_CONTAIN:
      return {
        and: [
          {
            not: {
              [correspondingFieldMetadataItem.name]: {
                primaryEmail: {
                  ilike: `%${recordFilter.value}%`,
                },
              } satisfies EmailsFilter,
            },
          },
          {
            or: [
              {
                not: {
                  [correspondingFieldMetadataItem.name]: {
                    additionalEmails: {
                      like: `%${recordFilter.value}%`,
                    },
                  } satisfies EmailsFilter,
                },
              },
              {
                [correspondingFieldMetadataItem.name]: {
                  additionalEmails: {
                    is: 'NULL',
                  },
                } satisfies EmailsFilter,
              },
            ],
          },
        ],
      };
    default:
      throw new Error(
        `Unknown operand ${recordFilter.operand} for ${correspondingFieldMetadataItem.type} filter`,
      );
  }
};

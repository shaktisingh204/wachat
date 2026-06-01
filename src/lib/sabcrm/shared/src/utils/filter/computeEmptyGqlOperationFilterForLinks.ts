import { type PartialFieldMetadataItem } from '@/lib/sabcrm/shared/src/types/PartialFieldMetadataItem';
import {
  type LinksFilter,
  type RecordGqlOperationFilter,
} from '@/lib/sabcrm/shared/src/types/RecordGqlOperationFilter';
import { CustomError } from '@/lib/sabcrm/shared/src/utils/errors';
import { type RecordFilter } from '@/lib/sabcrm/shared/src/utils/filter/turnRecordFilterGroupIntoGqlOperationFilter';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export const computeEmptyGqlOperationFilterForLinks = ({
  recordFilter,
  correspondingFieldMetadataItem,
}: {
  recordFilter: Omit<RecordFilter, 'id'>;
  correspondingFieldMetadataItem: Pick<PartialFieldMetadataItem, 'name'>;
}): RecordGqlOperationFilter => {
  const subFieldName = recordFilter.subFieldName;
  const isSubFieldFilter = isNonEmptyString(subFieldName);

  if (isSubFieldFilter) {
    switch (subFieldName) {
      case 'primaryLinkLabel': {
        return {
          or: [
            {
              [correspondingFieldMetadataItem.name]: {
                primaryLinkLabel: { eq: '' },
              } satisfies LinksFilter,
            },
            {
              [correspondingFieldMetadataItem.name]: {
                primaryLinkLabel: { is: 'NULL' },
              } satisfies LinksFilter,
            },
          ],
        };
      }
      case 'primaryLinkUrl': {
        return {
          or: [
            {
              [correspondingFieldMetadataItem.name]: {
                primaryLinkUrl: { eq: '' },
              } satisfies LinksFilter,
            },
            {
              [correspondingFieldMetadataItem.name]: {
                primaryLinkUrl: { is: 'NULL' },
              } satisfies LinksFilter,
            },
          ],
        };
      }
      case 'secondaryLinks': {
        return {
          or: [
            {
              [correspondingFieldMetadataItem.name]: {
                secondaryLinks: { is: 'NULL' },
              } satisfies LinksFilter,
            },
            {
              [correspondingFieldMetadataItem.name]: {
                secondaryLinks: { like: '[]' },
              } satisfies LinksFilter,
            },
          ],
        };
      }
      default: {
        throw new CustomError(
          `Unknown subfield name ${subFieldName}`,
          'UNKNOWN_SUBFIELD_NAME',
        );
      }
    }
  }

  return {
    and: [
      {
        or: [
          {
            [correspondingFieldMetadataItem.name]: {
              primaryLinkLabel: { eq: '' },
            } satisfies LinksFilter,
          },
          {
            [correspondingFieldMetadataItem.name]: {
              primaryLinkLabel: { is: 'NULL' },
            } satisfies LinksFilter,
          },
        ],
      },
      {
        or: [
          {
            [correspondingFieldMetadataItem.name]: {
              primaryLinkUrl: { eq: '' },
            } satisfies LinksFilter,
          },
          {
            [correspondingFieldMetadataItem.name]: {
              primaryLinkUrl: { is: 'NULL' },
            } satisfies LinksFilter,
          },
        ],
      },
      {
        or: [
          {
            [correspondingFieldMetadataItem.name]: {
              secondaryLinks: { is: 'NULL' },
            } satisfies LinksFilter,
          },
          {
            [correspondingFieldMetadataItem.name]: {
              secondaryLinks: { like: '[]' },
            } satisfies LinksFilter,
          },
        ],
      },
    ],
  };
};

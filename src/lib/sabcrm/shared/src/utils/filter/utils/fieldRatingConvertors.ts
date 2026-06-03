import { RATING_VALUES } from '@/lib/sabcrm/shared/src/constants/RatingValues';
import { type FieldRatingValue } from '@/lib/sabcrm/shared/src/types/FieldRatingValue';

export const convertGreaterThanOrEqualRatingToArrayOfRatingValues = (
  greaterThanValue: number,
) =>
  RATING_VALUES.filter(
    (ratingValue) => +ratingValue.split('_')[1] >= greaterThanValue,
  );

export const convertLessThanOrEqualRatingToArrayOfRatingValues = (
  lessThanValue: number,
) =>
  RATING_VALUES.filter(
    (ratingValue) => +ratingValue.split('_')[1] <= lessThanValue,
  );

export const convertRatingToRatingValue = (rating: number) =>
  `RATING_${rating}` as FieldRatingValue;

import { type RATING_VALUES } from '@/lib/sabcrm/shared/src/constants/RatingValues';

export type FieldRatingValue = (typeof RATING_VALUES)[number] | null;

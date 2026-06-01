import {
  APP_LOCALES,
  type AppLocale,
} from '@/lib/sabcrm/shared/src/translations/constants/AppLocales';

export const isValidLocale = (value: string | null): value is AppLocale =>
  value !== null && value in APP_LOCALES;

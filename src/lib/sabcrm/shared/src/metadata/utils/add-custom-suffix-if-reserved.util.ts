import { RESERVED_METADATA_NAME_KEYWORDS } from '@/lib/sabcrm/shared/src/metadata/constants/reserved-metadata-name-keywords.constant';

export const addCustomSuffixIfIsReserved = (name: string): string => {
  if (!name) return name;

  return RESERVED_METADATA_NAME_KEYWORDS.includes(name)
    ? `${name}Custom`
    : name;
};

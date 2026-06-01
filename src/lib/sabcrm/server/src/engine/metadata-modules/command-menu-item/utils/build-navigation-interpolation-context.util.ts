// PORT-NOTE: @lingui/core I18n instance removed; i18n parameter replaced with a
// locale string. resolveObjectMetadataStandardOverride is forward-declared as a stub
// until the object-metadata utils module is ported.

export type NavigationInterpolationObjectMetadata = {
  labelPlural: string;
  labelSingular: string;
  description?: string | null;
  icon?: string | null;
  isCustom: boolean;
  standardOverrides?: {
    labelPlural?: Record<string, string> | null;
    labelSingular?: Record<string, string> | null;
    description?: Record<string, string> | null;
    icon?: Record<string, string> | null;
  } | null;
};

// PORT-NOTE: resolveObjectMetadataStandardOverride is stubbed here — it resolves
// translated/overridden strings by locale for standard objects.
function resolveStandardOverride(
  objectMetadata: NavigationInterpolationObjectMetadata,
  field: 'labelPlural' | 'labelSingular' | 'icon' | 'description',
  locale: string | undefined,
): string | undefined {
  const overrides = objectMetadata.standardOverrides;
  if (overrides && locale) {
    const overrideMap = overrides[field];
    if (overrideMap && overrideMap[locale]) {
      return overrideMap[locale];
    }
  }
  return objectMetadata[field] ?? undefined;
}

export const buildNavigationInterpolationContext = ({
  objectMetadata,
  locale,
}: {
  objectMetadata: NavigationInterpolationObjectMetadata;
  locale: string | undefined;
}): Record<string, unknown> => {
  const resolvedLabelPlural = resolveStandardOverride(
    objectMetadata,
    'labelPlural',
    locale,
  );

  const resolvedIcon = resolveStandardOverride(
    objectMetadata,
    'icon',
    locale,
  );

  return {
    navigateToObjectMetadataItem: {
      labelPlural: resolvedLabelPlural,
      icon: resolvedIcon,
    },
  };
};

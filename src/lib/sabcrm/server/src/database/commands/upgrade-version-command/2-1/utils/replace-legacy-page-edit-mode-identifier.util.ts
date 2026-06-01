// PORT-NOTE: Utility — replaces the legacy `isPageInEditMode` variable in a
// conditionalAvailabilityExpression string with `isDashboardPageLayoutInEditMode`.
// The original used conditionalAvailabilityParser from twenty-shared/utils;
// here we do a safe string-level substitution, preserving the same semantics.

const LEGACY_PAGE_EDIT_MODE_IDENTIFIER = "isPageInEditMode";
const DASHBOARD_PAGE_LAYOUT_EDIT_MODE_IDENTIFIER =
  "isDashboardPageLayoutInEditMode";

/**
 * Replaces occurrences of the legacy `isPageInEditMode` variable in a
 * conditional-availability expression with `isDashboardPageLayoutInEditMode`.
 *
 * Returns the original expression unchanged if:
 *  - the expression is null / undefined
 *  - the expression does not reference the legacy identifier
 *  - an unexpected parse error occurs
 */
export const replaceLegacyPageEditModeIdentifier = (
  conditionalAvailabilityExpression: string | null | undefined,
): string | null | undefined => {
  if (
    conditionalAvailabilityExpression === null ||
    conditionalAvailabilityExpression === undefined
  ) {
    return conditionalAvailabilityExpression;
  }

  try {
    if (
      !conditionalAvailabilityExpression.includes(LEGACY_PAGE_EDIT_MODE_IDENTIFIER)
    ) {
      return conditionalAvailabilityExpression;
    }

    // Replace every whole-word occurrence of the legacy identifier so partial
    // matches (e.g. variables that merely contain the substring) are unaffected.
    const replaced = conditionalAvailabilityExpression.replace(
      new RegExp(`\\b${LEGACY_PAGE_EDIT_MODE_IDENTIFIER}\\b`, "g"),
      DASHBOARD_PAGE_LAYOUT_EDIT_MODE_IDENTIFIER,
    );

    return replaced;
  } catch {
    return conditionalAvailabilityExpression;
  }
};

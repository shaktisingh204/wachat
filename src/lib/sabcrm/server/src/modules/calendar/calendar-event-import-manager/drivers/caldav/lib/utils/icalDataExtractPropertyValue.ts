// PORT-NOTE: Ported directly from Twenty. No NestJS dependencies.
// Kept as a pure utility — no `server-only` guard needed.

/**
 * Extracts the string value from an iCal property that may have parameters.
 * Per RFC 5545, properties can have parameters like LANGUAGE=de-DE, which causes
 * node-ical to return an object with `val` and `params` instead of a plain string.
 *
 * RFC 5545 Section 3.1.2 also allows multiple values in a single property.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.2 (Property Parameters)
 * @see https://datatracker.ietf.org/doc/html/rfc5545#section-3.1.2 (Multiple Values)
 */
export const icalDataExtractPropertyValue = (
  property:
    | string
    | { val?: string; params?: Record<string, unknown> }
    | undefined,
  defaultValue = "",
): string => {
  if (property == null) {
    return defaultValue;
  }

  if (typeof property === "string" && property.length > 0) {
    return property;
  }

  if (property != null && typeof property === "object") {
    if (Array.isArray(property)) {
      const values = (property as Array<string | { val?: string }>)
        .map((item) => {
          if (typeof item === "string" && item.length > 0) return item;
          if (
            item != null &&
            typeof item === "object" &&
            "val" in item &&
            item.val != null
          )
            return String(item.val);

          return "";
        })
        .filter(Boolean);

      return values.length > 0 ? values.join(", ") : defaultValue;
    }

    if ("val" in property && property.val != null) {
      return typeof property.val === "string"
        ? property.val
        : String(property.val);
    }
  }

  return defaultValue;
};

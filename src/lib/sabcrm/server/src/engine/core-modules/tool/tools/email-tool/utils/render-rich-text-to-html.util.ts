import "server-only";

// PORT-NOTE: twenty-emails (reactMarkupFromJSON) is a vendored package not
// available in SabNode. The function signature and contract are preserved;
// callers must supply a compatible renderer or stub this for their context.
// The `render` import from @react-email/render is a peer dependency — install
// it only if this utility is actively used.

export type JSONContent = Record<string, unknown>;

// PORT-NOTE: Implementation depends on `twenty-emails` (reactMarkupFromJSON)
// which is vendored in the Twenty monorepo. In SabNode this is a stub; replace
// with a real implementation if rich-text email rendering is required.
export const renderRichTextToHtml = async (
  _jsonContent: JSONContent,
): Promise<string> => {
  // PORT-NOTE: Cannot call reactMarkupFromJSON — twenty-emails not in SabNode.
  // Return empty string as safe fallback; replace when the package is available.
  return "";
};

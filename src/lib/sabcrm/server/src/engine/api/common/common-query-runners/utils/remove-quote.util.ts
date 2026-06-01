import "server-only";

// PORT-NOTE: Ported from Twenty's remove-quote.util.ts. Pure string utility, no dependencies.

const removeQuotes = (string: string): string => {
  return string.replace(/["']/g, '');
};

export const formatColumnNameAsAlias = (
  columnNameWithQuotes: string,
): string => {
  return removeQuotes(columnNameWithQuotes).replace(/\./g, '_');
};

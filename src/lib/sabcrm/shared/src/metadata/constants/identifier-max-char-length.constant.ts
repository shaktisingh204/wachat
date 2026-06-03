// Identifier max char length — aligned with PostgreSQL NAMEDATALEN-1 (63)
// Mongo has no such limit, but we preserve it for cross-layer consistency.
export const IDENTIFIER_MAX_CHAR_LENGTH = 63;

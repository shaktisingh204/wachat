// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: core."file" table — drops FK constraint and "messageId" uuid column.

/**
 * Migration 1759378531410 – RemoveMessageIdFromFileTable
 *
 * Postgres intent:
 *   UP:   ALTER TABLE core.file DROP CONSTRAINT FK_a78a68c3f577a485dd4c741909f;
 *         ALTER TABLE core.file DROP COLUMN messageId;
 *   DOWN: ADD COLUMN messageId uuid; ADD CONSTRAINT FK -> agentChatMessage ON DELETE CASCADE.
 *
 * Mongo equivalent:
 *   - The sabcrm_file collection documents should no longer include a `messageId` field.
 *   - Schema-less Mongo requires no DDL; new documents simply omit the field.
 *   - If existing documents carry `messageId`, a one-off cleanup can be run:
 *       db.sabcrm_file.updateMany({}, { $unset: { messageId: "" } });
 */

export const migrationNote = {
  id: "1759378531410",
  name: "RemoveMessageIdFromFileTable",
  mongoEquivalent:
    "No-op DDL – sabcrm_file documents drop optional messageId field; schema-less Mongo requires no migration",
} as const;

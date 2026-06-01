// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: core."agentChatMessage" table — column rename "content" -> "rawContent" + make nullable.
// In SabNode/Mongo the agentChatMessage collection uses "rawContent" (optional string).
// No DDL to run; document the intent so collection validators / schemas can be updated accordingly.

/**
 * Migration 1757991657472 – RemoveContentFromAgentChatMessage
 *
 * Postgres intent:
 *   UP:   ALTER TABLE core.agentChatMessage RENAME COLUMN content TO rawContent;
 *         ALTER TABLE core.agentChatMessage ALTER COLUMN rawContent DROP NOT NULL;
 *   DOWN: reverse of the above.
 *
 * Mongo equivalent:
 *   - The agentChatMessage document type should use the field name `rawContent` (optional).
 *   - No index creation required; no seed data needed.
 *   - If documents already exist with the old field name `content`, run a one-off update:
 *       db.sabcrm_agentChatMessage.updateMany(
 *         { content: { $exists: true } },
 *         [{ $set: { rawContent: "$content" } }, { $unset: "content" }]
 *       );
 */

export const migrationNote = {
  id: '1757991657472',
  name: 'RemoveContentFromAgentChatMessage',
  mongoEquivalent: 'field-rename: content -> rawContent (now optional)',
} as const;

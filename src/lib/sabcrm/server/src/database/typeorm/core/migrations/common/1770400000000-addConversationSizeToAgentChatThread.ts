// PORT-NOTE: Postgres DDL migration — adds "conversationSize" integer column
// (NOT NULL DEFAULT 0) to "core"."agentChatThread".
// In MongoDB (sabcrm_agentchatthread) this is a new integer field that tracks
// the number of messages in the thread conversation.
//
// Original Twenty migration: AddConversationSizeToAgentChatThread1770400000000
//   UP:   ALTER TABLE "core"."agentChatThread"
//           ADD COLUMN "conversationSize" integer NOT NULL DEFAULT 0
//   DOWN: ALTER TABLE "core"."agentChatThread"
//           DROP COLUMN "conversationSize"
//
// Mongo backfill (optional, run once):
//   db.sabcrm_agentchatthread.updateMany(
//     { conversationSize: { $exists: false } },
//     { $set: { conversationSize: 0 } }
//   )
//
// The TypeScript document type for AgentChatThread should include:
//   conversationSize: number  (default 0)

export const migrationNote = {
  id: '1770400000000',
  name: 'AddConversationSizeToAgentChatThread',
  mongoAction: 'field-add',
  collections: ['sabcrm_agentchatthread'],
  fieldsAdded: [
    { name: 'conversationSize', type: 'number', default: 0 },
  ],
  backfill: `db.sabcrm_agentchatthread.updateMany(
    { conversationSize: { $exists: false } },
    { $set: { conversationSize: 0 } }
  )`,
} as const;

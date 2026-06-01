// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddSystemRoleToAgentMessage1764210000000
//
// This Postgres migration adds 'system' to the "agentMessage_role_enum"
// (PostgreSQL enums cannot have values removed, so the down() is a no-op).
//
// Mongo equivalent: No schema change is required. The sabcrm_agentmessage
// collection stores role as a plain string. Application code should now accept
// 'system' as a valid value in addition to 'user' and 'assistant'.

export const migrationId = '1764210000000-add-system-role-to-agent-message';

/** Updated role union after this migration. */
export type AgentMessageRole = 'user' | 'assistant' | 'system';

// PORT-NOTE: pg-migration->mongo-index/seed
// Original Twenty migration: add-payload-to-command-menu-item
// This migration adds a CHECK constraint to commandMenuItem enforcing engine-key coherence:
//   - TRIGGER_WORKFLOW_VERSION: workflowVersionId NOT NULL, frontComponentId IS NULL, payload IS NULL
//   - FRONT_COMPONENT_RENDERER: frontComponentId NOT NULL, workflowVersionId IS NULL, payload IS NULL
//   - NAVIGATION: payload NOT NULL, workflowVersionId IS NULL, frontComponentId IS NULL
//   - Others: workflowVersionId IS NULL, frontComponentId IS NULL, payload IS NULL
//
// In MongoDB there is no native CHECK constraint. The equivalent is application-layer validation.
// This module documents the constraint and exports the allowed engine component keys
// for use in Zod/validation logic.

import "server-only";

export const ENGINE_COMPONENT_KEYS = {
  TRIGGER_WORKFLOW_VERSION: "TRIGGER_WORKFLOW_VERSION",
  FRONT_COMPONENT_RENDERER: "FRONT_COMPONENT_RENDERER",
  NAVIGATION: "NAVIGATION",
} as const;

export type EngineComponentKey = (typeof ENGINE_COMPONENT_KEYS)[keyof typeof ENGINE_COMPONENT_KEYS] | string;

/**
 * Validates commandMenuItem engine-key coherence (mirrors the Postgres CHECK constraint).
 * Returns true if the document is valid.
 */
export function validateCommandMenuItemEngineKeyCoherence(doc: {
  engineComponentKey: EngineComponentKey;
  workflowVersionId?: string | null;
  frontComponentId?: string | null;
  payload?: unknown;
}): boolean {
  const { engineComponentKey, workflowVersionId, frontComponentId, payload } = doc;

  switch (engineComponentKey) {
    case ENGINE_COMPONENT_KEYS.TRIGGER_WORKFLOW_VERSION:
      return (
        workflowVersionId != null &&
        frontComponentId == null &&
        payload == null
      );
    case ENGINE_COMPONENT_KEYS.FRONT_COMPONENT_RENDERER:
      return (
        frontComponentId != null &&
        workflowVersionId == null &&
        payload == null
      );
    case ENGINE_COMPONENT_KEYS.NAVIGATION:
      return (
        payload != null &&
        workflowVersionId == null &&
        frontComponentId == null
      );
    default:
      return (
        workflowVersionId == null &&
        frontComponentId == null &&
        payload == null
      );
  }
}

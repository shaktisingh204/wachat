// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: core."view" table — adds FK from kanbanAggregateOperationFieldMetadataId -> fieldMetadata(id) ON DELETE CASCADE.
// The FK is added with error swallowing; a follow-up upgrade command handles orphaned references.

/**
 * Migration 1760965667836 – KanbanFieldMetadataIdentifierView
 *
 * Postgres intent:
 *   UP:   ALTER TABLE core.view ADD CONSTRAINT FK_b3cc95732479f7a1337350c398f
 *           FOREIGN KEY (kanbanAggregateOperationFieldMetadataId) REFERENCES core.fieldMetadata(id)
 *           ON DELETE CASCADE (error is swallowed; upgrade command handles orphans).
 *   DOWN: DROP CONSTRAINT.
 *
 * Mongo equivalent:
 *   - The sabcrm_view collection documents store `kanbanAggregateOperationFieldMetadataId` as an optional string ref.
 *   - FK integrity is enforced at the application layer (cascade delete implemented in server actions).
 *   - No index required here; fieldMetadata lookups use the existing (workspaceId, universalIdentifier) index.
 *
 * Upgrade note: run the 1-10-clean-orphaned-kanban-aggregate-operation-field-metadata-id upgrade command to
 * unset kanbanAggregateOperationFieldMetadataId on views that reference non-existent fieldMetadata documents.
 */

export const migrationNote = {
  id: "1760965667836",
  name: "KanbanFieldMetadataIdentifierView",
  mongoEquivalent:
    "No DDL – kanbanAggregateOperationFieldMetadataId FK enforced at application layer; run orphan-cleanup command for existing data",
} as const;

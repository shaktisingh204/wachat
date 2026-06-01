// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: core."view" table — adds FK from calendarFieldMetadataId -> fieldMetadata(id) ON DELETE CASCADE.

/**
 * Migration 1761052489394 – CalendarFieldMetadataRelation
 *
 * Postgres intent:
 *   UP:   ALTER TABLE core.view ADD CONSTRAINT FK_5c0d21d6b8d5544a24ab9787114
 *           FOREIGN KEY (calendarFieldMetadataId) REFERENCES core.fieldMetadata(id)
 *           ON DELETE CASCADE.
 *   DOWN: DROP CONSTRAINT.
 *
 * Mongo equivalent:
 *   - The sabcrm_view collection documents store `calendarFieldMetadataId` as an optional string ref.
 *   - FK integrity + cascade delete is enforced at the application layer in server actions.
 *   - No additional Mongo index is required; fieldMetadata is already indexed.
 */

export const migrationNote = {
  id: "1761052489394",
  name: "CalendarFieldMetadataRelation",
  mongoEquivalent:
    "No DDL – calendarFieldMetadataId FK enforced at application layer with cascade delete logic",
} as const;

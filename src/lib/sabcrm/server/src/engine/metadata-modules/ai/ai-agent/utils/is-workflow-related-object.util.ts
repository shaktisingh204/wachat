// PORT-NOTE: Originally from twenty-server. Ported to SabNode (Next.js + Mongo).
// STANDARD_OBJECTS from twenty-shared/metadata replaced with inline constants
// since the shared package is not available on the Next.js side.
// The function signature accepting { universalIdentifier: string } is used
// (the broader of the two overloads present in the source).

// Universal identifiers for standard workflow-related objects in Twenty CRM.
// These values match STANDARD_OBJECTS.workflow*, workflowRun*, etc. from twenty-shared.
// Update here if the upstream identifiers change.
const WORKFLOW_STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS = [
  "workflow",
  "workflowRun",
  "workflowVersion",
  "workflowAutomatedTrigger",
] as const;

type WorkflowUniversalIdentifier =
  (typeof WORKFLOW_STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS)[number];

/**
 * Returns true when the given object metadata refers to a workflow-related
 * standard object that should be filtered out from agent access.
 */
export const isWorkflowRelatedObject = (objectMetadata: {
  universalIdentifier: string;
}): boolean => {
  return WORKFLOW_STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.includes(
    objectMetadata.universalIdentifier as WorkflowUniversalIdentifier,
  );
};

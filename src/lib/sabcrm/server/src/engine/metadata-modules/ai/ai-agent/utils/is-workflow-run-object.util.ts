// PORT-NOTE: Originally from twenty-server. Ported to SabNode (Next.js + Mongo).
// ObjectMetadataEntity import is replaced with a structural type.
// STANDARD_OBJECTS from twenty-shared/metadata is inlined as string constants.

// Universal identifier for the workflowRun standard object in Twenty CRM.
// This is the concrete "is this specifically a workflow RUN?" check —
// distinct from isWorkflowRelatedObject which covers all workflow objects.
const WORKFLOW_STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS = [
  "workflow",
  "workflowRun",
  "workflowVersion",
  "workflowAutomatedTrigger",
] as const;

type WorkflowUniversalIdentifier =
  (typeof WORKFLOW_STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS)[number];

/**
 * Structural stand-in for ObjectMetadataEntity — only the fields used here.
 */
export type ObjectMetadataLike = {
  universalIdentifier: string;
};

/**
 * Returns true when the given object metadata refers to the workflowRun
 * standard object (or any other workflow-related standard object).
 *
 * PORT-NOTE: The original source imported ObjectMetadataEntity from TypeORM.
 * We use the structural ObjectMetadataLike type here instead.
 */
export const isWorkflowRelatedObject = (
  objectMetadata: ObjectMetadataLike,
): boolean => {
  return WORKFLOW_STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.includes(
    objectMetadata.universalIdentifier as WorkflowUniversalIdentifier,
  );
};

// PORT: dto
// Original: NestJS @ObjectType(); triggerDiff / stepsDiff typed as Difference[] from microdiff

// Difference is a tagged union from the microdiff package describing a JSON diff entry.
export type MicrodiffDifference =
  | { type: 'CREATE'; path: (string | number)[]; value: unknown }
  | { type: 'REMOVE'; path: (string | number)[]; oldValue: unknown }
  | { type: 'CHANGE'; path: (string | number)[]; value: unknown; oldValue: unknown };

export type WorkflowVersionStepChangesDTO = {
  triggerDiff?: MicrodiffDifference[];
  stepsDiff?: MicrodiffDifference[];
};

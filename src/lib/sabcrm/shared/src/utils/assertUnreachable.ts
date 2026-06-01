/**
 * Utility for exhaustiveness checking in switch/if-else chains.
 * TypeScript will error at compile time if this is ever reachable.
 */
export const assertUnreachable = (_x: never, errorMessage?: string): never => {
  throw new Error(errorMessage ?? "Didn't expect to get here.");
};

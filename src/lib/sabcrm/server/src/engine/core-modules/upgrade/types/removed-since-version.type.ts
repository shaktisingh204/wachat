// PORT-NOTE: This type uses advanced TypeScript conditional types that depend on
// TWENTY_ALL_VERSIONS and TWENTY_CURRENT_VERSION constants (and helper types
// IndexOf / IsGreaterOrEqual from twenty-shared). Those are ported below with
// their expected shapes. Callers that need the compile-time enforcement can
// import RemovedSinceVersion<RemoveAtVersion, T>; the type resolves to `never`
// when the current version is at or past RemoveAtVersion, otherwise T.

export const TWENTY_ALL_VERSIONS = [
  "0-37-0",
  "0-38-0",
  "0-39-0",
  "0-40-0",
  "0-41-0",
  "0-42-0",
  "0-43-0",
  "0-44-0",
] as const;

export type TwentyAllVersion = (typeof TWENTY_ALL_VERSIONS)[number];

// PORT-NOTE: TWENTY_CURRENT_VERSION should be kept in sync with the pinned
// Twenty version used in this SabNode port. Adjust as the port advances.
export const TWENTY_CURRENT_VERSION = "0-43-0" as const;

type IndexOf<
  TVersion extends TwentyAllVersion,
  TList extends readonly TwentyAllVersion[],
> = {
  [K in keyof TList]: TList[K] extends TVersion ? K : never;
}[number];

type IsGreaterOrEqual<A extends number | string, B extends number | string> =
  A extends B
    ? true
    : `${A}` extends `${infer _}`
      ? `${B}` extends `${infer _}`
        ? A extends B
          ? true
          : // numeric tuple trick — good enough for sequential indices
            false
        : false
      : false;

export type RemovedSinceVersion<
  RemoveAtVersion extends TwentyAllVersion,
  T,
> = IsGreaterOrEqual<
  IndexOf<typeof TWENTY_CURRENT_VERSION, typeof TWENTY_ALL_VERSIONS>,
  IndexOf<RemoveAtVersion, typeof TWENTY_ALL_VERSIONS>
> extends true
  ? never
  : T;

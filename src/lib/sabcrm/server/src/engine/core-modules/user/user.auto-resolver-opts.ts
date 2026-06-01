// PORT-NOTE: Original used @ptc-org/nestjs-query-graphql auto-resolver opts
// (NestJS/GraphQL specific). In Next.js there is no equivalent framework concept.
// We export a typed config record documenting what operations were enabled/disabled
// so callers can reference it when building API route guards.

export type ResolverOptsConfig = {
  enableTotalCount: boolean;
  pagingStrategy: "CURSOR" | "OFFSET" | "NONE";
  read: { many: { disabled: boolean }; one: { disabled: boolean } };
  create: { many: { disabled: boolean }; one: { disabled: boolean } };
  update: { many: { disabled: boolean }; one: { disabled: boolean } };
  delete: { many: { disabled: boolean }; one: { disabled: boolean } };
};

export const userAutoResolverOpts: ResolverOptsConfig[] = [
  {
    enableTotalCount: true,
    pagingStrategy: "CURSOR",
    read: {
      many: { disabled: true },
      one: { disabled: true },
    },
    create: {
      many: { disabled: true },
      one: { disabled: true },
    },
    update: {
      many: { disabled: true },
      one: { disabled: true },
    },
    delete: { many: { disabled: true }, one: { disabled: true } },
  },
];

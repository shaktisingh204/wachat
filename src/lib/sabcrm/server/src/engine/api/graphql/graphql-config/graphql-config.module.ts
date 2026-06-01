// PORT-NOTE: NestJS module-wiring has no direct Next.js equivalent.
// This re-exports the logical pieces that GraphQLConfigModule wired together.
// DirectExecutionModule and CoreEngineModule are referenced symbolically.

export const GraphQLConfigModuleImports = ['CoreEngineModule', 'DirectExecutionModule'] as const;
export const GraphQLConfigModuleExports = ['CoreEngineModule', 'DirectExecutionModule'] as const;

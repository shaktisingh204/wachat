// PORT-NOTE: NestJS injection token → plain Symbol export.
// In Next.js there is no DI container; this symbol is used as a registry key
// wherever the original code referenced DASHBOARD_TOOL_SERVICE_TOKEN.
export const DASHBOARD_TOOL_SERVICE_TOKEN = Symbol('DASHBOARD_TOOL_SERVICE');

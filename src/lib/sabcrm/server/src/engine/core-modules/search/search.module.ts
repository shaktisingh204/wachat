// module-wiring: SearchModule wires SearchResolver + SearchService.
// NestJS modules have no Next.js equivalent; this registry re-exports the ported pieces.

export { searchAction } from "@/lib/sabcrm/server/src/engine/core-modules/search/search.resolver";
export { SearchService } from "@/lib/sabcrm/server/src/engine/core-modules/search/services/search.service";

// PORT-NOTE: module-wiring — NestJS modules have no Next.js equivalent.
// This registry re-exports the ported services so callers can import from one place.

export {
  BlocklistValidationService,
  type BlocklistItem,
} from "@/lib/sabcrm/server/src/modules/blocklist/blocklist-validation-manager/services/blocklist-validation.service";

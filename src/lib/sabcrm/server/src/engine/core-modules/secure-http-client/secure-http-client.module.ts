// PORT-NOTE: NestJS module wiring has no Next.js equivalent.
// Re-exports the ported service so consuming code can import from this path.

export { SecureHttpClientService } from "./secure-http-client.service";

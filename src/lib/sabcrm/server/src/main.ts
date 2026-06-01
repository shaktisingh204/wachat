// PORT-NOTE: Adapted from twenty-server/src/main.ts
// The NestJS bootstrap in the original file has no direct equivalent in
// Next.js App Router — Next.js manages its own server lifecycle. This module
// documents the initialization logic that would need to be replicated in a
// standalone Node.js / Express layer if one is introduced alongside SabNode
// (e.g. for running the worker process separately).
//
// Key points preserved from the original:
//   - SSL termination support via SSL_KEY_PATH / SSL_CERT_PATH env vars
//   - Trust-proxy configuration (TRUST_PROXY env var, int or bool)
//   - Session storage (session-storage adapter pattern)
//   - Body-size limit (settings.storage.maxFileSize)
//   - GraphQL file upload middleware on /graphql and /metadata
//   - Server port driven by NODE_PORT env var

// PORT-NOTE: No runnable bootstrap exists here. Import `./instrument` from
// your worker entry-point to register Sentry / OTel before any other code.

export const SABCRM_SERVER_PORT =
  Number(process.env.NODE_PORT) || 3000;

export const SABCRM_MAX_FILE_SIZE = process.env.SABCRM_MAX_FILE_SIZE ?? "20mb";

// If a standalone Express / worker process is needed, create a bootstrap
// function that mirrors the NestJS setup above, using:
//   - express-session for session middleware
//   - graphql-upload for multipart uploads
//   - proper trust-proxy setting

// Nothing to execute — Next.js owns the HTTP server in SabNode.

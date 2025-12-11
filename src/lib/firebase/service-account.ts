// This file is intended for server-side use only.
// Do not import this file in any client-side code.
export const serviceAccount = {
  "type": "service_account",
  "project_id": "your-project-id", // <-- REPLACE with your project ID
  "private_key_id": "your-private-key-id", // <-- REPLACE
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n", // <-- REPLACE
  "client_email": "your-client-email", // <-- REPLACE
  "client_id": "your-client-id", // <-- REPLACE
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "your-client-x509-cert-url" // <-- REPLACE
};

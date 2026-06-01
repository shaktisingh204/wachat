import * as crypto from "crypto";

// Returns true if the string is a valid X.509 DER certificate (PEM-encoded or raw base64).
export const isX509Certificate = (value: unknown): boolean => {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const cleanCert = value.replace(
      /-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n|\r/g,
      "",
    );

    const der = Buffer.from(cleanCert, "base64");

    const cert = new crypto.X509Certificate(der);

    return cert instanceof crypto.X509Certificate;
  } catch {
    return false;
  }
};

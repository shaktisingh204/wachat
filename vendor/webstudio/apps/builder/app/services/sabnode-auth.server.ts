import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * SabNode unified auth.
 *
 * The builder runs inside the SabNode Next.js app (same origin, same
 * process), so the SabNode session cookie — an HS256 JWT named `session`
 * signed with JWT_SECRET — is present on every dashboard request. When no
 * native builder session exists we verify that JWT and treat its email as
 * the authenticated identity, auto-provisioning the builder user. There is
 * deliberately no separate SabSites login.
 */

const base64UrlDecode = (input: string): Buffer =>
  Buffer.from(input, "base64url");

const parseCookies = (header: string | null): Map<string, string> => {
  const cookies = new Map<string, string>();
  if (header === null) {
    return cookies;
  }
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) {
      continue;
    }
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name !== "" && cookies.has(name) === false) {
      cookies.set(name, decodeURIComponent(value));
    }
  }
  return cookies;
};

export type SabNodeIdentity = {
  email: string;
  name: string;
};

export const verifySabNodeSession = (
  request: Request
): SabNodeIdentity | undefined => {
  const secret = process.env.JWT_SECRET;
  if (secret === undefined || secret === "") {
    return;
  }

  const token = parseCookies(request.headers.get("Cookie")).get("session");
  if (token === undefined) {
    return;
  }

  const segments = token.split(".");
  if (segments.length !== 3) {
    return;
  }
  const [headerSegment, payloadSegment, signatureSegment] = segments;

  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecode(headerSegment).toString("utf8"));
    payload = JSON.parse(base64UrlDecode(payloadSegment).toString("utf8"));
  } catch {
    return;
  }

  if (header.alg !== "HS256") {
    return;
  }

  const expected = createHmac("sha256", secret)
    .update(`${headerSegment}.${payloadSegment}`)
    .digest();
  const actual = base64UrlDecode(signatureSegment);
  if (
    expected.length !== actual.length ||
    timingSafeEqual(expected, actual) === false
  ) {
    return;
  }

  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    return;
  }
  if (typeof payload.email !== "string" || payload.email === "") {
    return;
  }

  return {
    email: payload.email,
    name:
      typeof payload.name === "string" && payload.name !== ""
        ? payload.name
        : payload.email,
  };
};

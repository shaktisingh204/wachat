import { redirect } from "next/navigation";

/**
 * /sabsms/rate-limits was folded into /sabsms/api-keys (V2.13) — rate
 * limits are configured per API key on that surface.
 */
export default function SabsmsRateLimitsRedirect() {
  redirect("/sabsms/api-keys");
}

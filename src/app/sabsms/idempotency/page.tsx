import { redirect } from "next/navigation";

/**
 * /sabsms/idempotency was folded into /sabsms/api-keys (V2.13) —
 * idempotency is an API behaviour (Idempotency-Key header, 24h replay)
 * documented on the developer surfaces, not a standalone console.
 */
export default function SabsmsIdempotencyRedirect() {
  redirect("/sabsms/api-keys");
}

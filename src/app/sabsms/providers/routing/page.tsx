import { redirect } from "next/navigation";

/**
 * /sabsms/providers/routing was a hardcoded, client-only mock of the
 * routing surface (fabricated "Twilio Global" providers, fake latency /
 * success-rate / cost figures, drag-to-reorder that persisted nothing).
 * The real, engine-backed routing UI lives at /sabsms/routing
 * (`sabsms_routing_policies` + the engine's selector). Forward there so
 * there is exactly one routing surface.
 */
export default function SabsmsProvidersRoutingRedirect() {
  redirect("/sabsms/routing");
}

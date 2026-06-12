import { redirect } from "next/navigation";

/**
 * /sabsms/pool was folded into /sabsms/numbers (V2.5) — sender-pool
 * management lives on the numbers surface now.
 */
export default function SabsmsPoolRedirect() {
  redirect("/sabsms/numbers");
}

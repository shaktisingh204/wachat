import { redirect } from "next/navigation";

/**
 * /sabsms/numbers/new used to host a Phase-1 MOCK provisioning wizard
 * (fabricated inventory + a direct `sabsms_numbers` insert that never
 * actually purchased anything at the provider). The real engine-backed
 * buy flow now lives at /sabsms/numbers/buy
 * (`POST /v1/numbers/search` + `POST /v1/numbers/provision`), so this
 * route just forwards there — same pattern as `numbers/pool/page.tsx`.
 */
export default function SabsmsProvisionNumberRedirect() {
  redirect("/sabsms/numbers/buy");
}

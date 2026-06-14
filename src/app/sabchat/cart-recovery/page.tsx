import {
  listCartRules,
  listAbandonedCarts,
  listCartTriggers,
} from "@/app/actions/sabchat-cart-recovery.actions";

import { CartRecoveryClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabchatCartRecoveryPage() {
  const [rules, carts, triggers] = await Promise.all([
    listCartRules(),
    listAbandonedCarts(),
    listCartTriggers(),
  ]);

  return (
    <CartRecoveryClient initialRules={rules} initialCarts={carts} initialTriggers={triggers} />
  );
}

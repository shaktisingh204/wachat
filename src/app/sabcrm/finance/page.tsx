/**
 * /sabcrm/finance — suite index. Invoices is the first (and currently
 * only) Finance surface, so the index forwards straight to it.
 */

import { redirect } from 'next/navigation';

export default function SabcrmFinanceIndexPage(): never {
  redirect('/sabcrm/finance/invoices');
}

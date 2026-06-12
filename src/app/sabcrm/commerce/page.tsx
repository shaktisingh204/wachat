/**
 * SabCRM Commerce — suite index (`/sabcrm/commerce`).
 *
 * Orders is the suite's primary surface; the index forwards there so
 * deep links and the sidebar's section root land somewhere useful.
 */

import { redirect } from 'next/navigation';

export default function SabcrmCommerceIndexPage(): never {
  redirect('/sabcrm/commerce/orders');
}

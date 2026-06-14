import { listReviews, getReviewPickerOptions } from "@/app/actions/sabhrm/reviews.actions";

import { ReviewsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SabHrmReviewsPage() {
  const [list, opts] = await Promise.all([
    listReviews({ page: 1, pageSize: 25 }),
    getReviewPickerOptions(),
  ]);

  return (
    <ReviewsClient
      initial={list.ok ? list.data : { rows: [], total: 0, page: 1, pageSize: 25, hasMore: false }}
      options={opts.ok ? opts.data : { employees: [] }}
      loadError={list.ok ? null : list.error}
    />
  );
}

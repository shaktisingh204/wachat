'use client';

/**
 * SabCRM record DETAIL route (`/sabcrm/[objectSlug]/[recordId]`).
 *
 * The legacy Twenty-faithful detail surface (`record-detail-tw`) was retired in
 * the P9 twenty-kit attrition. The 20ui {@link RecordDetailSurface} composite is
 * now the only detail experience — the `NEXT_PUBLIC_SABCRM_RECORD_SURFACE` flag
 * and its Twenty fallback are gone.
 */
import { RecordDetailSurface } from './record-detail-surface';

export default function SabcrmRecordDetailPage() {
  return <RecordDetailSurface />;
}

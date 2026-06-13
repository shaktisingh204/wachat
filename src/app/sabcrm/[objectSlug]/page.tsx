'use client';

/**
 * SabCRM object LIST route (`/sabcrm/[objectSlug]`).
 *
 * The legacy Twenty-styled list surface was retired in the P9 twenty-kit
 * attrition. The 20ui {@link RecordSurface} composite is now the one and only
 * list experience for every object — the `NEXT_PUBLIC_SABCRM_RECORD_SURFACE`
 * flag and its Twenty fallback are gone.
 */
import { RecordSurface } from './record-surface';

export default function SabcrmObjectIndexPage() {
  return <RecordSurface />;
}

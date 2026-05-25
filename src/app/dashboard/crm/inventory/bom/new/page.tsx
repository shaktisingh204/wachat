/**
 * /dashboard/crm/inventory/bom/new — thin wrapper around <BomForm />.
 *
 * `?finishedGoodId=` is read inside the form to pre-select the picker.
 */

import { Suspense } from 'react';
import { BomForm } from '../_components/bom-form';
import Loading from './loading';

export const dynamic = 'force-dynamic';

export default function NewBomPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BomForm />
    </Suspense>
  );
}

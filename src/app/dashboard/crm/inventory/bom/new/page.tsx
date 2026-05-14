/**
 * /dashboard/crm/inventory/bom/new — thin wrapper around <BomForm />.
 *
 * `?finishedGoodId=` is read inside the form to pre-select the picker.
 */

import { BomForm } from '../_components/bom-form';

export const dynamic = 'force-dynamic';

export default function NewBomPage() {
  return <BomForm />;
}

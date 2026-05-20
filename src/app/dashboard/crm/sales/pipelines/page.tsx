import { permanentRedirect } from 'next/navigation';

export default function PipelinesPage() {
  permanentRedirect('/dashboard/crm/sales-crm/pipelines');
}

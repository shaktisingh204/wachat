import { permanentRedirect } from 'next/navigation';

export default function LegacyHrRedirect() {
  permanentRedirect('/dashboard/hrm/hr/training');
}

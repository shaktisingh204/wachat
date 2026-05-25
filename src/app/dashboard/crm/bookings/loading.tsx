import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function BookingsLoading() {
  return <EntityListShell loading={true} title="Bookings" subtitle="Reserve resources, rooms, or staff slots for your customers." />;
}

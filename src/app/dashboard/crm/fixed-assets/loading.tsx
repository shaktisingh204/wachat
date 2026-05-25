import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function FixedAssetsLoading() {
  return <EntityListShell loading={true} title="Fixed Assets" subtitle="Track durable company property — laptops, vehicles, machinery — with depreciation and custody." />;
}

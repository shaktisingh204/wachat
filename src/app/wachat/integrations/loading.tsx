import { WaPage } from '@/components/wachat-ui';

export default function IntegrationsLoading() {
  return (
    <WaPage>
      <div className="mb-8">
        <div className="h-3 w-32 rounded-full bg-zinc-100" />
        <div className="mt-3 h-9 w-64 rounded-lg bg-zinc-100" />
        <div className="mt-2 h-3 w-96 rounded-full bg-zinc-100" />
      </div>
      <div className="mb-6 h-10 w-80 rounded-full bg-zinc-100" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-44 rounded-2xl border border-zinc-200 bg-white" />
        ))}
      </div>
    </WaPage>
  );
}

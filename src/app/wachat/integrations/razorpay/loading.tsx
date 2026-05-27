import { WaPage } from '@/components/wachat-ui';

export default function RazorpayLoading() {
  return (
    <WaPage>
      <div className="mb-8">
        <div className="h-3 w-40 rounded-full bg-zinc-100" />
        <div className="mt-3 h-9 w-48 rounded-lg bg-zinc-100" />
        <div className="mt-2 h-3 w-80 rounded-full bg-zinc-100" />
      </div>
      <div className="space-y-4">
        <div className="h-72 rounded-2xl border border-zinc-200 bg-white" />
        <div className="h-44 rounded-2xl border border-zinc-200 bg-white" />
      </div>
    </WaPage>
  );
}

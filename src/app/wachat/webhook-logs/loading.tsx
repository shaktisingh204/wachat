import { WaPage } from '@/components/wachat-ui';

export default function WebhookLogsLoading() {
  return (
    <WaPage>
      <div className="mb-8">
        <div className="h-3 w-32 rounded-full bg-zinc-100" />
        <div className="mt-3 h-9 w-64 rounded-lg bg-zinc-100" />
        <div className="mt-2 h-3 w-96 rounded-full bg-zinc-100" />
      </div>
      <div className="h-[480px] rounded-2xl border border-zinc-200 bg-white" />
    </WaPage>
  );
}

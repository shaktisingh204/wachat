import { WaPage } from '@/components/wachat-ui';

export default function ConversationSearchLoading() {
  return (
    <WaPage>
      <div className="mb-8 flex flex-col gap-3">
        <div className="h-3 w-24 rounded-full bg-zinc-100" />
        <div className="h-9 w-56 rounded-lg bg-zinc-100" />
        <div className="h-3 w-80 rounded-full bg-zinc-100" />
      </div>
      <div className="mb-6 h-12 max-w-2xl rounded-full bg-zinc-100" />
      <ul className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="h-20 rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="h-3 w-32 rounded-full bg-zinc-100" />
            <div className="mt-3 h-3 w-full max-w-md rounded-full bg-zinc-100" />
          </li>
        ))}
      </ul>
    </WaPage>
  );
}

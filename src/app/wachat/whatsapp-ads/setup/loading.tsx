import { WaPage } from '@/components/wachat-ui';

// This route permanently redirects; the loading state should be a no-op skeleton.
export default function Loading() {
  return (
    <WaPage>
      <div className="h-12 w-72 animate-pulse rounded-lg bg-zinc-100" />
    </WaPage>
  );
}

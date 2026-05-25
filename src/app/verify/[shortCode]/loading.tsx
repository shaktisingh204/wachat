import { Card } from '@/components/zoruui';

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 animate-pulse" />
          <div className="text-center w-full flex flex-col items-center gap-2">
            <div className="h-5 w-40 bg-zinc-800 rounded animate-pulse" />
            <div className="h-4 w-32 bg-zinc-800/50 rounded animate-pulse" />
          </div>
        </div>
        <div className="mt-6 space-y-4 w-full">
          <div className="space-y-1.5">
            <div className="h-4 w-16 bg-zinc-800 rounded animate-pulse" />
            <div className="h-10 w-full bg-zinc-800 rounded animate-pulse" />
          </div>
          <div className="h-10 w-full bg-zinc-800 rounded animate-pulse mt-4" />
        </div>
      </Card>
    </div>
  );
}

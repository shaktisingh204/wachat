import { WaPage } from '@/components/wachat-ui';

/**
 * Skeleton mirrors the /wachat home shape — header strip + recent
 * tiles + projects grid — so the layout doesn't shift in.
 */
export default function WachatLoading() {
    return (
        <WaPage>
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="h-3 w-20 rounded-full bg-zinc-100" />
                    <div className="mt-3 h-9 w-72 rounded-lg bg-zinc-100" />
                    <div className="mt-2 h-3 w-80 rounded-full bg-zinc-100" />
                </div>
                <div className="flex gap-2">
                    <div className="h-9 w-28 rounded-full bg-zinc-100" />
                    <div className="h-9 w-32 rounded-full bg-zinc-100" />
                </div>
            </div>

            <section aria-hidden className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-5">
                        <div className="h-3 w-16 rounded-full bg-zinc-100" />
                        <div className="mt-3 h-8 w-24 rounded-lg bg-zinc-100" />
                        <div className="mt-3 h-2 w-full rounded-full bg-zinc-100" />
                    </div>
                ))}
            </section>

            <section aria-hidden className="mt-10">
                <div className="mb-4 h-3 w-32 rounded-full bg-zinc-100" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-[164px] rounded-2xl border border-zinc-200 bg-white p-5">
                            <div className="h-10 w-10 rounded-xl bg-zinc-100" />
                            <div className="mt-5 h-4 w-32 rounded-full bg-zinc-100" />
                            <div className="mt-2 h-3 w-44 rounded-full bg-zinc-100" />
                            <div className="mt-6 flex items-center justify-between">
                                <div className="h-5 w-24 rounded-full bg-zinc-100" />
                                <div className="h-3 w-10 rounded-full bg-zinc-100" />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </WaPage>
    );
}

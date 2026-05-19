export default async function BioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-20 w-20 rounded-full bg-zinc-800" />
        <div>
          <h1 className="text-xl font-semibold text-white">This page is coming soon</h1>
          <p className="mt-1.5 text-sm text-zinc-500">@{slug}</p>
        </div>
      </div>
      <div className="absolute bottom-8 text-center">
        <a
          href="/"
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Powered by SabNode
        </a>
      </div>
    </div>
  );
}

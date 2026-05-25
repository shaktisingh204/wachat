import Link from 'next/link';

export function Sidebar() {
  return (
    <aside className="w-full md:w-64 border-r border-white/20 p-6 flex flex-col gap-4 bg-black">
      <Link href="/" className="hover:underline text-sm uppercase tracking-widest text-white/70">
        &larr; Back to Home
      </Link>
      <div className="mt-8">
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/50 mb-4">Endpoints</h3>
        <ul className="space-y-2 text-sm">
          <li className="font-bold border-l-2 border-white pl-3 text-white">POST /enterprise/inquire</li>
          <li className="text-white/50 pl-3 hover:text-white transition-colors cursor-pointer">GET /enterprise/sla</li>
          <li className="text-white/50 pl-3 hover:text-white transition-colors cursor-pointer">GET /enterprise/soc2</li>
          <li className="text-white/50 pl-3 hover:text-white transition-colors cursor-pointer">GET /enterprise/vpc</li>
        </ul>
      </div>
    </aside>
  );
}

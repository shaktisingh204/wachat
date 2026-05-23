import Link from 'next/link';
import { ApplyForm } from './apply-form';

// Developer-First OpenAPI Layout Style
// Zero Color (Strict Monochrome)

const JOBS = [
  {
    id: "REQ-2026-001",
    method: "POST",
    path: "/careers/engineering/frontend",
    title: "Frontend Engineer (Zoru UI)",
    description: "Implement strictly monochrome aesthetics and cutting edge interfaces.",
    requirements: ["React", "TypeScript", "Tailwind CSS", "Attention to Detail"],
    status: "OPEN"
  },
  {
    id: "REQ-2026-002",
    method: "POST",
    path: "/careers/engineering/backend",
    title: "Backend Engineer (Go/Node)",
    description: "Design and implement scalable APIs and microservices.",
    requirements: ["Node.js", "Go", "PostgreSQL", "Redis"],
    status: "OPEN"
  }
];

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-black text-white font-mono antialiased selection:bg-white selection:text-black">
      {/* Header */}
      <header className="border-b border-white p-4 flex justify-between items-center sticky top-0 bg-black z-10">
        <div>
          <h1 className="text-xl font-bold tracking-tight">SabNode Careers</h1>
          <p className="text-sm opacity-70">API Version: 1.0.0</p>
        </div>
        <Link href="/" className="hover:bg-white hover:text-black border border-white px-3 py-1 transition-colors text-sm">
          [ GET / ] Return Home
        </Link>
      </header>

      {/* Main Content */}
      <div className="flex flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full md:w-64 border-r border-white min-h-[calc(100vh-73px)] p-4 hidden md:block">
          <h2 className="text-sm font-bold mb-4 uppercase tracking-widest border-b border-white pb-2">Endpoints</h2>
          <ul className="space-y-2 text-sm">
            {JOBS.map((job) => (
              <li key={job.id}>
                <a href={`#${job.id}`} className="hover:underline flex items-center gap-2">
                  <span className="text-[10px] border border-white px-1">POST</span>
                  <span className="truncate">{job.path.split('/').pop()}</span>
                </a>
              </li>
            ))}
          </ul>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-4xl">
            <div className="mb-12 border border-white p-6">
              <h2 className="text-2xl font-bold mb-2">Introduction</h2>
              <p className="text-sm opacity-80 mb-4 leading-relaxed">
                Welcome to the SabNode Careers API. This specification defines the available endpoints
                (open positions) within our organization. We are looking for high-performance nodes to
                join our cluster.
              </p>
              <pre className="bg-white text-black p-4 text-xs overflow-x-auto">
{`{
  "company": "SabNode",
  "culture": "Developer-First",
  "aesthetic": "Strict Monochrome",
  "contact": "careers@sabnode.in"
}`}
              </pre>
            </div>

            <div className="space-y-12">
              <h2 className="text-xl font-bold uppercase tracking-widest border-b border-white pb-2 mb-6">Available Positions</h2>
              {JOBS.map((job) => (
                <div key={job.id} id={job.id} className="border border-white p-0 scroll-mt-24">
                  {/* Endpoint Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center border-b border-white bg-white text-black p-3 gap-4">
                    <div className="flex items-center gap-3">
                      <span className="font-bold border border-black px-2 py-1 text-sm bg-black text-white">{job.method}</span>
                      <span className="font-bold text-sm sm:text-base break-all">{job.path}</span>
                    </div>
                    <div className="sm:ml-auto">
                      <span className="text-xs border border-black px-2 py-1 uppercase font-bold">{job.status}</span>
                    </div>
                  </div>
                  
                  {/* Endpoint Details */}
                  <div className="p-4 md:p-6 space-y-6">
                    <div>
                      <h3 className="text-sm font-bold uppercase border-b border-dashed border-white/50 pb-1 mb-2">Summary</h3>
                      <p className="text-sm">{job.title}</p>
                      <p className="text-sm opacity-70 mt-1">{job.description}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold uppercase border-b border-dashed border-white/50 pb-1 mb-2">Requirements schema</h3>
                      <div className="bg-white/5 border border-white/20 p-4">
                        <pre className="text-xs whitespace-pre-wrap">
{`type Requirements = {
  skills: Array<string>;
};

const required: Requirements = {
  skills: [
${job.requirements.map(req => `    "${req}"`).join(',\n')}
  ]
};`}
                        </pre>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold uppercase border-b border-dashed border-white/50 pb-1 mb-2">Responses</h3>
                      <div className="text-sm flex flex-col gap-2">
                        <div className="flex gap-4 items-start">
                          <span className="font-bold min-w-[3rem]">200</span>
                          <span><span className="uppercase text-xs border border-white px-1">Success</span> Application received. Await callback.</span>
                        </div>
                        <div className="flex gap-4 items-start">
                          <span className="font-bold min-w-[3rem]">400</span>
                          <span><span className="uppercase text-xs border border-white px-1">Bad Request</span> Missing required parameters in application payload.</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-white">
                      <ApplyForm jobId={job.id} jobTitle={job.title} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

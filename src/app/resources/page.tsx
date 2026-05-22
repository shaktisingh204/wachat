import type { Metadata } from 'next';
import Link from 'next/link';
import { 
  Terminal, 
  Code2, 
  BookOpen, 
  FileJson, 
  ShieldCheck, 
  Search, 
  ChevronRight, 
  Menu,
  Copy,
  CheckCircle2,
  Lock
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'API Resources | SabNode',
  description: 'Developer-first OpenAPI documentation for SabNode.',
};

export default function ResourcesPage() {
  return (
    <div className="flex h-screen w-full bg-white text-black font-mono overflow-hidden">
      {/* Left Sidebar - Navigation */}
      <aside className="w-72 flex-shrink-0 border-r border-black overflow-y-auto hidden md:block bg-zinc-50">
        <div className="p-4 border-b border-black flex items-center gap-2 sticky top-0 bg-white z-10">
          <Terminal className="w-5 h-5" />
          <span className="font-bold uppercase tracking-tight">SabNode API</span>
        </div>
        
        <div className="p-4">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search resources..." 
              className="w-full border border-black px-4 py-2 pl-9 text-sm focus:outline-none focus:ring-1 focus:ring-black rounded-none bg-white"
            />
          </div>

          <nav className="space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3 px-2">Overview</h3>
              <ul className="space-y-1">
                <li><Link href="#" className="flex items-center justify-between px-2 py-1.5 bg-black text-white text-sm"><span className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /> Introduction</span></Link></li>
                <li><Link href="#" className="flex items-center justify-between px-2 py-1.5 hover:bg-zinc-200 text-sm"><span className="flex items-center gap-2"><Lock className="w-3.5 h-3.5" /> Authentication</span></Link></li>
                <li><Link href="#" className="flex items-center justify-between px-2 py-1.5 hover:bg-zinc-200 text-sm"><span className="flex items-center gap-2"><FileJson className="w-3.5 h-3.5" /> Pagination</span></Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3 px-2">Resources</h3>
              <ul className="space-y-1">
                <li>
                  <Link href="#" className="flex items-center justify-between px-2 py-1.5 hover:bg-zinc-200 text-sm font-medium">
                    Users
                    <ChevronRight className="w-3 h-3 text-zinc-400" />
                  </Link>
                  <ul className="pl-4 mt-1 border-l border-zinc-300 ml-2 space-y-1">
                    <li><Link href="#" className="block px-2 py-1 text-xs text-zinc-600 hover:text-black font-bold border-l-2 -ml-[1px] border-black pl-3">List all users</Link></li>
                    <li><Link href="#" className="block px-2 py-1 text-xs text-zinc-600 hover:text-black">Retrieve a user</Link></li>
                    <li><Link href="#" className="block px-2 py-1 text-xs text-zinc-600 hover:text-black">Create a user</Link></li>
                  </ul>
                </li>
                <li>
                  <Link href="#" className="flex items-center justify-between px-2 py-1.5 hover:bg-zinc-200 text-sm font-medium mt-2">
                    Workspaces
                    <ChevronRight className="w-3 h-3 text-zinc-400" />
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden border-b border-black p-4 flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            <span className="font-bold uppercase tracking-tight">API Docs</span>
          </div>
          <button className="p-1 border border-black"><Menu className="w-5 h-5" /></button>
        </header>

        {/* Middle Column - Documentation */}
        <div className="flex-1 overflow-y-auto border-r border-black p-6 lg:p-10 lg:w-1/2">
          <div className="max-w-2xl mx-auto">
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-black text-white px-2 py-0.5 text-xs font-bold uppercase">GET</span>
                <span className="text-zinc-500 text-sm font-mono">/v1/users</span>
              </div>
              <h1 className="text-3xl font-black uppercase tracking-tighter mb-4">List all users</h1>
              <p className="text-zinc-600 leading-relaxed mb-6 text-sm">
                Returns a paginated list of user objects associated with the authenticated workspace. 
                The users are returned sorted by creation date, with the most recently created users appearing first.
              </p>
              
              <div className="border border-black p-4 bg-zinc-50 flex items-start gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-8">
                <ShieldCheck className="w-5 h-5 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm uppercase">Authorization</h4>
                  <p className="text-sm text-zinc-600 mt-1">Requires a valid Bearer token in the <code className="bg-zinc-200 px-1 py-0.5 text-black border border-zinc-300">Authorization</code> header.</p>
                </div>
              </div>
            </div>

            <div className="mb-10">
              <h2 className="text-lg font-bold uppercase border-b-2 border-black pb-2 mb-4">Query Parameters</h2>
              
              <div className="space-y-4">
                <div className="border border-zinc-200 p-4 relative group hover:border-black transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm uppercase tracking-wide">limit</span>
                      <span className="text-xs text-zinc-500 italic">integer</span>
                    </div>
                    <span className="text-xs border border-zinc-300 px-1.5 py-0.5 text-zinc-500 bg-zinc-50">Optional</span>
                  </div>
                  <p className="text-sm text-zinc-600 mb-2">A limit on the number of objects to be returned. Limit can range between 1 and 100.</p>
                  <div className="text-xs font-mono text-zinc-500 flex items-center gap-2">
                    <span className="uppercase text-[10px] tracking-wider text-black font-bold">Default:</span> 10
                  </div>
                </div>

                <div className="border border-zinc-200 p-4 relative group hover:border-black transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm uppercase tracking-wide">starting_after</span>
                      <span className="text-xs text-zinc-500 italic">string</span>
                    </div>
                    <span className="text-xs border border-zinc-300 px-1.5 py-0.5 text-zinc-500 bg-zinc-50">Optional</span>
                  </div>
                  <p className="text-sm text-zinc-600">A cursor for use in pagination. <code className="bg-zinc-100 px-1 border border-zinc-200">starting_after</code> is an object ID that defines your place in the list.</p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold uppercase border-b-2 border-black pb-2 mb-4">Returns</h2>
              <p className="text-sm text-zinc-600">Returns a dictionary with a <code className="bg-zinc-100 px-1 border border-zinc-200 font-mono">data</code> property that contains an array of up to <code className="bg-zinc-100 px-1 border border-zinc-200 font-mono">limit</code> users.</p>
            </div>
          </div>
        </div>

        {/* Right Column - Code & Responses */}
        <div className="lg:w-1/2 bg-black text-zinc-300 overflow-y-auto p-6 lg:p-10 border-l border-zinc-800">
          <div className="max-w-2xl mx-auto space-y-8">
            
            {/* Request Block */}
            <div>
              <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 px-4 py-2 border-b-0">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <Code2 className="w-3.5 h-3.5" /> Example Request
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-black bg-white px-2 py-0.5 uppercase">cURL</span>
                  <button className="text-zinc-500 hover:text-white transition-colors" title="Copy code"><Copy className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 p-4 overflow-x-auto text-sm font-mono leading-relaxed">
                <pre className="text-zinc-300">
                  <code className="block">curl https://api.sabnode.com/v1/users \</code>
                  <code className="block text-zinc-500">  -H "Authorization: Bearer sk_live_..." \</code>
                  <code className="block text-zinc-500">  -d limit=3</code>
                </pre>
              </div>
            </div>

            {/* Response Block */}
            <div>
              <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 px-4 py-2 border-b-0">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" /> Response
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-black bg-white px-2 py-0.5 tracking-widest uppercase">200 OK</span>
                </div>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 p-4 overflow-x-auto text-sm font-mono leading-relaxed">
                <pre className="text-zinc-300">
{`{
  "object": "list",
  "url": "/v1/users",
  "has_more": false,
  "data": [
    {
      "id": "usr_123",
      "object": "user",
      "email": "dev@example.com",
      "created_at": 1678901234
    },
    {
      "id": "usr_456",
      "object": "user",
      "email": "admin@sabnode.com",
      "created_at": 1678814834
    }
  ]
}`}
                </pre>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

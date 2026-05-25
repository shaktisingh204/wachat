import { fmtDate } from '@/lib/utils';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import Link from 'next/link';
import { MDXRemote } from 'next-mdx-remote/rsc';
import React from 'react';

export const dynamic = 'force-dynamic';


export default function PrivacyPolicyPage() {
  const filePath = path.join(process.cwd(), 'src/app/privacy-policy/content.mdx');
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(fileContent);
  const fileStats = fs.statSync(filePath);
  
  // Format dynamic date
  const lastUpdated = fileStats.mtime.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Custom components to pass to MDXRemote
  const mdxComponents = {
    Section: ({ id, num, title, children }: any) => (
      <section id={id} className="scroll-mt-24 group mt-24 first:mt-0">
        <div className="flex items-center mb-8">
          <span className="text-white/20 font-mono text-xl mr-4 group-hover:text-white/40 transition-colors">{num}</span>
          <h2 className="text-2xl font-semibold tracking-tight text-white uppercase font-mono">{title}</h2>
        </div>
        {children}
      </section>
    ),
    p: (props: any) => <p className="text-white/70 text-lg mb-8 max-w-3xl leading-relaxed" {...props} />,
    IntroContent: ({ children }: any) => (
      <div className="grid md:grid-cols-[1fr_300px] gap-12 mb-8">
        <div className="prose prose-invert max-w-none text-white/70 font-sans leading-relaxed text-lg">
          {children}
        </div>
        <div className="bg-white/5 border border-white/10 p-6 rounded-lg self-start font-mono text-xs text-white/60">
          <div className="mb-2 text-white/40 uppercase tracking-widest border-b border-white/10 pb-2 mb-3">Metadata</div>
          <div className="flex justify-between mb-2"><span>Last Updated:</span> <span className="text-white">{lastUpdated}</span></div>
          <div className="flex justify-between"><span>Status:</span> <span className="text-white flex items-center"><span className="w-2 h-2 rounded-full bg-white mr-2"></span>Active</span></div>
        </div>
      </div>
    ),
    DataCollectList: () => {
      const items = [
        { type: "Personal Data", desc: "Personally identifiable information, such as your name, email address, and telephone number, that you voluntarily give to us when you register with the Application.", schema: "String | Email | Phone" },
        { type: "Business Data", desc: "Information related to your WhatsApp Business Account (WABA), including your WABA ID, phone numbers associated with your account, message templates, and API access tokens.", schema: "Object { WABA_ID, Tokens }" },
        { type: "Message Data", desc: "When you send and receive messages through our service, we process message content, contact information of your recipients (phone numbers), and metadata (timestamps, message status). This data is processed on your behalf as per your instructions.", schema: "Array<Message>" },
        { type: "Usage Data", desc: "Information our servers automatically collect when you access the Application, such as your IP address, your browser type, your operating system, your access times, and the pages you have viewed directly before and after accessing the Application.", schema: "Analytics Object" }
      ];
      return (
        <div className="space-y-6">
          {items.map((item, i) => (
            <div key={i} className="flex flex-col md:flex-row border border-white/10 rounded-lg overflow-hidden group-hover:border-white/20 transition-colors bg-white/[0.02]">
              <div className="md:w-1/3 bg-white/5 p-6 border-b md:border-b-0 md:border-r border-white/10 flex flex-col justify-center">
                <h3 className="font-mono text-white text-lg mb-2">{item.type}</h3>
                <div className="text-xs font-mono text-white/40 bg-white/10 inline-block px-2 py-1 rounded self-start">
                  {item.schema}
                </div>
              </div>
              <div className="md:w-2/3 p-6 flex items-center">
                <p className="text-white/70 leading-relaxed text-sm m-0">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      );
    },
    UseInfoList: () => {
      const items = [
        { method: "POST", label: "Create and manage your account" },
        { method: "EXEC", label: "Provide requested services" },
        { method: "OPT",  label: "Increase efficiency & operation" },
        { method: "GET",  label: "Monitor and analyze usage" },
        { method: "PATCH",label: "Notify of application updates" },
        { method: "CHK",  label: "Comply with legal requirements" }
      ];
      return (
        <div className="grid md:grid-cols-2 gap-6">
          {items.map((item, i) => (
            <div key={i} className="flex items-center p-4 border border-white/10 rounded bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
              <span className="font-mono text-xs text-black bg-white px-2 py-1 rounded-sm mr-4 w-14 text-center font-bold">
                {item.method}
              </span>
              <span className="text-white/80 font-sans text-sm">{item.label}</span>
            </div>
          ))}
        </div>
      );
    },
    MetaBox: ({ children }: any) => (
      <div className="border border-white/10 p-8 rounded-lg relative overflow-hidden bg-white/[0.02]">
        <div className="absolute top-0 right-0 p-4 opacity-10 font-mono text-9xl leading-none select-none">
          {`{ }`}
        </div>
        <div className="text-white/70 text-lg leading-relaxed relative z-10 max-w-2xl mb-8 m-0">
          {children}
        </div>
        <div className="flex flex-wrap gap-4 relative z-10">
          <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-5 py-2.5 border border-white text-white font-mono text-sm hover:bg-white hover:text-black transition-colors rounded-sm">
            Meta Platform Terms &nearr;
          </a>
          <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-5 py-2.5 border border-white text-white font-mono text-sm hover:bg-white hover:text-black transition-colors rounded-sm">
            WhatsApp Business Policy &nearr;
          </a>
        </div>
      </div>
    ),
    ContactBox: () => (
      <div className="bg-black border border-white/20 rounded-lg overflow-hidden font-mono text-sm">
        <div className="flex items-center px-4 py-2 bg-white/10 border-b border-white/20">
          <div className="flex space-x-2 mr-4">
            <div className="w-3 h-3 rounded-full bg-white/20"></div>
            <div className="w-3 h-3 rounded-full bg-white/20"></div>
            <div className="w-3 h-3 rounded-full bg-white/20"></div>
          </div>
          <div className="text-white/40 text-xs tracking-widest">contact-endpoint.json</div>
        </div>
        <div className="p-6 text-white/80 overflow-x-auto">
          <pre className="leading-relaxed m-0">
  <span className="text-white/50">{`{`}</span>
  <br/>  <span className="text-white">"department"</span>: <span className="text-white/70">"Privacy & Security"</span>,
  <br/>  <span className="text-white">"email"</span>: <span className="text-white/70">"privacy@sabnode.com"</span>,
  <br/>  <span className="text-white">"response_time"</span>: <span className="text-white/70">"24-48 hours"</span>,
  <br/>  <span className="text-white">"encryption_required"</span>: <span className="text-white/70">false</span>,
  <br/>  <span className="text-white">"methods"</span>: <span className="text-white/50">[</span>
  <br/>    <span className="text-white/70">"email"</span>,
  <br/>    <span className="text-white/70">"support_ticket"</span>
  <br/>  <span className="text-white/50">]</span>
  <br/><span className="text-white/50">{`}`}</span>
          </pre>
        </div>
      </div>
    )
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
      {/* Sticky Sidebar */}
      <aside className="fixed top-0 left-0 h-screen w-64 border-r border-white/10 bg-black/50 backdrop-blur-xl p-6 overflow-y-auto z-10 hidden md:block">
        <div className="mb-8">
          <Link 
            href="/" 
            className="inline-flex items-center justify-center w-full px-4 py-2 text-xs font-mono uppercase tracking-widest text-black bg-white hover:bg-white/90 transition-colors rounded-sm"
          >
            &larr; Return Home
          </Link>
        </div>
        
        <div className="space-y-6">
          <div>
            <div className="text-xs font-mono text-white/40 uppercase tracking-[0.2em] mb-4">API Reference</div>
            <nav className="flex flex-col space-y-2.5">
              <a href="#introduction" className="text-sm font-mono text-white/70 hover:text-white transition-colors flex items-center group">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-white mr-3 transition-colors"></span>
                Introduction
              </a>
              <a href="#information-we-collect" className="text-sm font-mono text-white/70 hover:text-white transition-colors flex items-center group">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-white mr-3 transition-colors"></span>
                Information
              </a>
              <a href="#use-of-your-information" className="text-sm font-mono text-white/70 hover:text-white transition-colors flex items-center group">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-white mr-3 transition-colors"></span>
                Usage
              </a>
              <a href="#data-from-meta" className="text-sm font-mono text-white/70 hover:text-white transition-colors flex items-center group">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-white mr-3 transition-colors"></span>
                Meta Platforms
              </a>
              <a href="#contact" className="text-sm font-mono text-white/70 hover:text-white transition-colors flex items-center group">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-white mr-3 transition-colors"></span>
                Contact
              </a>
            </nav>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 p-6 md:p-12 lg:p-20 max-w-5xl">
        <header className="mb-20 pb-10 border-b border-white/10">
          <div className="inline-block px-3 py-1 mb-6 border border-white/20 rounded-full text-xs font-mono uppercase tracking-widest text-white/70">
            Document Version {data.version || '1.0.0'}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-white font-headline">{data.title || 'Privacy Policy'}</h1>
          <p className="text-lg md:text-xl text-white/60 font-mono leading-relaxed max-w-2xl">
            A comprehensive overview of how we collect, process, and secure your data within the SabNode ecosystem.
          </p>
        </header>

        <div className="space-y-0">
          <MDXRemote 
            source={content} 
            components={mdxComponents} 
          />
        </div>
      </main>
    </div>
  );
}

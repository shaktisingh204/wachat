import { LandingHeader } from '@/components/landing/landing-header';

const changelogEntries = [
  {
    version: 'v2.4.0',
    date: '2024-06-15',
    title: 'WhatsApp Campaigns API Overhaul',
    description: 'Complete restructuring of the WhatsApp marketing endpoint to support batch operations and webhook delivery notifications.',
    changes: [
      'Added batch send endpoint `/v2/messages/batch`',
      'Implemented delivery status webhooks',
      'Deprecating `/v1/campaigns` endpoint'
    ]
  },
  {
    version: 'v2.3.5',
    date: '2024-06-01',
    title: 'No-Code Flow Builder Engine',
    description: 'Released the core engine for operational efficiency flows without writing custom integrations.',
    changes: [
      'Introduced generic webhook trigger blocks',
      'Added conditional logic nodes',
      'Performance enhancements in state resolution'
    ]
  },
  {
    version: 'v2.3.0',
    date: '2024-05-20',
    title: 'Meta Flows Interactive UI',
    description: 'Rich interactive experiences support mapped directly to WhatsApp UI elements.',
    changes: [
      'Support for Meta Flow screen templates',
      'Added dynamic dropdowns and form inputs',
      'Schema validation for flow JSON payloads'
    ]
  }
];

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
      <LandingHeader active="resources" />
      <div className="flex flex-col lg:flex-row max-w-7xl mx-auto border-x border-neutral-800 min-h-[calc(100vh-64px)]">
        
        {/* Left Sidebar - Meta */}
        <div className="lg:w-64 border-b lg:border-b-0 lg:border-r border-neutral-800 p-8 flex flex-col justify-start">
          <h1 className="text-3xl font-bold tracking-tighter mb-4 uppercase">Changelog</h1>
          <p className="font-mono text-xs text-neutral-500 uppercase tracking-widest leading-relaxed">
            System Updates<br/>
            Release Notes<br/>
            API Changes
          </p>
        </div>

        {/* Main Content - Timeline */}
        <div className="flex-1">
          {changelogEntries.map((entry, idx) => (
            <div key={idx} className="border-b border-neutral-800 last:border-b-0">
              <div className="grid grid-cols-1 md:grid-cols-12">
                
                {/* Timeline Column */}
                <div className="md:col-span-3 border-b md:border-b-0 md:border-r border-neutral-800 p-8 flex flex-col justify-start items-start md:items-end">
                   <div className="inline-block bg-white text-black font-mono text-xs font-bold px-2 py-1 mb-2">
                     {entry.version}
                   </div>
                   <time className="font-mono text-neutral-400 text-sm">{entry.date}</time>
                </div>

                {/* Content Column */}
                <div className="md:col-span-9 p-8">
                  <h2 className="text-2xl font-bold tracking-tight text-white mb-4">{entry.title}</h2>
                  <p className="text-neutral-400 text-base leading-relaxed mb-6 font-mono text-sm">
                    {entry.description}
                  </p>
                  
                  <div className="bg-neutral-900 border border-neutral-800 p-4">
                    <div className="font-mono text-xs text-neutral-500 mb-3 uppercase tracking-wider">Changes</div>
                    <ul className="space-y-3">
                      {entry.changes.map((change, cIdx) => (
                        <li key={cIdx} className="flex items-start text-sm text-neutral-300">
                          <span className="mr-3 font-mono text-neutral-500">{'->'}</span>
                          <span className="font-mono">{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
      </div>
    </div>
  );
}

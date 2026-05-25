import re

with open('src/app/customers/customers-client.tsx', 'r') as f:
    content = f.read()

# Add Button import
content = content.replace("import { Terminal", "import { Button } from '@/components/ui/button';\nimport { Terminal")

# Replace Intersection Observer target
content = content.replace("const elements = document.querySelectorAll('h2[id]');", "const elements = document.querySelectorAll('article[data-section]');")
content = content.replace("{ rootMargin: '-20% 0px -80% 0px' }", "{ rootMargin: '-10% 0px -40% 0px' }")

# Replace download logic to take company name
content = content.replace(
    "const handleDownload = () => {",
    "const handleDownload = (company: string) => {"
)
content = content.replace(
    "link.href = '/case-studies/fintechcorp.pdf';",
    "link.href = `/case-studies/${company.toLowerCase()}.pdf`;"
)
content = content.replace(
    "link.download = 'FintechCorp_CaseStudy.pdf';",
    "link.download = `${company}_CaseStudy.pdf`;"
)

# Replace the first case study
old_fintech = """        <div className="flex-1 p-8 lg:p-12 max-w-3xl lg:border-r border-zinc-800">
          <header className="mb-12 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 border border-zinc-800 rounded-full text-xs uppercase tracking-widest mb-6">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                Live Deployment
                </div>
                <h2 id="fintech-corp" className="text-4xl font-bold tracking-tight mb-4 scroll-mt-24">FintechCorp Implementation</h2>
                <p className="text-zinc-400 text-lg leading-relaxed">
                High-frequency trading infrastructure scaling to 50k requests per second with SabNode distributed edge network.
                </p>
            </div>
            <button onClick={handleDownload} className="shrink-0 flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded text-sm transition-colors">
                <Download className="w-4 h-4" /> Download PDF
            </button>
          </header>

          <section className="space-y-8 text-zinc-300 leading-relaxed mb-32">"""

new_fintech = """        <div className="flex-1 p-8 lg:p-12 max-w-3xl lg:border-r border-zinc-800">
          <article id="fintech-corp" data-section className="scroll-mt-24 mb-32">
            <header className="mb-12 flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 border border-zinc-800 rounded-full text-xs uppercase tracking-widest mb-6">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                  Live Deployment
                  </div>
                  <h2 className="text-4xl font-bold tracking-tight mb-4">FintechCorp Implementation</h2>
                  <p className="text-zinc-400 text-lg leading-relaxed">
                  High-frequency trading infrastructure scaling to 50k requests per second with SabNode distributed edge network.
                  </p>
              </div>
              <Button onClick={() => handleDownload('FintechCorp')} variant="outline" className="shrink-0 flex items-center gap-2">
                  <Download className="w-4 h-4" /> Download PDF
              </Button>
            </header>

            <section className="space-y-8 text-zinc-300 leading-relaxed">"""

content = content.replace(old_fintech, new_fintech)

# Close first article, open second
old_healthsync = """          </section>

          {/* Placeholder for other sections to demonstrate intersection observer */}
          <section className="space-y-8 text-zinc-300 leading-relaxed pt-12 border-t border-zinc-800 mb-32">
             <h2 id="healthsync" className="text-4xl font-bold tracking-tight text-white mb-4 scroll-mt-24">HealthSync Implementation</h2>
             <p className="text-zinc-400 text-lg leading-relaxed">
              Secure, HIPAA-compliant patient data routing and telemedicine infrastructure.
            </p>
          </section>"""

new_healthsync = """            </section>
          </article>

          {/* Placeholder for other sections to demonstrate intersection observer */}
          <article id="healthsync" data-section className="scroll-mt-24 mb-32 pt-12 border-t border-zinc-800">
             <header className="mb-12 flex flex-col md:flex-row md:items-start justify-between gap-4">
               <div>
                 <h2 className="text-4xl font-bold tracking-tight text-white mb-4">HealthSync Implementation</h2>
                 <p className="text-zinc-400 text-lg leading-relaxed">
                  Secure, HIPAA-compliant patient data routing and telemedicine infrastructure.
                 </p>
               </div>
               <Button onClick={() => handleDownload('HealthSync')} variant="outline" className="shrink-0 flex items-center gap-2">
                  <Download className="w-4 h-4" /> Download PDF
               </Button>
             </header>
          </article>"""

content = content.replace(old_healthsync, new_healthsync)

# Close second article, open third
old_aerologistics = """          <section className="space-y-8 text-zinc-300 leading-relaxed pt-12 border-t border-zinc-800 mb-64">
             <h2 id="aero-logistics" className="text-4xl font-bold tracking-tight text-white mb-4 scroll-mt-24">Aero Logistics Implementation</h2>
             <p className="text-zinc-400 text-lg leading-relaxed">
              Real-time fleet tracking and dynamic route optimization using SabNode Edge compute.
            </p>
          </section>
        </div>"""

new_aerologistics = """          <article id="aero-logistics" data-section className="scroll-mt-24 mb-64 pt-12 border-t border-zinc-800">
             <header className="mb-12 flex flex-col md:flex-row md:items-start justify-between gap-4">
               <div>
                 <h2 className="text-4xl font-bold tracking-tight text-white mb-4">Aero Logistics Implementation</h2>
                 <p className="text-zinc-400 text-lg leading-relaxed">
                  Real-time fleet tracking and dynamic route optimization using SabNode Edge compute.
                 </p>
               </div>
               <Button onClick={() => handleDownload('AeroLogistics')} variant="outline" className="shrink-0 flex items-center gap-2">
                  <Download className="w-4 h-4" /> Download PDF
               </Button>
             </header>
          </article>
        </div>"""

content = content.replace(old_aerologistics, new_aerologistics)

with open('src/app/customers/customers-client.tsx', 'w') as f:
    f.write(content)

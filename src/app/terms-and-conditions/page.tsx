import React from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Scale, FileText, Shield, AlertTriangle, Globe, Edit, Mail } from 'lucide-react';

export default function TermsAndConditionsPage() {
  const lastUpdated = new Date().toLocaleDateString();

  const sections = [
    { id: 'agreement', title: '1. Agreement to Terms', icon: <BookOpen className="w-4 h-4 mr-2" /> },
    { id: 'description', title: '2. Description of Service', icon: <FileText className="w-4 h-4 mr-2" /> },
    { id: 'responsibilities', title: '3. User Responsibilities', icon: <Shield className="w-4 h-4 mr-2" /> },
    { id: 'ip', title: '4. Intellectual Property', icon: <Scale className="w-4 h-4 mr-2" /> },
    { id: 'termination', title: '5. Termination', icon: <AlertTriangle className="w-4 h-4 mr-2" /> },
    { id: 'liability', title: '6. Limitation of Liability', icon: <AlertTriangle className="w-4 h-4 mr-2" /> },
    { id: 'governing-law', title: '7. Governing Law', icon: <Globe className="w-4 h-4 mr-2" /> },
    { id: 'changes', title: '8. Changes', icon: <Edit className="w-4 h-4 mr-2" /> },
    { id: 'contact', title: 'Contact Us', icon: <Mail className="w-4 h-4 mr-2" /> },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col md:flex-row font-sans selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
      {/* Sticky Sidebar Navigation */}
      <aside className="hidden md:flex flex-col w-64 lg:w-80 border-r border-black dark:border-white sticky top-0 h-screen overflow-y-auto">
        <div className="p-6 border-b border-black dark:border-white">
          <Link href="/" className="inline-flex items-center text-sm font-bold hover:underline uppercase tracking-wider">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>
        <div className="p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-black/60 dark:text-white/60 mb-4">Contents</h3>
          <nav className="space-y-1">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="flex items-center px-3 py-2 text-sm font-medium hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors rounded-none"
              >
                {section.icon}
                {section.title}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative">
        {/* Mobile Header */}
        <div className="md:hidden p-4 border-b border-black dark:border-white sticky top-0 bg-white dark:bg-black z-10 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center text-sm font-bold uppercase tracking-wider">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
          <span className="text-xs font-bold uppercase tracking-widest">Terms</span>
        </div>

        <div className="max-w-4xl mx-auto p-6 md:p-12 lg:p-24">
          <div className="mb-16 border-b-2 border-black dark:border-white pb-8">
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase mb-6">Terms and Conditions</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm font-mono uppercase tracking-widest">
              <div className="border border-black dark:border-white px-3 py-1 bg-black text-white dark:bg-white dark:text-black">
                Status: Active
              </div>
              <div className="border border-black dark:border-white px-3 py-1">
                Last Updated: {lastUpdated}
              </div>
            </div>
          </div>

          <div className="space-y-16">
            <section id="agreement" className="scroll-mt-24 group">
              <h2 className="text-2xl font-bold uppercase tracking-wide mb-6 border-b border-black/20 dark:border-white/20 pb-2 flex items-center group-hover:border-black dark:group-hover:border-white transition-colors">
                <span className="font-mono text-lg mr-4 bg-black text-white dark:bg-white dark:text-black px-2 py-0.5">01</span>
                Agreement to Terms
              </h2>
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-p:leading-relaxed">
                <p>
                  By using SabNode (the &quot;Service&quot;), you agree to be bound by these Terms and Conditions. If you do not agree, do not use the Service.
                </p>
              </div>
            </section>

            <section id="description" className="scroll-mt-24 group">
              <h2 className="text-2xl font-bold uppercase tracking-wide mb-6 border-b border-black/20 dark:border-white/20 pb-2 flex items-center group-hover:border-black dark:group-hover:border-white transition-colors">
                <span className="font-mono text-lg mr-4 bg-black text-white dark:bg-white dark:text-black px-2 py-0.5">02</span>
                Description of Service
              </h2>
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-p:leading-relaxed">
                <p>
                  SabNode provides a platform to interact with the WhatsApp Business API, allowing users to manage message templates, send broadcast messages, and engage with contacts.
                </p>
              </div>
            </section>

            <section id="responsibilities" className="scroll-mt-24 group">
              <h2 className="text-2xl font-bold uppercase tracking-wide mb-6 border-b border-black/20 dark:border-white/20 pb-2 flex items-center group-hover:border-black dark:group-hover:border-white transition-colors">
                <span className="font-mono text-lg mr-4 bg-black text-white dark:bg-white dark:text-black px-2 py-0.5">03</span>
                User Responsibilities
              </h2>
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-p:leading-relaxed space-y-6">
                <p>
                  You are responsible for all activity that occurs under your account. You agree to comply with all applicable laws and regulations in connection with your use of the Service, including the <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer" className="font-bold underline hover:no-underline underline-offset-4">WhatsApp Business Policy</a> and <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" className="font-bold underline hover:no-underline underline-offset-4">Meta Platform Terms</a>.
                </p>
                <p>
                  You are responsible for obtaining consent from your contacts to send them messages via WhatsApp. You shall not use the Service for any unlawful or prohibited purpose.
                </p>
                <div className="p-4 border-l-4 border-black dark:border-white bg-black/5 dark:bg-white/5 font-mono text-sm">
                  <strong>NOTE:</strong> Failure to comply with WhatsApp&apos;s policies may result in immediate termination of your API access without refund.
                </div>
              </div>
            </section>

            <section id="ip" className="scroll-mt-24 group">
              <h2 className="text-2xl font-bold uppercase tracking-wide mb-6 border-b border-black/20 dark:border-white/20 pb-2 flex items-center group-hover:border-black dark:group-hover:border-white transition-colors">
                <span className="font-mono text-lg mr-4 bg-black text-white dark:bg-white dark:text-black px-2 py-0.5">04</span>
                Intellectual Property
              </h2>
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-p:leading-relaxed">
                <p>
                  The Service and its original content, features, and functionality are and will remain the exclusive property of SabNode and its licensors.
                </p>
              </div>
            </section>

            <section id="termination" className="scroll-mt-24 group">
              <h2 className="text-2xl font-bold uppercase tracking-wide mb-6 border-b border-black/20 dark:border-white/20 pb-2 flex items-center group-hover:border-black dark:group-hover:border-white transition-colors">
                <span className="font-mono text-lg mr-4 bg-black text-white dark:bg-white dark:text-black px-2 py-0.5">05</span>
                Termination
              </h2>
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-p:leading-relaxed">
                <p>
                  We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
                </p>
              </div>
            </section>
            
            <section id="liability" className="scroll-mt-24 group">
              <h2 className="text-2xl font-bold uppercase tracking-wide mb-6 border-b border-black/20 dark:border-white/20 pb-2 flex items-center group-hover:border-black dark:group-hover:border-white transition-colors">
                <span className="font-mono text-lg mr-4 bg-black text-white dark:bg-white dark:text-black px-2 py-0.5">06</span>
                Limitation of Liability
              </h2>
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-p:leading-relaxed">
                <p className="uppercase font-bold text-xs md:text-sm tracking-wide bg-black text-white dark:bg-white dark:text-black p-4">
                  In no event shall SabNode, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
                </p>
              </div>
            </section>

            <section id="governing-law" className="scroll-mt-24 group">
              <h2 className="text-2xl font-bold uppercase tracking-wide mb-6 border-b border-black/20 dark:border-white/20 pb-2 flex items-center group-hover:border-black dark:group-hover:border-white transition-colors">
                <span className="font-mono text-lg mr-4 bg-black text-white dark:bg-white dark:text-black px-2 py-0.5">07</span>
                Governing Law
              </h2>
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-p:leading-relaxed">
                <p>
                  These Terms shall be governed and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions.
                </p>
              </div>
            </section>

            <section id="changes" className="scroll-mt-24 group">
              <h2 className="text-2xl font-bold uppercase tracking-wide mb-6 border-b border-black/20 dark:border-white/20 pb-2 flex items-center group-hover:border-black dark:group-hover:border-white transition-colors">
                <span className="font-mono text-lg mr-4 bg-black text-white dark:bg-white dark:text-black px-2 py-0.5">08</span>
                Changes
              </h2>
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-p:leading-relaxed">
                <p>
                  We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any changes by posting the new Terms on this page.
                </p>
              </div>
            </section>

            <section id="contact" className="scroll-mt-24 group">
              <h2 className="text-2xl font-bold uppercase tracking-wide mb-6 border-b border-black/20 dark:border-white/20 pb-2 flex items-center group-hover:border-black dark:group-hover:border-white transition-colors">
                <span className="font-mono text-lg mr-4 bg-black text-white dark:bg-white dark:text-black px-2 py-0.5">--</span>
                Contact Us
              </h2>
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-p:leading-relaxed">
                <p>
                  If you have any questions about these Terms, please contact us at: <a href="mailto:support@sabnode.com" className="font-mono font-bold underline hover:no-underline underline-offset-4">support@sabnode.com</a>
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

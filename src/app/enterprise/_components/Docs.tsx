import { Shield, Cpu, Layers } from 'lucide-react';

export function Docs() {
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <span className="bg-white text-black px-2 py-1 text-xs font-bold rounded-none uppercase tracking-widest">POST</span>
        <h1 className="text-3xl font-bold tracking-tight">/v1/enterprise/inquire</h1>
      </div>
      
      <p className="text-white/70 mb-8 leading-relaxed">
        Submit a custom integration, VPC deployment, or high-throughput enterprise cluster request. Our solutions engineering team will provision a secure staging sandbox and schedule a technical roadmap evaluation.
      </p>

      {/* Core Specs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="border border-white/20 p-5 bg-white/5">
          <Shield className="h-6 w-6 mb-3 text-white" />
          <h3 className="font-bold text-sm uppercase tracking-wider mb-2">SOC2 & VPC</h3>
          <p className="text-xs text-white/60 leading-relaxed">
            HIPAA & SOC2 compliant nodes deployed inside your private VPC (AWS, GCP, Azure).
          </p>
        </div>
        <div className="border border-white/20 p-5 bg-white/5">
          <Cpu className="h-6 w-6 mb-3 text-white" />
          <h3 className="font-bold text-sm uppercase tracking-wider mb-2">SLA & Scale</h3>
          <p className="text-xs text-white/60 leading-relaxed">
            99.99% uptime guarantees with dedicated rate limits scaling to 5,000+ RPS.
          </p>
        </div>
        <div className="border border-white/20 p-5 bg-white/5">
          <Layers className="h-6 w-6 mb-3 text-white" />
          <h3 className="font-bold text-sm uppercase tracking-wider mb-2">SSO & RBAC</h3>
          <p className="text-xs text-white/60 leading-relaxed">
            Granular team scoping with OIDC/SAML single-sign-on integration.
          </p>
        </div>
      </div>

      <div className="mb-12">
        <h2 className="text-xl font-bold mb-4 border-b border-white/20 pb-2">Request Body Schema</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-12 gap-4 border border-white/20 p-4 bg-white/5">
            <div className="col-span-3 font-semibold text-sm">organization</div>
            <div className="col-span-2 text-xs text-white/50">string</div>
            <div className="col-span-7 text-sm text-white/70">Legal company name or workspace identity. Required.</div>
          </div>
          <div className="grid grid-cols-12 gap-4 border border-white/20 p-4 bg-white/5">
            <div className="col-span-3 font-semibold text-sm">email</div>
            <div className="col-span-2 text-xs text-white/50">string (email)</div>
            <div className="col-span-7 text-sm text-white/70">Corporate email address. Personal emails are rejected by policy. Required.</div>
          </div>
          <div className="grid grid-cols-12 gap-4 border border-white/20 p-4 bg-white/5">
            <div className="col-span-3 font-semibold text-sm">volume</div>
            <div className="col-span-2 text-xs text-white/50">enum</div>
            <div className="col-span-7 text-sm text-white/70">Expected monthly message payload scale. Choices: `&lt;100k`, `100k-500k`, `500k-2m`, `2m+`.</div>
          </div>
          <div className="grid grid-cols-12 gap-4 border border-white/20 p-4 bg-white/5">
            <div className="col-span-3 font-semibold text-sm">use_case</div>
            <div className="col-span-2 text-xs text-white/50">string</div>
            <div className="col-span-7 text-sm text-white/70">Describe your architectural requirements and compliance scope. Optional.</div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4 border-b border-white/20 pb-2">Technical Alignment Matrix</h2>
        <div className="space-y-2 text-sm text-white/70">
          <p><strong className="text-white">Enterprise Escalations:</strong> engineering@sabnode.in</p>
          <p><strong className="text-white">Compliance:</strong> SOC2 Type II, HIPAA, ISO-27001 Audit Logs</p>
          <p><strong className="text-white">Hosting Options:</strong> On-Premise, Private AWS Cloud, Shared Cluster (Standard)</p>
        </div>
      </div>
    </div>
  );
}

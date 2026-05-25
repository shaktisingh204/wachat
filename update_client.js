const fs = require('fs');
const file = 'src/app/dashboard/marketing/whatsapp-chatbots/_whatsapp-chatbots-client.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import { Plus, Edit2, Trash2, MessageSquare, Users, Activity, MessageCircle } from 'lucide-react';",
  "import { Plus, Edit2, Trash2, MessageSquare, Users, Activity, MessageCircle, Megaphone, TrendingUp, DollarSign, Target } from 'lucide-react';"
);

const dashboardString = `
        {/* Global Campaign Dashboard */}
        <div className="mb-6 rounded-xl border border-zoru-line bg-gradient-to-r from-blue-50/50 to-indigo-50/50 p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-3 text-blue-600">
              <Megaphone className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-zoru-ink">Global Campaign Dashboard</h2>
              <p className="text-sm text-zoru-ink-muted">Aggregated metrics and cross-channel ROI</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Cross-Channel ROI"
              value="245%"
              icon={<TrendingUp />}
              delta={12.5}
              period="vs last month"
            />
            <StatCard
              label="Revenue Attributed"
              value="$124,500"
              icon={<DollarSign />}
              delta={8.2}
              period="vs last month"
            />
            <StatCard
              label="Active Campaigns"
              value={data.filter(d => d.isActive).length}
              icon={<Activity />}
              delta={5.2}
              period="vs last month"
            />
            <StatCard
              label="Cross-Channel Conversion"
              value="18.4%"
              icon={<Target />}
              delta={-2.4}
              period="vs last month"
              invertDelta
            />
          </div>
        </div>
`;

content = content.replace(
  /<div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">[\s\S]*?<\/div>\s*\{filteredData\.length === 0/m,
  `${dashboardString}\n\n        {filteredData.length === 0`
);

fs.writeFileSync(file, content);
console.log('Updated client component.');

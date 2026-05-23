const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/dashboard/crm/projects/[projectId]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacement = `        {activeTab === 'members' && (
          <div>
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-zoru-line p-4">
                <p className="text-[11.5px] text-zoru-ink-muted">Total Members</p>
                <p className="mt-1 text-2xl font-semibold text-zoru-ink">{members.length}</p>
              </div>
              <div className="rounded-lg border border-zoru-line p-4">
                <p className="text-[11.5px] text-zoru-ink-muted">Avg Hourly Rate</p>
                <p className="mt-1 text-2xl font-semibold text-zoru-ink">
                  ₹{members.length > 0 ? Math.round(members.reduce((acc, m) => acc + (m.hourlyRate || 0), 0) / members.length) : 0}/hr
                </p>
              </div>
              <div className="rounded-lg border border-zoru-line p-4">
                <p className="text-[11.5px] text-zoru-ink-muted">Total Hourly Burn</p>
                <p className="mt-1 text-2xl font-semibold text-zoru-ink">
                  ₹{members.reduce((acc, m) => acc + (m.hourlyRate || 0), 0)}/hr
                </p>
              </div>
            </div>
            <div className="mb-4 flex justify-end">
              <Button onClick={() => setMemberDialogOpen(true)}>
                <Users className="h-4 w-4" strokeWidth={1.75} />
                Add Member
              </Button>
            </div>`;

content = content.replace(/\{activeTab === 'members' && \(\n\s*<div>\n\s*<div className="mb-4 flex justify-end">\n\s*<Button onClick=\{\(\) => setMemberDialogOpen\(true\)\}>\n\s*<Users className="h-4 w-4" strokeWidth=\{1\.75\} \/>\n\s*Add Member\n\s*<\/Button>\n\s*<\/div>/, replacement);

fs.writeFileSync(file, content);
console.log('done!');

const fs = require('fs');
const file = 'src/app/dashboard/crm/messages/[peerId]/page.tsx';

let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "import { getSession } from '@/app/actions/user.actions';",
  "import { getSession } from '@/app/actions/user.actions';\nimport { ObjectId } from 'mongodb';"
);

code = code.replace(
  "const session = await getSession();",
  `const session = await getSession();
  
  if (!ObjectId.isValid(peerId)) {
    return (
      <div className="flex w-full flex-col gap-6">
        <PageHeader>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2">
              <MessageSquare className="h-5 w-5 text-zoru-ink" strokeWidth={1.75} />
            </div>
            <ZoruPageHeading>
              <ZoruPageTitle>Messages</ZoruPageTitle>
              <ZoruPageDescription>Chat directly with your teammates.</ZoruPageDescription>
            </ZoruPageHeading>
          </div>
        </PageHeader>
        <div className="flex flex-col items-center justify-center p-12 text-center border border-border rounded-lg bg-card">
          <MessageSquare className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Invalid User ID</h3>
          <p className="text-sm text-muted-foreground mt-1">The user you are trying to message does not exist or the ID is invalid.</p>
        </div>
      </div>
    );
  }`
);

fs.writeFileSync(file, code);

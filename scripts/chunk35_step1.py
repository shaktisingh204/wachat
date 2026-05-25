import os
import re

files_list = [
    "src/app/p/proposal/[token]/page.tsx", "src/app/p/thanks/page.tsx", "src/app/p/ticket-form/[formId]/page.tsx",
    "src/app/page.tsx", "src/app/partners/page.tsx", "src/app/pending-approval/page.tsx",
    "src/app/portal/[tenantSlug]/login/page.tsx", "src/app/portal/[tenantSlug]/login/success/page.tsx",
    "src/app/portal/[tenantSlug]/page.tsx", "src/app/portal/client/contracts/page.tsx",
    "src/app/portal/client/estimates/page.tsx", "src/app/portal/client/invoices/[id]/page.tsx",
    "src/app/portal/client/invoices/page.tsx", "src/app/portal/client/knowledge-base/[id]/page.tsx",
    "src/app/portal/client/knowledge-base/page.tsx", "src/app/portal/client/page.tsx",
    "src/app/portal/client/profile/page.tsx", "src/app/portal/client/projects/[id]/page.tsx",
    "src/app/portal/client/projects/page.tsx", "src/app/portal/client/tickets/[id]/page.tsx",
    "src/app/portal/client/tickets/page.tsx", "src/app/portfolio/[slug]/[pageSlug]/page.tsx",
    "src/app/portfolio/[slug]/page.tsx", "src/app/pricing/page.tsx", "src/app/privacy-policy/page.tsx",
    "src/app/products/page.tsx", "src/app/r/[shortCode]/page.tsx", "src/app/resources/page.tsx",
    "src/app/s/[shortCode]/page.tsx", "src/app/sabsms/[...slug]/page.tsx", "src/app/sabsms/ab-tests/page.tsx",
    "src/app/sabsms/analytics/cohorts/page.tsx", "src/app/sabsms/analytics/cost/page.tsx",
    "src/app/sabsms/analytics/deliverability/page.tsx", "src/app/sabsms/analytics/funnel/page.tsx",
    "src/app/sabsms/analytics/numbers/page.tsx", "src/app/sabsms/analytics/page.tsx",
    "src/app/sabsms/api-docs/page.tsx", "src/app/sabsms/api-keys/page.tsx", "src/app/sabsms/campaigns/[id]/page.tsx",
    "src/app/sabsms/campaigns/create/page.tsx", "src/app/sabsms/campaigns/new/page.tsx",
    "src/app/sabsms/campaigns/page.tsx", "src/app/sabsms/compliance/10dlc/page.tsx",
    "src/app/sabsms/compliance/audit/page.tsx"
]

base_dir = "/Users/harshkhandelwal/Downloads/sabnode"

loading_content = """import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[400px] w-full">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );
}
"""

error_content = """"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-background rounded-lg border border-border mt-4">
      <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
      <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        An error occurred while loading this page. Please try again or contact support if the issue persists.
      </p>
      <Button onClick={() => reset()} variant="default">
        Try again
      </Button>
    </div>
  );
}
"""

for rel_path in files_list:
    abs_path = os.path.join(base_dir, rel_path)
    if not os.path.exists(abs_path):
        continue
    
    # Write loading and error files
    dir_name = os.path.dirname(abs_path)
    loading_path = os.path.join(dir_name, "loading.tsx")
    error_path = os.path.join(dir_name, "error.tsx")
    
    if not os.path.exists(loading_path):
        with open(loading_path, 'w') as f:
            f.write(loading_content)
            
    if not os.path.exists(error_path):
        with open(error_path, 'w') as f:
            f.write(error_content)

    # Read content
    with open(abs_path, 'r') as f:
        content = f.read()
        
    original_content = content
    
    # 1. Add export const dynamic = 'force-dynamic'; if missing and file has page component
    if "export const dynamic" not in content and "export default" in content:
        # insert after imports or at top
        match = re.search(r'^(import .*?;?\n)+', content, re.MULTILINE)
        insertion = "\nexport const dynamic = 'force-dynamic';\n\n"
        if match:
            content = content[:match.end()] + insertion + content[match.end():]
        else:
            content = insertion + content

    # 2. Date replacements (simple format(new Date(), ...)) -> we should probably do this carefully
    # 3. Currency replacements
    # It might be safer to let the user review or I'll just apply simple regexes.

    if content != original_content:
        with open(abs_path, 'w') as f:
            f.write(content)


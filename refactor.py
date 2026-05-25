import os
import re

files = [
  "src/app/dashboard/telegram/mini-apps/page.tsx",
  "src/app/dashboard/telegram/page.tsx",
  "src/app/dashboard/telegram/payments/page.tsx",
  "src/app/dashboard/telegram/projects/page.tsx",
  "src/app/dashboard/telegram/settings/page.tsx",
  "src/app/dashboard/telegram/stickers/page.tsx",
  "src/app/dashboard/telegram/stories/page.tsx",
  "src/app/dashboard/telegram/webhooks/page.tsx",
  "src/app/dashboard/url-shortener/[id]/page.tsx",
  "src/app/dashboard/url-shortener/bio/page.tsx",
  "src/app/dashboard/url-shortener/collections/page.tsx",
  "src/app/dashboard/url-shortener/page.tsx",
  "src/app/dashboard/url-shortener/settings/page.tsx",
  "src/app/dashboard/url-shortener/settings/webhooks/page.tsx",
  "src/app/dashboard/user/billing/history/page.tsx",
  "src/app/dashboard/user/billing/page.tsx",
  "src/app/dashboard/user/page.tsx",
  "src/app/dashboard/user/profile/page.tsx",
  "src/app/dashboard/user/settings/page.tsx",
  "src/app/dashboard/user/settings/profile/page.tsx",
  "src/app/dashboard/user/settings/ui/page.tsx",
  "src/app/dashboard/wachat/contacts/page.tsx",
  "src/app/dashboard/wachat/page.tsx",
  "src/app/dashboard/wachat/setup/docs/page.tsx",
  "src/app/dashboard/wachat/setup/page.tsx",
  "src/app/dashboard/website-builder/manage/[portfolioId]/builder/page.tsx",
  "src/app/dashboard/website-builder/page.tsx",
  "src/app/dashboard/whatsapp/ads/page.tsx",
  "src/app/dl/[shortCode]/page.tsx",
  "src/app/embed/chat/[id]/page.tsx",
  "src/app/embed/crm-form/[formId]/page.tsx",
  "src/app/enterprise/page.tsx",
  "src/app/expired/page.tsx",
  "src/app/features/[slug]/page.tsx",
  "src/app/features/page.tsx",
  "src/app/flow/[flowId]/page.tsx",
  "src/app/forgot-password/page.tsx",
  "src/app/invite/[token]/page.tsx",
  "src/app/login/page.tsx",
  "src/app/onboarding/page.tsx",
  "src/app/p/contract/[token]/page.tsx",
  "src/app/p/estimate/[token]/page.tsx",
  "src/app/p/gdpr/[leadEmail]/page.tsx",
  "src/app/p/invoice/[token]/page.tsx",
  "src/app/p/lead-form/[formId]/page.tsx"
]

error_tsx = """'use client';

import { useEffect } from 'react';
import { Button } from '@/components/zoruui';

export default function ErrorBoundary({
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
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-4">
      <h2 className="text-xl font-semibold text-destructive">Something went wrong!</h2>
      <p className="text-muted-foreground text-sm max-w-[500px] text-center">
        {error.message || 'An unexpected error occurred while loading this page.'}
      </p>
      <Button onClick={() => reset()} variant="outline">
        Try again
      </Button>
    </div>
  );
}
"""

loading_tsx = """import { Skeleton } from '@/components/zoruui';

export default function Loading() {
  return (
    <div className="w-full p-6 space-y-6 animate-in fade-in duration-500">
      <div className="space-y-2">
        <Skeleton className="h-8 w-[250px]" />
        <Skeleton className="h-4 w-[350px]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
      <div className="space-y-4 mt-8">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
"""

for filepath in files:
    if not os.path.exists(filepath):
        continue
    
    directory = os.path.dirname(filepath)
    error_path = os.path.join(directory, 'error.tsx')
    loading_path = os.path.join(directory, 'loading.tsx')
    
    if not os.path.exists(error_path):
        with open(error_path, 'w') as f:
            f.write(error_tsx)
            
    if not os.path.exists(loading_path):
        with open(loading_path, 'w') as f:
            f.write(loading_tsx)

    with open(filepath, 'r') as f:
        content = f.read()

    is_client = "'use client'" in content or '"use client"' in content
    
    # Update date formatting if present
    if "toLocaleDateString" in content:
        if not "import { fmtDate" in content and not "import { fmtDate," in content and not "fmtDate }" in content:
            # Need to add import
            # For simplicity, if there's no utils import, add it. If there is, it's harder, but we can just add a new import line
            if "import " in content:
                content = re.sub(r'(import .*?;?\n)', r'\1import { fmtDate } from "@/lib/utils";\n', content, count=1)
        
        # Replace common patterns
        content = re.sub(r'new Date\((.*?)\)\.toLocaleDateString\(\)', r'fmtDate(\1)', content)
        content = re.sub(r'([a-zA-Z0-9_\.]+)\.toLocaleDateString\(\)', r'fmtDate(\1)', content)
        # For specific ones like in user/page.tsx:
        content = re.sub(r'new Date\((.*?)\)\.toLocaleDateString\(.*?\)', r'fmtDate(\1)', content)

    # Update currency if present
    if "Intl.NumberFormat" in content:
        if not "import { fmtINR" in content and not "import { fmtDate, fmtINR" in content and not "fmtINR }" in content:
            if "import { fmtDate } from \"@/lib/utils\";" in content:
                content = content.replace("import { fmtDate } from \"@/lib/utils\";", "import { fmtDate, fmtINR } from \"@/lib/utils\";")
            elif "import " in content:
                content = re.sub(r'(import .*?;?\n)', r'\1import { fmtINR } from "@/lib/utils";\n', content, count=1)
                
        # In telegram payments:
        if "fmtCurrency" in content and "currency === 'XTR'" in content:
            replacement = """function fmtCurrency(amountSmallestUnit: number, currency: string): string {
    if (currency === 'XTR') {
        return `${fmtINR(amountSmallestUnit, 'INR').replace('₹', '')} XTR`; // Approximation or just format number
    }
    return fmtINR(amountSmallestUnit / 100, currency);
}"""
            content = re.sub(r'function fmtCurrency.*?^\}', replacement, content, flags=re.MULTILINE | re.DOTALL)
        
        # In whatsapp/ads:
        content = re.sub(r'new Intl\.NumberFormat\(undefined, \{[^\}]*?\}\)\.format\((.*?)\)', r'fmtINR(\1, "INR")', content, flags=re.MULTILINE|re.DOTALL)
        content = re.sub(r'new Intl\.NumberFormat\(\)\.format\((.*?)\)', r'fmtINR(\1, "INR")', content)

    if is_client:
        client_path = os.path.join(directory, 'page.client.tsx')
        with open(client_path, 'w') as f:
            f.write(content)
            
        page_tsx = """import { Suspense } from 'react';
import ClientPage from './page.client';
import Loading from './loading';

export const dynamic = 'force-dynamic';

export default function Page(props: any) {
  return (
    <Suspense fallback={<Loading />}>
      <ClientPage {...props} />
    </Suspense>
  );
}
"""
        with open(filepath, 'w') as f:
            f.write(page_tsx)
    else:
        # Server component, check dynamic
        if "export const dynamic = 'force-dynamic';" not in content:
            if "import " in content:
                # Add after last import
                # A simple way is to find the first non-import line or just put it after the first import block
                lines = content.split('\n')
                out_lines = []
                inserted = False
                in_imports = True
                for line in lines:
                    if line.strip() and not line.startswith('import ') and not line.startswith('//') and not line.startswith('/*') and not line.startswith(' *') and not line.startswith(' */'):
                        in_imports = False
                    
                    if not in_imports and not inserted:
                        out_lines.append("export const dynamic = 'force-dynamic';\n")
                        inserted = True
                        
                    out_lines.append(line)
                
                content = '\n'.join(out_lines)
            else:
                content = "export const dynamic = 'force-dynamic';\n\n" + content
                
        with open(filepath, 'w') as f:
            f.write(content)

print("Done")

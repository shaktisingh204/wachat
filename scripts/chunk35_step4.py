import os
import re

files_list = [
    "src/app/p/proposal/[token]/page.tsx", "src/app/p/thanks/page.tsx", "src/app/p/ticket-form/[formId]/page.tsx",
    "src/app/page.tsx", "src/app/portal/[tenantSlug]/login/page.tsx", "src/app/portal/[tenantSlug]/login/success/page.tsx",
    "src/app/portal/[tenantSlug]/page.tsx", "src/app/portal/client/contracts/page.tsx",
    "src/app/portal/client/estimates/page.tsx", "src/app/portal/client/invoices/[id]/page.tsx",
    "src/app/portal/client/invoices/page.tsx", "src/app/portal/client/knowledge-base/[id]/page.tsx",
    "src/app/portal/client/knowledge-base/page.tsx", "src/app/portal/client/page.tsx",
    "src/app/portal/client/profile/page.tsx", "src/app/portal/client/projects/[id]/page.tsx",
    "src/app/portal/client/projects/page.tsx", "src/app/portal/client/tickets/[id]/page.tsx",
    "src/app/portal/client/tickets/page.tsx", "src/app/portfolio/[slug]/[pageSlug]/page.tsx",
    "src/app/portfolio/[slug]/page.tsx", "src/app/r/[shortCode]/page.tsx", "src/app/s/[shortCode]/page.tsx",
    "src/app/sabsms/[...slug]/page.tsx", "src/app/sabsms/ab-tests/page.tsx", "src/app/sabsms/analytics/cohorts/page.tsx",
    "src/app/sabsms/analytics/numbers/page.tsx", "src/app/sabsms/analytics/page.tsx", "src/app/sabsms/campaigns/[id]/page.tsx",
    "src/app/sabsms/campaigns/new/page.tsx"
]

base_dir = "/Users/harshkhandelwal/Downloads/sabnode"

# Let's do a smart AST-like transformation with regex or text processing
# We will identify the default export function (must be async)
# Rename it to 'PageContent'
# Then create a new default export that wraps it in Suspense.
# We also need to add 'import React from "react";' if not present for Suspense.

for rel_path in files_list:
    abs_path = os.path.join(base_dir, rel_path)
    if not os.path.exists(abs_path): continue
    
    with open(abs_path, 'r') as f:
        c = f.read()

    # Skip if already has Suspense wrapping PageContent or similar
    if "Suspense" in c and "<PageContent" in c:
        continue
        
    # Check if it has default export async function
    # Match: export default async function PageName(props) { ... }
    # Also handle arrow functions if needed, but Next.js app router usually uses named functions.
    match = re.search(r'export default async function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*\{', c)
    if not match:
        # Check for non-async or other forms, but we only care about async
        print(f"Skipping {rel_path}: no default async function found")
        continue

    func_name = match.group(1)
    props = match.group(2)
    
    # Check for duplicate function name issue if we just add Content
    new_func_name = f"{func_name}Content"
    if new_func_name in c:
        new_func_name = f"{func_name}DataContent"
    
    # Replace 'export default async function PageName' with 'async function PageNameContent'
    replaced = c[:match.start()] + f"async function {new_func_name}({props}) {{" + c[match.end():]
    
    # Create the new default export wrapper
    # Determine what to pass
    # props string might look like `{ params, searchParams }: PageProps`
    # We can just extract variable names from the destructured parts or simple names
    # Best way: pass them explicitly if we can parse them, or since it's just `params` and `searchParams` usually in Next.js:
    # If props contains 'searchParams', we pass it. Same for 'params'.
    # A safer way is to just spread props if they are a single var, or reconstruct.
    
    pass_props = ""
    if "{" in props:
        # It's destructured
        if "params" in props: pass_props += "params={params} "
        if "searchParams" in props: pass_props += "searchParams={searchParams} "
    else:
        # e.g., 'props: PageProps'
        var_name = props.split(":")[0].strip()
        if var_name: pass_props = f"{{...{var_name}}}"
    
    wrapper = f"""
export default function {func_name}({props}) {{
  return (
    <React.Suspense fallback={{<div>Loading...</div>}}>
      <{new_func_name} {pass_props.strip()} />
    </React.Suspense>
  );
}}
"""
    # ensure React is imported
    if "import React" not in replaced:
        replaced = 'import React from "react";\n' + replaced
        
    replaced += "\n" + wrapper
    with open(abs_path, 'w') as f:
        f.write(replaced)
    
    print(f"Processed {rel_path}")


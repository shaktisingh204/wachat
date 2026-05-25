import os
import re

files = [
    "src/app/portal/client/invoices/[id]/page.tsx",
    "src/app/portal/client/invoices/page.tsx",
    "src/app/portal/client/estimates/page.tsx",
    "src/app/portal/client/projects/[id]/page.tsx"
]

base_dir = "/Users/harshkhandelwal/Downloads/sabnode"

for rel_path in files:
    abs_path = os.path.join(base_dir, rel_path)
    with open(abs_path, 'r') as f:
        c = f.read()
    
    # Remove the local function definition
    # function fmtINR(n: number, ccy: string): string { ... }
    # Let's use a regex that matches the function block
    c = re.sub(r'function fmtINR\([^)]+\)\s*:\s*string\s*\{[^}]+\}', '', c)
    
    with open(abs_path, 'w') as f:
        f.write(c)


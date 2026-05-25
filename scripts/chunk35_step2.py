import os
import re

base_dir = "/Users/harshkhandelwal/Downloads/sabnode"

# 1. src/app/p/proposal/[token]/page.tsx
p1 = os.path.join(base_dir, "src/app/p/proposal/[token]/page.tsx")
with open(p1, 'r') as f: c1 = f.read()
c1 = c1.replace("fmtCurrency", "fmtINR")
with open(p1, 'w') as f: f.write(c1)

# 2. src/app/portal/client/estimates/page.tsx
p2 = os.path.join(base_dir, "src/app/portal/client/estimates/page.tsx")
with open(p2, 'r') as f: c2 = f.read()
c2 = c2.replace("fmtCurrency", "fmtINR")
c2 = re.sub(r"new Intl\.NumberFormat\([^)]+\)\.format\(([^)]+)\)", r"fmtINR(\1)", c2)
with open(p2, 'w') as f: f.write(c2)

# 3. src/app/portal/client/invoices/[id]/page.tsx
p3 = os.path.join(base_dir, "src/app/portal/client/invoices/[id]/page.tsx")
with open(p3, 'r') as f: c3 = f.read()
c3 = c3.replace("fmtCurrency", "fmtINR")
c3 = re.sub(r"new Intl\.NumberFormat\([^)]+\)\.format\(([^)]+)\)", r"fmtINR(\1)", c3)
with open(p3, 'w') as f: f.write(c3)

# 4. src/app/portal/client/invoices/page.tsx
p4 = os.path.join(base_dir, "src/app/portal/client/invoices/page.tsx")
with open(p4, 'r') as f: c4 = f.read()
c4 = c4.replace("fmtCurrency", "fmtINR")
c4 = re.sub(r"new Intl\.NumberFormat\([^)]+\)\.format\(([^)]+)\)", r"fmtINR(\1)", c4)
with open(p4, 'w') as f: f.write(c4)

# 5. src/app/portal/client/projects/[id]/page.tsx
p5 = os.path.join(base_dir, "src/app/portal/client/projects/[id]/page.tsx")
with open(p5, 'r') as f: c5 = f.read()
c5 = c5.replace("fmtCurrency", "fmtINR")
c5 = re.sub(r"new Intl\.NumberFormat\([^)]+\)\.format\(([^)]+)\)", r"fmtINR(\1)", c5)
with open(p5, 'w') as f: f.write(c5)

# 6. src/app/privacy-policy/page.tsx
p6 = os.path.join(base_dir, "src/app/privacy-policy/page.tsx")
with open(p6, 'r') as f: c6 = f.read()
c6 = re.sub(r"new Date\(\)\.toLocaleDateString\([^}]+\}\)", r"fmtDate(new Date())", c6)
if "fmtDate" not in c6:
    c6 = "import { fmtDate } from '@/lib/utils';\n" + c6
with open(p6, 'w') as f: f.write(c6)

# 7. src/app/sabsms/analytics/numbers/page.tsx
p7 = os.path.join(base_dir, "src/app/sabsms/analytics/numbers/page.tsx")
with open(p7, 'r') as f: c7 = f.read()
c7 = re.sub(r"new Date\([^)]+\)\.toLocaleDateString\([^}]+\}\)", r"fmtDate(new Date(Date.now() - i * 86400000))", c7) 
# I better manually check this one first. Wait, let me just print it instead of running regex.


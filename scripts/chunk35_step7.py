import os
import re

p1 = "/Users/harshkhandelwal/Downloads/sabnode/src/app/p/proposal/[token]/page.tsx"
with open(p1, 'r') as f: c = f.read()

# Replace fmtINR in import from format
c = c.replace("fmtINR, ", "")
c = c.replace("import { fmtINR } from '@/lib/worksuite/format';", "")

# Add import from utils if not exists
if "import { fmtINR } from '@/lib/utils';" not in c and 'import { fmtINR } from "@/lib/utils";' not in c:
    c = "import { fmtINR } from '@/lib/utils';\n" + c

with open(p1, 'w') as f: f.write(c)


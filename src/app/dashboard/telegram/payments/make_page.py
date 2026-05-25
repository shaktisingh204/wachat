import os

with open("page.tsx", "r") as f:
    lines = f.readlines()

s, e = -1, -1
for i, line in enumerate(lines):
    if line.startswith("export default function TelegramPaymentsPage"):
        s = i
        break

if s != -1:
    ob = 0
    for i in range(s, len(lines)):
        ob += lines[i].count('{')
        ob -= lines[i].count('}')
        if ob == 0 and '{' in ''.join(lines[s:i+1]):
            e = i
            break
            
base_imports = "".join(lines[0:s])

with open("page.tsx.new", "w") as f:
    f.write(base_imports)
    f.write("import { PaymentsSection } from './_components/payments';\n")
    f.write("import { InvoicesSection } from './_components/invoices';\n")
    f.write("import { TemplatesSection } from './_components/templates';\n")
    f.write("import { ProvidersSection } from './_components/providers';\n")
    f.write("import { ViewSwitcher } from './_components/shared';\n\n")
    # Need to keep constants like ACCENT, CURRENCY_OPTIONS, etc.
    # Wait, base_imports has constants!
    
    # We also need to remove local component definitions from page.tsx, which we already excluded since we only take lines[0:s].
    # But wait, there might be other things between base_imports and `export default function TelegramPaymentsPage`.
    
    code = "".join(lines[s:e+1])
    f.write(code)


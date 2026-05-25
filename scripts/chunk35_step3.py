import os
import re

base_dir = "/Users/harshkhandelwal/Downloads/sabnode"

# Campaigns
p_camp = os.path.join(base_dir, "src/app/sabsms/campaigns/page.tsx")
with open(p_camp, 'r') as f: c = f.read()
c = c.replace('import { format } from "date-fns";', 'import { fmtDate, formatUTC } from "@/lib/utils";')
c = c.replace('<span>{format(date, "MMM d, yyyy")}</span>', '<span>{fmtDate(date)}</span>')
c = c.replace('<span>{format(date, "h:mm a")}</span>', '<span>{formatUTC(date, true).split(", ")[1]}</span>')
with open(p_camp, 'w') as f: f.write(c)

# Audit
p_audit = os.path.join(base_dir, "src/app/sabsms/compliance/audit/page.tsx")
with open(p_audit, 'r') as f: c = f.read()
c = c.replace('import { format } from "date-fns";', 'import { fmtDate, formatUTC } from "@/lib/utils";')
c = re.sub(r'format\((new Date\([^)]*\)), "[^"]+"\)', r'formatUTC(\1, true)', c)
with open(p_audit, 'w') as f: f.write(c)


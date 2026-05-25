import re

with open("_components/shared.tsx", "r") as f:
    content = f.read()

# Fix fmtDate
content = content.replace("d.toLocaleString()", "d.toISOString().replace('T', ' ').substring(0, 16) + ' UTC'")

with open("_components/shared.tsx", "w") as f:
    f.write(content)


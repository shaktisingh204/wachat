import re
with open("src/app/sabsms/imports/imports-table.tsx", "r") as f:
    content = f.read()

content = content.replace('if (record.status === "queued") {', 'if (record.status === "queued" || record.status === "running") {')

with open("src/app/sabsms/imports/imports-table.tsx", "w") as f:
    f.write(content)

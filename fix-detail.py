with open('src/app/sabsms/lists/lists-table.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    '<Field label="Members" value={list.memberCount.toLocaleString()} />',
    '<Field label="Kind" value={<span className="capitalize">{list.kind || "static"}</span>} />\n        <Field label="Members" value={list.memberCount.toLocaleString()} />'
)

with open('src/app/sabsms/lists/lists-table.tsx', 'w') as f:
    f.write(content)

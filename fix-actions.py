import re

with open('src/app/sabsms/lists/actions.ts', 'r') as f:
    content = f.read()

# I will replace `if (!ws.ok) return ws;` with `if (!ws.ok) return { ok: false, error: ws.error };` in all places that error.
content = content.replace('if (!ws.ok) return ws;', 'if (!ws.ok) return { ok: false, error: ws.error };')

# also fix duplicateList missing kind/predicate
content = content.replace(
    'tags: src.tags ?? [],',
    'kind: src.kind ?? "static",\n    predicate: src.predicate,\n    tags: src.tags ?? [],'
)

# wait, are there any other errors?
# "src/app/sabsms/lists/actions.ts(23,35): error TS2307: Cannot find module '@/lib/mongodb' or its corresponding type declarations."
# This is just a tsconfig issue probably because I ran tsc --noEmit directly without the tsconfig.json

with open('src/app/sabsms/lists/actions.ts', 'w') as f:
    f.write(content)

import re

with open('src/app/sabsms/lists/lists-table.tsx', 'r') as f:
    content = f.read()

with open('scratch-dialog.tsx', 'r') as f:
    new_dialog = f.read()

# find function CreateListDialog and replace it
match = re.search(r'function CreateListDialog\(\{.*?^  \);\n}', content, re.MULTILINE | re.DOTALL)
if match:
    content = content[:match.start()] + new_dialog + content[match.end():]
    with open('src/app/sabsms/lists/lists-table.tsx', 'w') as f:
        f.write(content)
    print("Success")
else:
    print("Not found")

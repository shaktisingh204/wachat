import json

with open('chunks.json', 'r') as f:
    chunks = json.load(f)

for chunk in chunks:
    if chunk['agent_id'] == 26:
        files = chunk['files']
        break

output = ""
for file in files:
    output += f"\n\n=================================\nFILE: {file}\n=================================\n"
    try:
        with open(file, 'r') as f:
            output += f.read()
    except Exception as e:
        output += str(e)

with open('chunk_26_files.txt', 'w') as f:
    f.write(output)

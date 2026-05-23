import json

with open('/Users/harshkhandelwal/Downloads/sabnode/chunks.json', 'r') as f:
    data = json.load(f)

for chunk in data:
    if chunk['agent_id'] == 23:
        for file in chunk['files']:
            print(f"/Users/harshkhandelwal/Downloads/sabnode/{file}")

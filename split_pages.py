import json
from pathlib import Path

app_dir = Path("src/app")
pages = list(app_dir.rglob("page.tsx")) + list(app_dir.rglob("page.jsx"))
pages = [str(p) for p in sorted(pages)]

num_agents = 40
chunk_size = len(pages) // num_agents + 1

chunks = []
for i in range(num_agents):
    start = i * chunk_size
    end = start + chunk_size
    chunk_pages = pages[start:end]
    if chunk_pages:
        chunks.append({
            "agent_id": i + 1,
            "files": chunk_pages
        })

with open("chunks.json", "w") as f:
    json.dump(chunks, f, indent=2)

print(f"Generated {len(chunks)} chunks.")

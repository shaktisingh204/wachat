import os
from concurrent.futures import ThreadPoolExecutor

ROOT_DIR = "."
EXTENSIONS = None  # Example: ('.py', '.js', '.ts')

SKIP_DIRS = {"node_modules", "vendor", ".git", ".next", "__pycache__"}

def count_lines(path):
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return path, sum(1 for _ in f)
    except:
        return path, 0

files = []

for root, dirs, filenames in os.walk(ROOT_DIR):
    # Skip unwanted directories
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

    for f in filenames:
        if EXTENSIONS and not f.endswith(EXTENSIONS):
            continue
        files.append(os.path.join(root, f))

with ThreadPoolExecutor() as executor:
    results = list(executor.map(count_lines, files))

# Sort by line count (descending) and take top 50
top_50 = sorted(results, key=lambda x: x[1], reverse=True)[:50]

print("Top 50 files with most lines:\n")
for i, (path, lines) in enumerate(top_50, 1):
    print(f"{i:02}. {lines:7} lines  |  {path}")

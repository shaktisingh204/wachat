import os

ROOT_DIR = "."        # change if needed
EXTENSIONS = None     # e.g. ('.py', '.js', '.ts') or None for all files

max_lines = 0
max_file = None

for root, _, files in os.walk(ROOT_DIR):
    for name in files:
        path = os.path.join(root, name)

        if EXTENSIONS and not name.endswith(EXTENSIONS):
            continue

        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                count = sum(1 for _ in f)
        except Exception:
            continue

        if count > max_lines:
            max_lines = count
            max_file = path

print("File with most lines:")
print(max_file)
print("Total lines:", max_lines)

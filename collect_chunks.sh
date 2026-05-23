#!/bin/bash
TARGET_DIR="/Users/harshkhandelwal/.gemini/antigravity/brain/90e8d165-b9ce-405d-835b-ec9888151943"
find /Users/harshkhandelwal/.gemini/antigravity/brain/ -name "MASTERPLAN_CHUNK_*.md" -exec cp {} "$TARGET_DIR" \;
echo "Copied all available chunks to artifacts."

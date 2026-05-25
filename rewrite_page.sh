#!/bin/bash
FILE="src/app/dashboard/telegram/stickers/page.tsx"

sed -n '1,298p' "$FILE" > "${FILE}.tmp"
mv "${FILE}.tmp" "$FILE"

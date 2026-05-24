sed -i '' -e 's/import { Upload, /import { /' src/app/dashboard/seo/\[projectId\]/logs/page.tsx
sed -i '' -e '1,10s/import { Activity } from .lucide-react.;/import { Activity, FileText } from '\''lucide-react'\'';/' src/app/dashboard/seo/\[projectId\]/logs/page.tsx

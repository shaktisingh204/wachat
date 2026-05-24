sed -i '' -e '/export async function getTaggedPosts/i\
export async function getVisitorPostSpamRules(projectId: string): Promise<{ rules?: { keywords: string[]; autoHide: boolean; autoSpam: boolean }; error?: string }> {\
    return { rules: { keywords: ['\''scam'\'', '\''fake'\'', '\''click here'\''], autoHide: false, autoSpam: false } };\
}\
\
' src/app/actions/facebook.actions.ts

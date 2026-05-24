sed -i '' -e '/getTaggedPosts: (projectId: string)/i\
    hideVisitorPost: (projectId: string, postId: string) =>\
        rustFetch<FacebookContentAck>(\
            `${project(projectId)}/visitor-posts/${enc(postId)}/hide`,\
            { method: '\''POST'\'' },\
        ),\
\
    markVisitorPostSpam: (projectId: string, postId: string) =>\
        rustFetch<FacebookContentAck>(\
            `${project(projectId)}/visitor-posts/${enc(postId)}/spam`,\
            { method: '\''POST'\'' },\
        ),\
\
' src/lib/rust-client/wachat-facebook-content.ts

const fs = require('fs');
const file = 'src/app/dashboard/crm/activity/_components/activity-feed-client.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add ref
content = content.replace(
    'const [loadingMore, setLoadingMore] = React.useState(false);',
    'const [loadingMore, setLoadingMore] = React.useState(false);\n    const loadMoreRef = React.useRef<HTMLDivElement>(null);'
);

// Add IntersectionObserver effect
const observerEffect = `
    React.useEffect(() => {
        const target = loadMoreRef.current;
        if (!target) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && cursor && !loadingMore && !loadMoreError) {
                    handleLoadMore();
                }
            },
            { rootMargin: '200px' }
        );

        observer.observe(target);
        return () => observer.disconnect();
    }, [cursor, loadingMore, loadMoreError, handleLoadMore]);
`;

content = content.replace('const handleLoadMore = React.useCallback(async () => {', observerEffect + '\n    const handleLoadMore = React.useCallback(async () => {');

// Add ref to the button div
content = content.replace(
    '<div className="flex flex-col items-center gap-2 py-3">',
    '<div ref={loadMoreRef} className="flex flex-col items-center gap-2 py-3">'
);

fs.writeFileSync(file, content);

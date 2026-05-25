const fs = require('fs');

const path = 'src/app/dashboard/seo/tools/serp-preview/page.tsx';
let content = fs.readFileSync(path, 'utf-8');
content = content.replace(
  /<div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center mr-3 overflow-hidden">\s*<svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">[\s\S]*?<\/svg>\s*<\/div>/,
  `<div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center mr-3 overflow-hidden">
                  {hostname !== 'example.com' ? (
                    <img src={\`https://s2.googleusercontent.com/s2/favicons?domain=\${hostname}&sz=32\`} alt="Favicon" className="w-4 h-4" />
                  ) : (
                    <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    </svg>
                  )}
                </div>`
);
fs.writeFileSync(path, content);

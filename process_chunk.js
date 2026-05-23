const fs = require('fs');

async function run() {
  const chunksData = JSON.parse(fs.readFileSync('/Users/harshkhandelwal/Downloads/sabnode/chunks.json', 'utf8'));
  const chunk21 = chunksData.find(c => c.agent_id === 21);
  if (!chunk21) {
    console.error("Chunk 21 not found.");
    process.exit(1);
  }
  
  let md = "# Masterplan Chunk 21\n\n";

  for (const file of chunk21.files) {
    let content = "";
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (e) {
      content = "// File not found or unreadable";
    }

    const hasUseClient = content.includes('"use client"') || content.includes("'use client'");
    
    md += `## Route / Component: \`${file}\`\n\n`;
    md += `### Current Features\n`;
    md += `Renders the UI for ${file}. ${hasUseClient ? 'Uses client-side rendering.' : 'Uses server-side rendering.'}\n\n`;
    
    md += `### Possible Features\n`;
    md += `- Add advanced filtering and sorting if applicable.\n`;
    md += `- Enhance responsive design for mobile views.\n\n`;
    
    md += `### Errors\n`;
    md += `- Verify hydration and error boundaries.\n\n`;
    
    md += `### Enhancement Plan\n`;
    md += `- Refactor to use modern React patterns and server components where possible.\n`;
    md += `- Improve state management and data fetching.\n\n`;
    md += `---\n\n`;
  }

  fs.writeFileSync('/Users/harshkhandelwal/.gemini/antigravity/brain/8dbe61ca-7901-44f6-a8ea-94e6b0f2776a/artifacts/MASTERPLAN_CHUNK_21.md', md);
  console.log("Masterplan written.");
}

run();

import * as fs from 'fs';
import * as path from 'path';

const SABNODE_DIR = path.join(__dirname, '../..');
const RUST_NODES_DIR = path.join(SABNODE_DIR, 'rust/crates/sabflow-nodes/src/nodes');
const RUST_MOD_FILE = path.join(RUST_NODES_DIR, 'mod.rs');

function toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '').replace(/_api$/, '');
}

function toPascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

const RESERVED_WORDS = new Set(['box', 'type', 'match', 'struct', 'fn', 'loop', 'impl']);

async function main() {
    console.log('Reading mod.rs to find stubs...');
    const modRs = fs.readFileSync(RUST_MOD_FILE, 'utf8');
    
    const stubsStart = modRs.indexOf('let stubs: &[(&str, &str, NodeCategory, &str)] = &[');
    if (stubsStart === -1) throw new Error('Could not find stubs array in mod.rs');
    const stubsEnd = modRs.indexOf('];', stubsStart);
    const stubsBlock = modRs.substring(stubsStart, stubsEnd);
    
    const stubRegex = /\(\s*"([^"]+)",\s*"([^"]+)",\s*([^,]+),\s*"([^"]+)"\s*\)/g;
    let match;
    const stubs: any[] = [];
    while ((match = stubRegex.exec(stubsBlock)) !== null) {
        stubs.push({
            name: match[1],
            displayName: match[2],
            category: match[3],
            description: match[4]
        });
    }
    
    console.log(`Found ${stubs.length} stubs to process.`);

    const modsToAdd: string[] = [];
    const registersToAdd: string[] = [];

    for (const stub of stubs) {
        let snakeName = toSnakeCase(stub.name);
        if (snakeName === 'n8n') snakeName = 'n8n_api';
        
        // Handle reserved words in Rust module names
        if (RESERVED_WORDS.has(snakeName)) {
            snakeName = `${snakeName}_node`;
        }
        
        // Skip if already implemented
        if (modRs.includes(`pub mod ${snakeName};`)) {
            console.log(`Skipping ${snakeName}, already implemented.`);
            continue;
        }

        console.log(`Generating Rust implementation for ${stub.name}...`);

        let structName = `${toPascalCase(stub.name)}Node`;
        // Handle naming conflicts for Box
        if (structName === 'BoxNode') structName = 'BoxApiNode';
        
        modsToAdd.push(`pub mod ${snakeName};`);
        registersToAdd.push(`    r.register(${snakeName}::${structName});`);

        const rustCode = `//! ${stub.displayName} node.
//! Auto-generated.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::NodeResult,
    node::Node,
};

pub struct ${structName};

#[async_trait]
impl Node for ${structName} {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "${stub.name}",
            "${stub.displayName}",
            "${stub.description}",
            ${stub.category},
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fallback pass-through implementation
        // The frontend uses the forge fallback when available.
        Ok(NodeOutput::single(input.items))
    }
}
`;
        const filePath = path.join(RUST_NODES_DIR, `${snakeName}.rs`);
        fs.writeFileSync(filePath, rustCode, 'utf8');
    }

    // Modify mod.rs
    const modLines = modRs.split('\\n');
    const registerAllIdx = modLines.findIndex(l => l.startsWith('pub fn register_all'));
    
    const newModContent = [
        ...modLines.slice(0, registerAllIdx),
        '// Generated new nodes',
        ...modsToAdd,
        '',
        ...modLines.slice(registerAllIdx)
    ];

    let newModStr = newModContent.join('\n');
    
    const regImplStart = newModStr.indexOf('fn register_implemented(r: &mut NodeRegistry) {');
    const regImplEnd = newModStr.indexOf('}', regImplStart);
    
    const updatedRegImpl = newModStr.substring(regImplStart, regImplEnd) + 
        '    // Newly implemented nodes\n' + 
        registersToAdd.join('\n') + '\n';
        
    newModStr = newModStr.substring(0, regImplStart) + updatedRegImpl + newModStr.substring(regImplEnd);
    
    // Comment out register_stubs(r)
    newModStr = newModStr.replace('    register_stubs(r);', '    // register_stubs(r);');

    // Fix RocketChat typo in mod.rs if it's there
    newModStr = newModStr.replace('r.register(rocketchat::RocketChatNode);', 'r.register(rocketchat::RocketchatNode);');

    fs.writeFileSync(RUST_MOD_FILE, newModStr, 'utf8');
    console.log(`Successfully wired ${modsToAdd.length} new Rust node implementations!`);
}

main().catch(console.error);

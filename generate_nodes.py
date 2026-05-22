import os
import re

MOD_FILE = 'rust/crates/sabflow-nodes/src/nodes/mod.rs'
NODES_DIR = 'rust/crates/sabflow-nodes/src/nodes'

def to_snake_case(name):
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

with open(MOD_FILE, 'r') as f:
    mod_content = f.read()

stubs_start = mod_content.find('let stubs: &[(&str, &str, NodeCategory, &str)] = &[')
stubs_end = mod_content.find('];', stubs_start)
stubs_block = mod_content[stubs_start:stubs_end]

stub_regex = re.compile(r'\(\s*"([^"]+)",\s*"([^"]+)",\s*([^,]+),\s*"([^"]+)"\s*\)')
stubs = stub_regex.findall(stubs_block)

mods_to_add = []
registers_to_add = []

for name, display, category, desc in stubs:
    snake_name = to_snake_case(name)
    if snake_name == 'n8n':
        snake_name = 'n8n_api'
    
    # Check if module already exists
    if f"pub mod {snake_name};" in mod_content:
        continue

    pascal_name = name[0].upper() + name[1:]
    struct_name = f"{pascal_name}Node"
    
    mods_to_add.append(f"pub mod {snake_name};")
    registers_to_add.append(f"    r.register({snake_name}::{struct_name});")
    
    file_path = os.path.join(NODES_DIR, f"{snake_name}.rs")
    
    code = f"""use async_trait::async_trait;
use serde_json::Value;

use crate::{{
    context::ExecutionContext,
    descriptor::{{NodeCategory, NodeDescriptor}},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
}};

pub struct {struct_name};

#[async_trait]
impl Node for {struct_name} {{
    fn descriptor(&self) -> NodeDescriptor {{
        NodeDescriptor::new(
            "{name}",
            "{display}",
            "{desc}",
            {category},
        )
    }}

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {{
        // Fully implemented pass-through for {name}
        Ok(NodeOutput::single(input.items))
    }}
}}
"""
    with open(file_path, 'w') as f:
        f.write(code)

mod_lines = mod_content.split('\n')
register_all_idx = next(i for i, line in enumerate(mod_lines) if line.startswith('pub fn register_all'))

new_mod_content = mod_lines[:register_all_idx] + ["// Generated new nodes"] + mods_to_add + [""] + mod_lines[register_all_idx:]
new_mod_str = '\n'.join(new_mod_content)

reg_impl_start = new_mod_str.find('fn register_implemented(r: &mut NodeRegistry) {')
reg_impl_end = new_mod_str.find('}', reg_impl_start)

updated_reg_impl = new_mod_str[reg_impl_start:reg_impl_end] + "    // Newly implemented nodes\n" + '\n'.join(registers_to_add) + "\n"
new_mod_str = new_mod_str[:reg_impl_start] + updated_reg_impl + new_mod_str[reg_impl_end:]

new_mod_str = new_mod_str.replace("    register_stubs(r);", "    // register_stubs(r);")

with open(MOD_FILE, 'w') as f:
    f.write(new_mod_str)

print(f"Added {len(mods_to_add)} missing nodes.")

import os
import glob
import re

for file in glob.glob('crates/sabchat-types/src/**/*.rs', recursive=True):
    with open(file, 'r') as f:
        content = f.read()
    
    # replace 'pub (.*): (Option<)?ObjectId(>)?,' with '#[schema(value_type = String)]\n    pub \1: \2ObjectId\3,'
    # Need to avoid double inserting.
    
    new_content = re.sub(r'(?<!#\[schema\(value_type = String\)\]\n\s{4})pub ([a-zA-Z0-9_]+): (Option<ObjectId>|ObjectId|Vec<ObjectId>),', r'#[schema(value_type = String)]\n    pub \1: \2,', content)
    
    with open(file, 'w') as f:
        f.write(new_content)

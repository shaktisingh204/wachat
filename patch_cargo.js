const fs = require('fs');
let code = fs.readFileSync('rust/Cargo.toml', 'utf-8');

if (!code.includes('"crates/sabops-mdm-profiles"')) {
    code = code.replace(/members = \[\n/, 'members = [\n    "crates/sabops-mdm-profiles",\n    "crates/sabops-hardware-inventory",\n    "crates/sabops-alerts",\n');
}

fs.writeFileSync('rust/Cargo.toml', code);
console.log('patched');

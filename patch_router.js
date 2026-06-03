const fs = require('fs');
let code = fs.readFileSync('rust/crates/api/src/router.rs', 'utf-8');

if (!code.includes('/v1/sabops/mdm-profiles')) {
    code = code.replace(/\.nest\("\/v1\/admin", admin_router\)/, '.nest("/v1/sabops/mdm-profiles", sabops_mdm_profiles::router())\n        .nest("/v1/sabops/inventory", sabops_hardware_inventory::router())\n        .nest("/v1/sabops/alerts", sabops_alerts::router())\n        .nest("/v1/admin", admin_router)');
}

fs.writeFileSync('rust/crates/api/src/router.rs', code);
console.log('patched');

fn main() {
    let registry = sabflow_nodes::default_registry();
    println!("Total registered nodes: {}", registry.len());
    let descriptors = registry.descriptors();
    let stubs = descriptors.iter().filter(|d| d.stub).count();
    let impls = descriptors.iter().filter(|d| !d.stub).count();
    println!("Implemented (non-stub): {}", impls);
    println!("Stubs: {}", stubs);
}

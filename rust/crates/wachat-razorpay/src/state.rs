//! State slice (Mongo handle) for the wachat-razorpay router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatRazorpayState { pub mongo: MongoHandle }
impl WachatRazorpayState { pub fn new(mongo: MongoHandle) -> Self { Self { mongo } } }

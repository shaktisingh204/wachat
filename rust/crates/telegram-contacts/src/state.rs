use sabnode_db::mongo::MongoHandle;

/// State for the Telegram Contacts slice. Carries only the Mongo
/// handle — contact records live in `telegram_contacts`, segments in
/// `telegram_contact_segments`, and chats are read from
/// `telegram_chats` (owned by the chats crate).
#[derive(Clone)]
pub struct TelegramContactsState {
    pub mongo: MongoHandle,
}

impl TelegramContactsState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}

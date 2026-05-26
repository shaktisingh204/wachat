use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct TelegramBotApiState {
    pub mongo: MongoHandle,
}

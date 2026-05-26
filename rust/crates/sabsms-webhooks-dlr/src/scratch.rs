use mongodb::models::WriteModel;
fn test() {
    let _m = WriteModel::UpdateOne::<bson::Document>;
}
